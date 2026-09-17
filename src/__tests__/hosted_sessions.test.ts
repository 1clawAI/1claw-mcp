/**
 * Boots the real server (index.ts) in-process over HTTP streaming against a
 * fake vault, opens two sessions with different agents, and checks that each
 * sees only its own toolset — the merge gate for the toolset split.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { resolveToolsets, visibleToolNames, unknownEntitlements } from "../toolsets.js";

const VAULT = "https://vault.test";

type Flags = {
    intents_api_enabled: boolean;
    execution_intents_enabled: boolean;
    execution_require_tee: boolean;
    memory_enabled: boolean;
    cards_enabled: boolean;
};

const agents: Record<string, { id: string; flags: Flags }> = {
    ocv_a: {
        id: "0a0a0a0a-0000-4000-8000-00000000000a",
        flags: { intents_api_enabled: false, execution_intents_enabled: false, execution_require_tee: false, memory_enabled: false, cards_enabled: false },
    },
    ocv_b: {
        id: "0b0b0b0b-0000-4000-8000-00000000000b",
        flags: { intents_api_enabled: true, execution_intents_enabled: false, execution_require_tee: true, memory_enabled: true, cards_enabled: false },
    },
};

const counters = { exchanges: 0, profiles: 0, listSecrets: 0 };
let failNextListSecretsWith403 = false;

function jwt(payload: Record<string, unknown>): string {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${b64({ alg: "EdDSA", typ: "JWT" })}.${b64(payload)}.sig`;
}

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function fakeVault(url: URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname;

    if (method === "POST" && path === "/v1/auth/agent-token") {
        counters.exchanges++;
        const body = JSON.parse(String(init?.body ?? "{}")) as { api_key?: string };
        const a = agents[body.api_key ?? ""];
        if (!a) return json(401, { detail: "bad key" });
        return json(200, {
            access_token: jwt({
                sub: `agent:${a.id}`,
                org: "org-1",
                intents_api_enabled: a.flags.intents_api_enabled,
                execution_intents_enabled: a.flags.execution_intents_enabled,
                execution_require_tee: a.flags.execution_require_tee,
                exp: Math.floor(Date.now() / 1000) + 3600,
            }),
            token_type: "Bearer",
            expires_in: 3600,
            agent_id: a.id,
            vault_ids: ["vault-1"],
        });
    }

    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
        ?? (init?.headers as Record<string, string> | undefined)?.authorization ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    const sub = token ? (JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as { sub: string }).sub : "";
    const me = Object.values(agents).find((a) => `agent:${a.id}` === sub);

    if (method === "GET" && path === "/v1/vaults/vault-1") return json(200, { id: "vault-1", name: "default" });
    if (method === "GET" && path.startsWith("/v1/agents/")) {
        counters.profiles++;
        const id = path.slice("/v1/agents/".length);
        const a = Object.values(agents).find((x) => x.id === id);
        if (!a || !me || me.id !== a.id) return json(403, { detail: "Access denied" });
        return json(200, { id: a.id, name: "test", is_active: true, ...a.flags });
    }
    if (method === "GET" && path === "/v1/vaults/vault-1/secrets") {
        counters.listSecrets++;
        if (failNextListSecretsWith403) {
            failNextListSecretsWith403 = false;
            return json(403, { detail: "Insufficient permissions" });
        }
        return json(200, { secrets: [{ path: "a/b", type: "api_key", version: 1 }] });
    }
    return json(404, { detail: `no fake route for ${method} ${path}` });
}

async function freePort(): Promise<number> {
    return new Promise((resolve) => {
        const srv = createServer();
        srv.listen(0, "127.0.0.1", () => {
            const p = (srv.address() as { port: number }).port;
            srv.close(() => resolve(p));
        });
    });
}

let port: number;
let stop: () => Promise<void>;
const realFetch = globalThis.fetch;

async function connect(key: string, toolsets?: string) {
    const client = new Client({ name: "harness", version: "0.0.0" });
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
    if (toolsets) headers["X-1Claw-Toolsets"] = toolsets;
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        requestInit: { headers },
    });
    await client.connect(transport);
    return client;
}

const toolNames = async (c: Client) => (await c.listTools()).tools.map((t) => t.name).sort();

beforeAll(async () => {
    port = await freePort();
    process.env.MCP_TRANSPORT = "httpStream";
    process.env.PORT = String(port);
    process.env.ONECLAW_MCP_HOST = "127.0.0.1";
    process.env.ONECLAW_BASE_URL = VAULT;
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
});

describe("hosted sessions", () => {
    it("two agents in one process see disjoint, entitlement-shaped tool lists", async () => {
        const a = await connect("ocv_a");
        const b = await connect("ocv_b");

        const aTools = await toolNames(a);
        const bTools = await toolNames(b);

        const expectA = visibleToolNames(
            resolveToolsets({ ...unknownEntitlements("full"), agentId: agents.ocv_a.id }),
            { ...unknownEntitlements("full"), agentId: agents.ocv_a.id },
        ).sort();
        expect(aTools).toEqual(expectA);
        expect(aTools).toContain("get_secret");
        expect(aTools).not.toContain("sign_transaction");
        expect(aTools).not.toContain("put_memory");
        expect(aTools.some((n) => n.startsWith("platform_"))).toBe(false);
        expect(aTools).not.toContain("create_binding");

        expect(bTools).toContain("sign_transaction");
        expect(bTools).toContain("put_memory");
        // execution_require_tee: reads hidden, writes kept
        expect(bTools).not.toContain("get_secret");
        expect(bTools).not.toContain("resolve_env");
        expect(bTools).toContain("put_secret");
        expect(bTools).toContain("list_secrets");

        expect(bTools.filter((n) => !aTools.includes(n)).length).toBeGreaterThan(10);
        await a.close();
        await b.close();
    });

    it("a hidden tool cannot be called even by name", async () => {
        const a = await connect("ocv_a");
        await expect(a.callTool({ name: "sign_transaction", arguments: {} })).rejects.toThrow(/Unknown tool|not found|not available/i);
        await a.close();
    });

    it("reuses one client per session: repeated calls do not re-exchange the key", async () => {
        const b = await connect("ocv_b");
        const before = counters.exchanges;
        for (let i = 0; i < 3; i++) {
            const res = await b.callTool({ name: "list_secrets", arguments: {} });
            expect(JSON.stringify(res.content)).toContain("a/b");
        }
        expect(counters.exchanges - before).toBe(0);
        await b.close();
    });

    it("X-1Claw-Toolsets narrows, opts in, and cannot widen past entitlements", async () => {
        const a = await connect("ocv_a", "vault,automations,intents,admin");
        const names = await toolNames(a);
        expect(names).toContain("list_automations");
        expect(names).toContain("get_secret");
        expect(names).not.toContain("request_approval");
        expect(names).not.toContain("sign_transaction");
        expect(names).not.toContain("create_binding");
        await a.close();
    });

    it("a 403 from the vault re-resolves entitlements and pushes tools/list_changed", async () => {
        const a = await connect("ocv_a");
        let notified = 0;
        a.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
            notified++;
        });
        expect(await toolNames(a)).not.toContain("sign_transaction");

        // Operator flips the flag in the dashboard; the next refusal triggers a refresh.
        agents.ocv_a.flags.intents_api_enabled = true;
        failNextListSecretsWith403 = true;
        const refused = await a.callTool({ name: "list_secrets", arguments: {} });
        expect(refused.isError).toBe(true);
        expect(JSON.stringify(refused.content)).toMatch(/Insufficient permissions/);

        // The notification is sent over the session stream; give it a tick.
        for (let i = 0; i < 20 && notified === 0; i++) await new Promise((r) => setTimeout(r, 25));
        expect(notified).toBeGreaterThan(0);
        expect(await toolNames(a)).toContain("sign_transaction");

        agents.ocv_a.flags.intents_api_enabled = false;
        await a.close();
    });

    it("the vault://secrets resource is gated like list_secrets", async () => {
        const a = await connect("ocv_a", "inspect");
        const list = await a.listResources();
        expect(list.resources.map((r) => r.uri)).toContain("vault://secrets");
        await expect(a.readResource({ uri: "vault://secrets" })).rejects.toThrow(/not available/i);
        await a.close();
    });
});
