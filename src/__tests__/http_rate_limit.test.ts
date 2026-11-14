/**
 * MCPRATE-P2: rate limits must cover POST /mcp. They used to be Hono
 * middleware that fastmcp only consulted for requests mcp-proxy had declined,
 * so every MCP call bypassed them. Boots the real server (index.ts) over HTTP
 * streaming against a fake vault and drives raw POSTs at /mcp.
 *
 * Two buckets: failed authentications per client IP (default 60/min), and
 * successful ones per credential (ONECLAW_MCP_RATE_LIMIT_PER_MIN_AUTHED, set
 * low here). Hosted connectors share egress IPs, so valid traffic must not be
 * charged to the IP.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:net";

const VAULT = "https://vault.test";
const AUTHED_LIMIT = 70;
/** mcp-proxy's reply once authentication passed: 400 for the missing session id. */
const PASSED_AUTH = 400;

const agents: Record<string, string> = {
    ocv_rate_a: "0a0a0a0a-0000-4000-8000-00000000000a",
    ocv_rate_b: "0b0b0b0b-0000-4000-8000-00000000000b",
};
let exchanges = 0;

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function jwt(payload: Record<string, unknown>): string {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${b64({ alg: "EdDSA", typ: "JWT" })}.${b64(payload)}.sig`;
}

async function fakeVault(url: URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST" && url.pathname === "/v1/auth/agent-token") {
        exchanges++;
        const { api_key } = JSON.parse(String(init?.body ?? "{}")) as { api_key?: string };
        if (api_key === "ocv_vault_down") return json(503, { detail: "unavailable" });
        if (api_key === "ocv_vault_busy") return json(429, { detail: "slow down" });
        if (api_key === "ocv_vault_unreachable") throw new TypeError("fetch failed");
        const id = agents[api_key ?? ""];
        if (!id) return json(401, { detail: "bad key" });
        return json(200, {
            access_token: jwt({ sub: `agent:${id}`, org: "org-1", exp: Math.floor(Date.now() / 1000) + 3600 }),
            token_type: "Bearer",
            expires_in: 3600,
            agent_id: id,
            vault_ids: ["vault-1"],
        });
    }
    if (method === "GET" && url.pathname === "/v1/vaults/vault-1") return json(200, { id: "vault-1", name: "default" });
    if (method === "GET" && url.pathname.startsWith("/v1/agents/")) {
        return json(200, { id: url.pathname.slice("/v1/agents/".length), name: "t", is_active: true });
    }
    return json(404, { detail: "no fake route" });
}

let port: number;
let stop: (() => Promise<void>) | undefined;
const realFetch = globalThis.fetch;

async function freePort(): Promise<number> {
    return new Promise((resolve) => {
        const srv = createServer();
        srv.listen(0, "127.0.0.1", () => {
            const p = (srv.address() as { port: number }).port;
            srv.close(() => resolve(p));
        });
    });
}

/**
 * One POST /mcp. A tools/list with no session id: authentication runs first,
 * then mcp-proxy refuses it for the missing session, which keeps the test from
 * opening a session per request. 401 = auth failed, 400 = auth passed.
 */
async function postMcp(ip: string, credential?: string): Promise<Response> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        // Cloud Run appends the real client as the rightmost entry; the
        // spoofed left entry must not decide the bucket.
        "X-Forwarded-For": `203.0.113.250, ${ip}`,
    };
    if (credential) headers.Authorization = `Bearer ${credential}`;
    const res = await realFetch(`http://127.0.0.1:${port}/mcp`, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    await res.clone().text();
    return res;
}

beforeAll(async () => {
    port = await freePort();
    process.env.MCP_TRANSPORT = "httpStream";
    process.env.PORT = String(port);
    process.env.ONECLAW_MCP_HOST = "127.0.0.1";
    process.env.ONECLAW_BASE_URL = VAULT;
    process.env.ONECLAW_MCP_RATE_LIMIT_PER_MIN_AUTHED = String(AUTHED_LIMIT);
    delete process.env.ONECLAW_MCP_RATE_LIMIT_PER_MIN;
    delete process.env.ONECLAW_AGENT_API_KEY;
    delete process.env.ONECLAW_AGENT_TOKEN;
    delete process.env.ONECLAW_LOCAL_ONLY;
    delete process.env.ONECLAW_LOCAL_VAULT;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        if (url.origin === VAULT) return fakeVault(url, init);
        return realFetch(input, init);
    }) as typeof fetch;

    const mod = await import("../index.js");
    const { server } = await mod.running;
    stop = () => server.stop();
}, 30_000);

afterAll(async () => {
    globalThis.fetch = realFetch;
    await stop?.();
    delete process.env.ONECLAW_MCP_RATE_LIMIT_PER_MIN_AUTHED;
});

describe("HTTP rate limit (MCPRATE-P2)", () => {
    it("61 failed authentications from one IP: the 61st gets 429 without doing auth work", async () => {
        const ip = "198.51.100.7";
        for (let i = 1; i <= 60; i++) {
            const res = await postMcp(ip, i % 2 ? "ocv_wrong" : undefined);
            expect(res.status, `request ${i}`).toBe(401);
        }

        const before = exchanges;
        const limited = await postMcp(ip, "ocv_wrong");
        expect(limited.status).toBe(429);
        expect(exchanges, "a blocked IP must not reach the key exchange").toBe(before);
        expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
        expect(limited.headers.get("ratelimit-limit")).toBe("60");
        expect(limited.headers.get("ratelimit-remaining")).toBe("0");
        expect(limited.headers.get("ratelimit-reset")).toMatch(/^\d+$/);
        const body = (await limited.json()) as { error?: { message?: string } };
        expect(body.error?.message).toMatch(/too many requests/i);

        // Failures from another IP are counted separately.
        expect((await postMcp("198.51.100.8", "ocv_wrong")).status).toBe(401);
    });

    it("vault 503 / 429 / network errors fail the request but are not charged to the IP", async () => {
        const ip = "198.51.100.40";
        const transient = ["ocv_vault_down", "ocv_vault_busy", "ocv_vault_unreachable"];
        for (let i = 1; i <= 61; i++) {
            const res = await postMcp(ip, transient[i % 3]);
            expect(res.status, `request ${i}`).toBe(401);
        }
        // The bucket is still empty: 60 definitive rejections before a 429.
        for (let i = 1; i <= 60; i++) expect((await postMcp(ip, "ocv_wrong")).status).toBe(401);
        expect((await postMcp(ip, "ocv_wrong")).status).toBe(429);
    });

    it("valid credentials sharing one IP are not limited at 61, and are not charged to the IP", async () => {
        const ip = "198.51.100.20";
        for (let i = 1; i <= 65; i++) {
            expect((await postMcp(ip, "ocv_rate_a")).status, `a #${i}`).toBe(PASSED_AUTH);
            expect((await postMcp(ip, "ocv_rate_b")).status, `b #${i}`).toBe(PASSED_AUTH);
        }
        // 130 successes did not touch this IP's failure bucket.
        for (let i = 1; i <= 60; i++) expect((await postMcp(ip, "ocv_wrong")).status).toBe(401);
        expect((await postMcp(ip, "ocv_wrong")).status).toBe(429);
    });

    it("a credential trips its own limit at the configured threshold, others keep going", async () => {
        // ocv_rate_a has 65 requests this window; the limit is 70.
        for (let i = 66; i <= AUTHED_LIMIT; i++) {
            expect((await postMcp("198.51.100.30", "ocv_rate_a")).status, `a #${i}`).toBe(PASSED_AUTH);
        }
        const limited = await postMcp("198.51.100.31", "ocv_rate_a");
        expect(limited.status).toBe(429);
        expect(limited.headers.get("ratelimit-limit")).toBe(String(AUTHED_LIMIT));
        expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);

        expect((await postMcp("198.51.100.31", "ocv_rate_b")).status).toBe(PASSED_AUTH);
    });

    it("an admitted credential still works from an IP whose failure bucket is full", async () => {
        // 198.51.100.20 was exhausted by the previous test; ocv_rate_b is admitted.
        expect((await postMcp("198.51.100.20", "ocv_rate_b")).status).toBe(PASSED_AUTH);
    });

    it("the oauth-protected-resource route is charged to the IP bucket", async () => {
        const res = await realFetch(`http://127.0.0.1:${port}/.well-known/oauth-protected-resource`, {
            headers: { "X-Forwarded-For": "198.51.100.7" },
        });
        expect(res.status).toBe(429);
        expect(res.headers.get("retry-after")).toMatch(/^\d+$/);

        const fresh = await realFetch(`http://127.0.0.1:${port}/.well-known/oauth-protected-resource`, {
            headers: { "X-Forwarded-For": "198.51.100.9" },
        });
        expect(fresh.status).toBe(200);
        expect(fresh.headers.get("ratelimit-limit")).toBe("60");
        expect(((await fresh.json()) as { resource?: string }).resource).toMatch(/\/mcp$/);
    });
});
