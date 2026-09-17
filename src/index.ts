#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FastMCP, UserError, type Tool, type ToolParameters } from "fastmcp";
import { z } from "zod";
import { OneClawClient, OneClawApiError } from "./client.js";
import { inspectContentTool } from "./tools/inspect_content.js";
import { inspectInput, inspectOutput, isSecurityEnabled, registerSecret, isSecretRedactionEnabled, clearSecrets } from "./security/index.js";
import { isLocalDaemonMode, createLocalClient } from "./local-client.js";
import { proxyRequestTool } from "./tools/proxy_request.js";
import {
    type SessionAuth,
    type SessionCredential,
    clientForSession,
    resolveEntitlements,
    attachEntitlements,
    refreshEntitlementsIfStale,
    describeSession,
} from "./core/session.js";
import { TOOLSET_MODULES } from "./toolsets/index.js";
import {
    type Entitlements,
    type ToolsetId,
    toolsetOf,
    toolVisible,
    resolveToolsets,
    unknownEntitlements,
    describeToolsets,
    TOOLSET_IDS,
} from "./toolsets.js";

const baseUrl = process.env.ONECLAW_BASE_URL ?? "https://api.1claw.co";
const transport = process.env.MCP_TRANSPORT ?? "stdio";
const port = parseInt(process.env.PORT ?? "8080", 10);

// When true, only security-inspection tools are registered (no vault credentials needed).
const localOnly =
    process.env.ONECLAW_LOCAL_ONLY === "true" ||
    process.env.ONECLAW_LOCAL_ONLY === "1";

/**
 * Credential for the stdio process, read from process.env. Re-read each
 * invocation so vault ID is not frozen at startup (C-MPC-VAULT); the client
 * built from it is cached per distinct credential so the ocv_ exchange
 * happens once per process, not once per call.
 */
function stdioCredentialFromEnv(): SessionCredential {
    const vaultId = process.env.ONECLAW_VAULT_ID;
    const agentId = process.env.ONECLAW_AGENT_ID;
    const agentApiKey = process.env.ONECLAW_AGENT_API_KEY;
    const token = process.env.ONECLAW_AGENT_TOKEN;

    if (agentApiKey) {
        return {
            agentApiKey,
            agentId: agentId || undefined,
            vaultId: vaultId || undefined,
            runtimeId: process.env.ONECLAW_RUNTIME_ID || undefined,
        };
    }
    if (token) {
        if (!vaultId) {
            throw new UserError(
                "ONECLAW_VAULT_ID is required when using ONECLAW_AGENT_TOKEN (static JWT).",
            );
        }
        return { token, vaultId, runtimeId: process.env.ONECLAW_RUNTIME_ID || undefined };
    }
    throw new UserError(
        "Authentication required. Set ONECLAW_AGENT_API_KEY or ONECLAW_AGENT_TOKEN + ONECLAW_VAULT_ID.",
    );
}

let stdioSession: { key: string; session: SessionAuth } | undefined;

/** The stdio process's session — one per distinct env credential. */
function stdioSessionFromEnv(): SessionAuth {
    const cred = stdioCredentialFromEnv();
    const key = JSON.stringify(cred);
    if (stdioSession && stdioSession.key === key) return stdioSession.session;
    // A changed env means a new identity; entitlements are re-resolved lazily
    // by the TTL path. Start from the startup snapshot when there is one.
    const ent = stdioSession?.session.entitlements ?? unknownEntitlements("failed");
    const session = attachEntitlements(cred, ent, process.env.ONECLAW_MCP_TOOLSETS, stdioSession ? 0 : Date.now());
    stdioSession = { key, session };
    return session;
}

if (transport === "stdio" && !localOnly && !isLocalDaemonMode()) {
    const agentApiKey = process.env.ONECLAW_AGENT_API_KEY;
    const token = process.env.ONECLAW_AGENT_TOKEN;
    if (!agentApiKey && !token) {
        console.error(
            "Authentication required. Set one of:\n" +
                "  ONECLAW_AGENT_API_KEY                      (simplest, auto-discovers agent ID and vault)\n" +
                "  ONECLAW_AGENT_ID + ONECLAW_AGENT_API_KEY   (explicit agent ID)\n" +
                "  ONECLAW_AGENT_TOKEN + ONECLAW_VAULT_ID     (static JWT, expires)\n" +
                "  ONECLAW_LOCAL_ONLY=true                    (security tools only, no vault needed)\n" +
                "  ONECLAW_LOCAL_VAULT=true                   (local daemon mode, no cloud auth needed)",
        );
        process.exit(1);
    }
    if (!agentApiKey && token && !process.env.ONECLAW_VAULT_ID) {
        console.error(
            "ONECLAW_VAULT_ID is required when using ONECLAW_AGENT_TOKEN (static JWT).",
        );
        process.exit(1);
    }
}

/** The session a tool call runs under: the hosted one, or the stdio process's. */
function resolveSession(session?: SessionAuth): SessionAuth {
    if (session) return session;
    if (transport === "stdio" && !localOnly) {
        return stdioSessionFromEnv();
    }
    throw new UserError(
        "Not authenticated. Provide Authorization header (Bearer <ocv_api_key> or Bearer <jwt>).",
    );
}

function resolveClient(session?: SessionAuth): OneClawClient {
    return clientForSession(resolveSession(session), baseUrl);
}

// ── Server setup ────────────────────────────────────

type ServerOpts = ConstructorParameters<typeof FastMCP<SessionAuth>>[0];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as { version: string };

const serverOpts: ServerOpts = {
    name: "1claw",
    version: pkg.version as `${number}.${number}.${number}`,
    health: { enabled: true, path: "/health" },
    instructions:
        "Tools are grouped into toolsets and only the toolsets this session is entitled to are listed " +
        `(${TOOLSET_IDS.filter((t) => t !== "local" && t !== "platform").join(", ")}). ` +
        "The vault, approvals and inspect toolsets are always on for an agent; intents, execute, cards, " +
        "memory, channels and directory appear when the agent's flags enable them; treasury, delegation, chat, " +
        "automations, runtimes and notification are opt-in via the X-1Claw-Toolsets header " +
        "(or ONECLAW_MCP_TOOLSETS over stdio). Entitlements are re-checked periodically and after a 403, and " +
        "the list is refreshed via notifications/tools/list_changed. If a tool you expect is missing, the " +
        "agent is not entitled to it — check the agent's settings in the 1Claw dashboard.",
};

if (transport === "httpStream") {
    // The HTTP layer (mcp-proxy) calls `authenticate` on EVERY POST, not once
    // per MCP session, and swaps the result into the session via
    // `updateAuth`. Without memoisation that is a key exchange + vault probe
    // + profile GET per tool call, and a fresh SessionAuth object each time
    // (so nothing keyed on it could ever be reused). Admissions are cached by
    // credential for ADMISSION_TTL_MS and the *same* SessionAuth object is
    // handed back, which is what makes the per-session client cache and the
    // entitlement snapshot actually per session.
    const ADMISSION_TTL_MS = 10 * 60 * 1000;
    const ADMISSION_IDLE_MS = 60 * 60 * 1000;
    type Admission = { session: SessionAuth; validatedAt: number; lastSeen: number };
    const admissions = new Map<string, Admission>();
    const admissionSweep = setInterval(() => {
        const now = Date.now();
        for (const [k, a] of admissions) if (now - a.lastSeen > ADMISSION_IDLE_MS) admissions.delete(k);
    }, 5 * 60 * 1000);
    if (typeof admissionSweep === "object" && "unref" in admissionSweep) admissionSweep.unref();

    const admissionKey = (...parts: string[]): string =>
        createHash("sha256").update(parts.join("\u0000")).digest("hex");

    const authenticateUncached = async (
        request: http.IncomingMessage,
        existing?: SessionAuth,
    ): Promise<SessionAuth> => {
        const auth = (request.headers["authorization"] ?? "") as string;
        const credential = auth.replace(/^Bearer\s+/i, "").trim();
        const vaultIdHeader = (request.headers["x-vault-id"] ?? "") as string;
        const agentIdHeader = (request.headers["x-agent-id"] ?? "") as string;
        const runtimeIdHeader = (request.headers["x-1claw-runtime-id"] ??
            request.headers["X-1Claw-Runtime-Id"] ??
            "") as string;
        const toolsetHeader = (request.headers["x-1claw-toolsets"] ?? "") as string;

        // Resolve entitlements once, at admission. `canAccess` on every tool
        // reads the snapshot synchronously; the TTL/403 paths refresh it.
        // A re-validation of a cached admission keeps the existing object.
        const admit = async (cred: SessionCredential): Promise<SessionAuth> => {
            if (existing) return existing;
            const client = clientForSession(cred, baseUrl);
            const ent = await resolveEntitlements(client, {
                warn: (m) => console.warn(`[1claw-mcp] ${m}`),
            });
            const session = attachEntitlements(cred, ent, toolsetHeader || undefined);
            console.log(`[1claw-mcp] session admitted: ${describeSession(session)}`);
            return session;
        };

        const runtimeIdFromJwtPayload = (token: string): string | undefined => {
            try {
                const parts = token.split(".");
                if (parts.length !== 3) return undefined;
                const payload = JSON.parse(
                    Buffer.from(
                        parts[1].replace(/-/g, "+").replace(/_/g, "/"),
                        "base64",
                    ).toString(),
                ) as { runtime_id?: string };
                return typeof payload.runtime_id === "string" &&
                    payload.runtime_id.length > 0
                    ? payload.runtime_id
                    : undefined;
            } catch {
                return undefined;
            }
        };

        const vaultAuthHeaders = (
            token: string,
            runtimeId?: string,
        ): Record<string, string> => {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${token}`,
            };
            if (runtimeId) {
                headers["X-1Claw-Runtime-Id"] = runtimeId;
            }
            return headers;
        };

        if (!credential)
            throw new Error(
                "Missing Authorization header (Bearer <ocv_api_key> or Bearer <jwt>)",
            );

        // SEC-005: Only accept agent API keys (ocv_). Reject human and platform keys.
        if (credential.startsWith("1ck_")) {
            throw new Error(
                "MCP server only accepts agent API keys (ocv_). Human API keys (1ck_) should use the SDK or dashboard.",
            );
        }
        if (credential.startsWith("plt_")) {
            throw new Error(
                "MCP server only accepts agent API keys (ocv_). Platform API keys (plt_) should use the SDK.",
            );
        }

        // ── API key path: exchange for JWT, auto-discover vault ──
        if (credential.startsWith("ocv_")) {
            const body: Record<string, string> = { api_key: credential };
            if (agentIdHeader) body.agent_id = agentIdHeader;

            const tokenRes = await fetch(`${baseUrl}/v1/auth/agent-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!tokenRes.ok) {
                const status = tokenRes.status;
                let detail = `HTTP ${status}`;
                try {
                    const errBody = await tokenRes.json() as { detail?: string };
                    if (errBody.detail) detail = errBody.detail;
                } catch { /* use default */ }
                throw new Error(`Agent API key auth failed: ${detail}`);
            }

            const data = await tokenRes.json() as {
                access_token: string;
                agent_id?: string;
                vault_ids?: string[];
            };

            const resolvedVaultId =
                vaultIdHeader ||
                (data.vault_ids && data.vault_ids.length === 1
                    ? data.vault_ids[0]
                    : "");

            if (resolvedVaultId && data.access_token) {
                const checkRes = await fetch(
                    `${baseUrl}/v1/vaults/${resolvedVaultId}`,
                    {
                        headers: vaultAuthHeaders(
                            data.access_token,
                            runtimeIdHeader || undefined,
                        ),
                    },
                );
                if (!checkRes.ok && checkRes.status === 404) {
                    throw new Error(`Vault ${resolvedVaultId} not found`);
                }
            }

            return admit({
                agentApiKey: credential,
                agentId: data.agent_id || agentIdHeader || undefined,
                vaultId: resolvedVaultId || undefined,
                runtimeId: runtimeIdHeader || undefined,
            });
        }

        // ── JWT path (legacy): static token, requires X-Vault-ID ──
        if (!vaultIdHeader)
            throw new Error(
                "Missing X-Vault-ID header (required when using a JWT; use an ocv_ API key instead for auto-discovery)",
            );

        // SEC-005: Verify the JWT belongs to an agent (sub starts with "agent:")
        try {
            const parts = credential.split(".");
            if (parts.length === 3) {
                const payload = JSON.parse(
                    Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
                );
                if (payload.sub && typeof payload.sub === "string" && !payload.sub.startsWith("agent:")) {
                    throw new Error(
                        "MCP server only accepts agent JWTs. This token belongs to a non-agent principal.",
                    );
                }
            }
        } catch (e) {
            if (e instanceof Error && e.message.includes("MCP server only accepts")) throw e;
        }

        // H-9: Validate token against the vault API (not just pass-through).
        const runtimeId =
            runtimeIdHeader || runtimeIdFromJwtPayload(credential) || undefined;
        const validationRes = await fetch(`${baseUrl}/v1/vaults/${vaultIdHeader}`, {
            headers: vaultAuthHeaders(credential, runtimeId),
        });
        if (!validationRes.ok) {
            const status = validationRes.status;
            if (status === 401) {
                throw new Error("Invalid or expired Bearer token");
            }
            if (status === 403) {
                throw new Error(
                    "X-Vault-ID is not accessible with this token (vault binding mismatch)",
                );
            }
            if (status === 404) {
                throw new Error(`Vault ${vaultIdHeader} not found`);
            }
            throw new Error(
                `Token validation failed (HTTP ${status})`,
            );
        }

        return admit({ token: credential, vaultId: vaultIdHeader, runtimeId });
    };

    serverOpts.authenticate = async (request: http.IncomingMessage): Promise<SessionAuth> => {
        const h = (name: string) => ((request.headers[name] ?? "") as string);
        const key = admissionKey(
            h("authorization"), h("x-vault-id"), h("x-agent-id"), h("x-1claw-runtime-id"), h("x-1claw-toolsets"),
        );
        const now = Date.now();
        const hit = admissions.get(key);
        if (hit && now - hit.validatedAt < ADMISSION_TTL_MS) {
            hit.lastSeen = now;
            return hit.session;
        }
        try {
            // Past the TTL the credential is proven again (exchange + vault
            // probe) but the session object — client, entitlements — survives.
            const session = await authenticateUncached(request, hit?.session);
            admissions.set(key, { session, validatedAt: now, lastSeen: now });
            return session;
        } catch (err) {
            admissions.delete(key);
            throw err;
        }
    };
}

const server = new FastMCP<SessionAuth>(serverOpts);

// ── Session admission for stdio ─────────────────────
// Hosted sessions are filtered per session via `canAccess`; stdio has no
// auth object for FastMCP to filter on, so the toolset is decided once here
// and only the visible tools are registered. Restart to pick up flag changes.

let stdioVisible: ((name: string) => boolean) | undefined;
if (transport === "stdio" && !localOnly && !isLocalDaemonMode()) {
    const session = stdioSessionFromEnv();
    const ent = await resolveEntitlements(clientForSession(session, baseUrl), {
        warn: (m) => console.error(`[1claw-mcp] ${m}`),
    });
    attachEntitlements(session, ent, process.env.ONECLAW_MCP_TOOLSETS);
    console.error(`[1claw-mcp] ${describeSession(session)}`);
    stdioVisible = (name) => toolVisible(name, session.toolsets, session.entitlements);
}

/** Every tool handed to `server.addTool`, in order — needed to re-filter a session. */
const registeredTools: Tool<SessionAuth>[] = [];

function addTool<P extends ToolParameters>(tool: Tool<SessionAuth, P>): void {
    registeredTools.push(tool as unknown as Tool<SessionAuth>);
    server.addTool(tool);
}

/** Toolset selection for a session that somehow reached a tool without one. */
function sessionToolsets(auth: SessionAuth): { toolsets: Set<ToolsetId>; entitlements: Entitlements } {
    if (auth.toolsets && auth.entitlements) return { toolsets: auth.toolsets, entitlements: auth.entitlements };
    const entitlements = unknownEntitlements("failed");
    return { toolsets: resolveToolsets(entitlements), entitlements };
}

/**
 * Tell one session its tool list changed. FastMCP re-applies `canAccess`
 * against the session's (now mutated) auth and sends
 * `notifications/tools/list_changed`. Falls back to a server-wide
 * rebroadcast when the session can't be found.
 */
function notifyToolsChanged(sessionId?: string): void {
    const target = sessionId
        ? server.sessions.find((s) => s.sessionId === sessionId)
        : undefined;
    if (target) {
        target.toolsListChanged(registeredTools);
    } else {
        // No-op removal: FastMCP re-filters every session and notifies each.
        server.removeTool("__entitlements_refresh__");
    }
}

/**
 * Re-resolve a session's entitlements when stale (or forced after a 403).
 * Returns true when the visible tool list changed, having already notified.
 */
async function refreshSession(
    session: SessionAuth,
    sessionId: string | undefined,
    force: boolean,
    log: (msg: string) => void,
): Promise<boolean> {
    const changed = await refreshEntitlementsIfStale(session, clientForSession(session, baseUrl), {
        force,
        warn: (m) => log(`[1claw-mcp] ${m}`),
    });
    if (changed) {
        log(`[1claw-mcp] entitlements changed: ${describeSession(session)}`);
        if (transport === "httpStream") notifyToolsChanged(sessionId);
    }
    return changed;
}

// ── Tool registration helper ────────────────────────
// Each tool factory closes over a client. We intercept execute to
// resolve the correct per-session client at invocation time.

type AnyToolFactory = (client: OneClawClient) => {
    name: string;
    description: string;
    parameters: z.ZodTypeAny;
    execute: (args: never, ctx: never) => Promise<string>;
};

function registerTool(factory: AnyToolFactory) {
    const proto = factory(
        new OneClawClient({ baseUrl, token: "", vaultId: "" }),
    );
    // Fails loudly for a tool nobody assigned to a toolset.
    toolsetOf(proto.name);
    if (stdioVisible && !stdioVisible(proto.name)) return;

    addTool({
        name: proto.name,
        description: proto.description,
        parameters: proto.parameters,
        canAccess: (auth: SessionAuth) => {
            const { toolsets, entitlements } = sessionToolsets(auth);
            return toolVisible(proto.name, toolsets, entitlements);
        },
        execute: async (
            args: Record<string, unknown>,
            context: {
                session?: SessionAuth;
                sessionId?: string;
                log: { info: (msg: string) => void; warn: (msg: string) => void };
            },
        ) => {
            const session = resolveSession(context.session);

            // Hosted sessions outlive the flags they were admitted with.
            await refreshSession(session, context.sessionId, false, context.log.warn);
            if (!toolVisible(proto.name, session.toolsets, session.entitlements)) {
                throw new UserError(
                    `Tool '${proto.name}' is not available to this session (toolset ` +
                        `'${toolsetOf(proto.name)}' not entitled). Refresh the tool list.`,
                );
            }

            // SEC-004: secret matching is scoped per agent so two agents on one
            // vault never share a redaction bucket. Vault-scoped is the
            // degraded state, logged so it is visible.
            const sessionScope =
                session.entitlements.agentId ??
                ("agentId" in session ? session.agentId : undefined) ??
                session.vaultId;
            if (sessionScope && sessionScope === session.vaultId && !session.entitlements.agentId) {
                context.log.warn(
                    `[1claw-mcp] secret scope degraded to vault ${session.vaultId}: agent id unknown`,
                );
            }

            // Security inspection of input
            if (isSecurityEnabled()) {
                const inputCheck = inspectInput(proto.name, args, sessionScope);
                if (!inputCheck.passed) {
                    const threat = inputCheck.threats[0];
                    context.log.info(`[SECURITY] Blocked ${proto.name}: ${threat?.type} (${threat?.pattern})`);
                    throw new UserError(`Security check failed: ${threat?.type} detected`);
                }
                if (inputCheck.threats.length > 0) {
                    context.log.info(`[SECURITY] Warnings for ${proto.name}: ${inputCheck.threats.map(t => t.pattern).join(", ")}`);
                }
            }
            
            const client = clientForSession(session, baseUrl);
            const tool = factory(client);
            let result: string;
            try {
                result = await (
                    tool.execute as (a: unknown, c: unknown) => Promise<string>
                )(args, context);
            } catch (err) {
                // The vault said no to something we thought was entitled:
                // re-resolve now rather than waiting out the TTL.
                if (err instanceof OneClawApiError && err.status === 403) {
                    await refreshSession(session, context.sessionId, true, context.log.warn).catch(() => false);
                }
                throw err;
            }
            
            // Track secret values for redaction and exfiltration protection
            if (isSecretRedactionEnabled()) {
                if (proto.name === "get_secret") {
                    try {
                        const parsed = JSON.parse(result);
                        if (parsed.value && parsed.path) registerSecret(parsed.path, parsed.value, sessionScope);
                    } catch { /* not JSON — skip */ }
                }
                if (proto.name === "get_env_bundle") {
                    try {
                        const env = JSON.parse(result);
                        for (const [key, val] of Object.entries(env)) {
                            if (typeof val === "string") registerSecret(`env:${key}`, val, sessionScope);
                        }
                    } catch { /* not JSON — skip */ }
                }
                if (proto.name === "resolve_env") {
                    try {
                        const parsed = JSON.parse(result) as { vars?: Record<string, unknown> };
                        for (const [key, val] of Object.entries(parsed.vars ?? {})) {
                            if (typeof val === "string") registerSecret(`env:${key}`, val, sessionScope);
                        }
                    } catch { /* not JSON — skip */ }
                }
            }
            
            // Security inspection of output (redacts secrets, detects PII, logs threats)
            if (isSecurityEnabled()) {
                const outputCheck = inspectOutput(proto.name, result, sessionScope);
                if (outputCheck.threats.length > 0) {
                    context.log.info(`[SECURITY] Output warnings for ${proto.name}: ${outputCheck.threats.map(t => t.pattern).join(", ")}`);
                }
                if (outputCheck.redacted) {
                    context.log.info(`[SECURITY] Redacted secret values from ${proto.name} output`);
                    return outputCheck.redacted;
                }
            }
            
            return result;
        },
    });
}

// ── Security-only tools (always available, including local-only mode) ─

{
    const tool = inspectContentTool();
    toolsetOf(tool.name);
    addTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: async (
            args: Record<string, unknown>,
            context: { session?: SessionAuth; log: { info: (msg: string) => void } },
        ) => {
            return (tool.execute as (a: unknown, c: unknown) => Promise<string>)(args, context);
        },
    });
}

// ── Local daemon tools (available when ONECLAW_LOCAL_VAULT=true) ──

if (isLocalDaemonMode()) {
    const localClient = createLocalClient();
    const proxyTool = proxyRequestTool(localClient);
    server.addTool({
        name: proxyTool.name,
        description: proxyTool.description,
        parameters: proxyTool.parameters,
        execute: async (
            args: Record<string, unknown>,
            context: { session?: SessionAuth; log: { info: (msg: string) => void } },
        ) => {
            return (proxyTool.execute as (a: unknown, c: unknown) => Promise<string>)(args, context);
        },
    });

    // In local mode, list_secrets uses the daemon (shows names only, no values)
    server.addTool({
        name: "list_secrets",
        description:
            "List secret names in the local vault. Values are never exposed. " +
            "Use proxy_request to make API calls with secrets injected.",
        parameters: z.object({}),
        execute: async (
            _args: Record<string, unknown>,
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const result = await localClient.listSecrets();
            log.info(`Listed ${result.secrets.length} local secrets`);
            return JSON.stringify(result.secrets);
        },
    });
}

// ── Vault tools (require credentials — skipped in local-only mode) ─
// Each toolset module under src/toolsets/ owns its tool list; registration
// walks them in order. `canAccess` / the stdio filter decide visibility.

if (!localOnly && !isLocalDaemonMode()) {
    for (const module of TOOLSET_MODULES) {
        for (const factory of module.tools) registerTool(factory as AnyToolFactory);
    }
}


// ── Resource: browsable secret listing ───────────────

if (!localOnly) {
server.addResource({
    uri: "vault://secrets",
    name: "Vault secrets",
    description:
        "Browsable listing of all secret paths in the configured vault (metadata only, no values).",
    mimeType: "application/json",
    async load(auth?: SessionAuth) {
        // Same gate as list_secrets: resources are not filtered by canAccess.
        const session = resolveSession(auth);
        if (!toolVisible("list_secrets", session.toolsets, session.entitlements)) {
            throw new UserError("vault://secrets is not available to this session (vault toolset not entitled).");
        }
        const client = resolveClient(auth);
        const data = await client.listSecrets();
        return {
            text: JSON.stringify(
                data.secrets.map((s) => ({
                    path: s.path,
                    type: s.type,
                    version: s.version,
                    expires_at: s.expires_at,
                })),
                null,
                2,
            ),
        };
    },
});
} // end if (!localOnly) — resource

// ── Rate limiting (httpStream only) ──────────────────

if (transport === "httpStream") {
    const RATE_LIMIT_WINDOW_MS = 60_000;
    const RATE_LIMIT_MAX = 60;

    const hits = new Map<string, { count: number; resetAt: number }>();

    // Periodic sweep to prevent unbounded growth
    const sweepTimer = setInterval(() => {
        const now = Date.now();
        for (const [ip, bucket] of hits) {
            if (now >= bucket.resetAt) hits.delete(ip);
        }
    }, RATE_LIMIT_WINDOW_MS);
    if (typeof sweepTimer === "object" && "unref" in sweepTimer) {
        sweepTimer.unref();
    }

    const app = server.getApp();

    app.get("/.well-known/oauth-protected-resource", (c) => {
        const resource =
            process.env.ONECLAW_MCP_RESOURCE_URL ??
            `${process.env.ONECLAW_PUBLIC_MCP_URL ?? "https://mcp.1claw.co"}/mcp`;
        return c.json({
            resource,
            authorization_servers: [
                process.env.ONECLAW_BASE_URL ?? "https://api.1claw.co",
            ],
            bearer_methods_supported: ["header"],
            scopes_supported: ["openid", "profile", "email"],
        });
    });

    app.use("*", async (c, next) => {
        // L2: Use rightmost XFF entry (closest to the trusted edge proxy)
        const xff = c.req.header("x-forwarded-for");
        const ip =
            (xff ? xff.split(",").pop()?.trim() : undefined) ||
            c.req.header("x-real-ip") ||
            "unknown";

        const now = Date.now();
        let bucket = hits.get(ip);
        if (!bucket || now >= bucket.resetAt) {
            bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
            hits.set(ip, bucket);
        }
        bucket.count++;

        c.header("RateLimit-Limit", String(RATE_LIMIT_MAX));
        c.header("RateLimit-Remaining", String(Math.max(0, RATE_LIMIT_MAX - bucket.count)));
        c.header("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

        if (bucket.count > RATE_LIMIT_MAX) {
            return c.json({ error: "Too many requests, please try again later." }, 429);
        }

        await next();
    });
}

// ── Start ────────────────────────────────────────────

/** Handle for the in-process test harness (`hosted_sessions.test.ts`). */
export const started: Promise<void> = (async () => {
if (transport === "httpStream") {
    await server.start({
        transportType: "httpStream",
        httpStream: { port, host: process.env.ONECLAW_MCP_HOST ?? "0.0.0.0" },
    });
    console.log(`1claw MCP server listening on port ${port} (HTTP streaming)${localOnly ? " [local-only mode]" : ""}`);
} else {
    await server.start({ transportType: "stdio" });
    if (localOnly) {
        console.error("1claw MCP server started in local-only mode (security tools only, no vault credentials required)");
    }
}
})();

export { server };
