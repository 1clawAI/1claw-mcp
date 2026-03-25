#!/usr/bin/env node

import http from "node:http";
import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";
import { OneClawClient, OneClawApiError } from "./client.js";
import { listSecretsTool } from "./tools/list_secrets.js";
import { getSecretTool } from "./tools/get_secret.js";
import { putSecretTool } from "./tools/put_secret.js";
import { deleteSecretTool } from "./tools/delete_secret.js";
import { describeSecretTool } from "./tools/describe_secret.js";
import { createVaultTool } from "./tools/create_vault.js";
import { listVaultsTool } from "./tools/list_vaults.js";
import { grantAccessTool } from "./tools/grant_access.js";
import { shareSecretTool } from "./tools/share_secret.js";
import { simulateTransactionTool } from "./tools/simulate_transaction.js";
import { submitTransactionTool } from "./tools/submit_transaction.js";
import { signTransactionTool } from "./tools/sign_transaction.js";
import { listTransactionsTool } from "./tools/list_transactions.js";
import { getTransactionTool } from "./tools/get_transaction.js";
import { inspectContentTool } from "./tools/inspect_content.js";
import { inspectInput, inspectOutput, isSecurityEnabled, registerSecret, isSecretRedactionEnabled } from "./security/index.js";

type SessionAuth = { token: string; vaultId: string };

const baseUrl = process.env.ONECLAW_BASE_URL ?? "https://api.1claw.xyz";
const transport = process.env.MCP_TRANSPORT ?? "stdio";
const port = parseInt(process.env.PORT ?? "8080", 10);

// When true, only security-inspection tools are registered (no vault credentials needed).
const localOnly =
    process.env.ONECLAW_LOCAL_ONLY === "true" ||
    process.env.ONECLAW_LOCAL_ONLY === "1";

// ── Shared client (stdio mode) ──────────────────────

let sharedClient: OneClawClient | undefined;

if (transport === "stdio" && !localOnly) {
    const vaultId = process.env.ONECLAW_VAULT_ID;
    const agentId = process.env.ONECLAW_AGENT_ID;
    const agentApiKey = process.env.ONECLAW_AGENT_API_KEY;
    const token = process.env.ONECLAW_AGENT_TOKEN;

    if (agentApiKey) {
        // Key-only auth: agent_id and vault_id are auto-discovered from the token exchange
        sharedClient = new OneClawClient({
            baseUrl,
            agentId: agentId || undefined,
            apiKey: agentApiKey,
            vaultId: vaultId || undefined,
        });
    } else if (token) {
        if (!vaultId) {
            console.error(
                "ONECLAW_VAULT_ID is required when using ONECLAW_AGENT_TOKEN (static JWT).",
            );
            process.exit(1);
        }
        sharedClient = new OneClawClient({ baseUrl, token, vaultId });
    } else {
        console.error(
            "Authentication required. Set one of:\n" +
                "  ONECLAW_AGENT_API_KEY                      (simplest, auto-discovers agent ID and vault)\n" +
                "  ONECLAW_AGENT_ID + ONECLAW_AGENT_API_KEY   (explicit agent ID)\n" +
                "  ONECLAW_AGENT_TOKEN + ONECLAW_VAULT_ID     (static JWT, expires)\n" +
                "  ONECLAW_LOCAL_ONLY=true                    (security tools only, no vault needed)",
        );
        process.exit(1);
    }
}

function resolveClient(session?: SessionAuth): OneClawClient {
    if (session) {
        return new OneClawClient({
            baseUrl,
            token: session.token,
            vaultId: session.vaultId,
        });
    }
    if (sharedClient) return sharedClient;
    throw new UserError(
        "Not authenticated. Provide Authorization and X-Vault-ID headers.",
    );
}

// ── Server setup ────────────────────────────────────

type ServerOpts = ConstructorParameters<typeof FastMCP<SessionAuth>>[0];

const serverOpts: ServerOpts = {
    name: "1claw",
    version: "0.17.0",
    health: { enabled: true, path: "/health" },
};

if (transport === "httpStream") {
    serverOpts.authenticate = async (
        request: http.IncomingMessage,
    ): Promise<SessionAuth> => {
        const auth = (request.headers["authorization"] ?? "") as string;
        const token = auth.replace(/^Bearer\s+/i, "").trim();
        const vaultId = (request.headers["x-vault-id"] ?? "") as string;

        if (!token)
            throw new Error(
                "Missing Authorization header (Bearer <agent-token>)",
            );
        if (!vaultId) throw new Error("Missing X-Vault-ID header");

        // H-9: Validate token against the vault API (not just pass-through).
        // Calls GET /v1/vaults to confirm the token is valid. An invalid or
        // expired token will fail with 401, rejecting the session early.
        const validationRes = await fetch(`${baseUrl}/v1/vaults/${vaultId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!validationRes.ok) {
            const status = validationRes.status;
            if (status === 401) {
                throw new Error("Invalid or expired Bearer token");
            }
            if (status === 403) {
                // H-10: The token's vault_ids claim doesn't include this vault
                throw new Error(
                    "X-Vault-ID is not accessible with this token (vault binding mismatch)",
                );
            }
            if (status === 404) {
                throw new Error(`Vault ${vaultId} not found`);
            }
            throw new Error(
                `Token validation failed (HTTP ${status})`,
            );
        }

        return { token, vaultId };
    };
}

const server = new FastMCP<SessionAuth>(serverOpts);

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
        sharedClient ?? new OneClawClient({ baseUrl, token: "", vaultId: "" }),
    );
    server.addTool({
        name: proto.name,
        description: proto.description,
        parameters: proto.parameters,
        execute: async (
            args: Record<string, unknown>,
            context: {
                session?: SessionAuth;
                log: { info: (msg: string) => void };
            },
        ) => {
            // Security inspection of input
            if (isSecurityEnabled()) {
                const inputCheck = inspectInput(proto.name, args);
                if (!inputCheck.passed) {
                    const threat = inputCheck.threats[0];
                    context.log.info(`[SECURITY] Blocked ${proto.name}: ${threat?.type} (${threat?.pattern})`);
                    throw new UserError(`Security check failed: ${threat?.type} detected`);
                }
                if (inputCheck.threats.length > 0) {
                    context.log.info(`[SECURITY] Warnings for ${proto.name}: ${inputCheck.threats.map(t => t.pattern).join(", ")}`);
                }
            }
            
            const client = resolveClient(context.session);
            const tool = factory(client);
            const result = await (
                tool.execute as (a: unknown, c: unknown) => Promise<string>
            )(args, context);
            
            // Track secret values for redaction and exfiltration protection
            if (isSecretRedactionEnabled()) {
                if (proto.name === "get_secret") {
                    try {
                        const parsed = JSON.parse(result);
                        if (parsed.value && parsed.path) registerSecret(parsed.path, parsed.value);
                    } catch { /* not JSON — skip */ }
                }
                if (proto.name === "get_env_bundle") {
                    try {
                        const env = JSON.parse(result);
                        for (const [key, val] of Object.entries(env)) {
                            if (typeof val === "string") registerSecret(`env:${key}`, val);
                        }
                    } catch { /* not JSON — skip */ }
                }
            }
            
            // Security inspection of output (redacts secrets, detects PII, logs threats)
            if (isSecurityEnabled()) {
                const outputCheck = inspectOutput(proto.name, result);
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
    server.addTool({
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

// ── Vault tools (require credentials — skipped in local-only mode) ─

if (!localOnly) {
    registerTool(listSecretsTool as AnyToolFactory);
    registerTool(getSecretTool as AnyToolFactory);
    registerTool(putSecretTool as AnyToolFactory);
    registerTool(deleteSecretTool as AnyToolFactory);
    registerTool(describeSecretTool as AnyToolFactory);
    registerTool(createVaultTool as AnyToolFactory);
    registerTool(listVaultsTool as AnyToolFactory);
    registerTool(grantAccessTool as AnyToolFactory);
    registerTool(shareSecretTool as AnyToolFactory);
    registerTool(simulateTransactionTool as AnyToolFactory);
    registerTool(submitTransactionTool as AnyToolFactory);
    registerTool(signTransactionTool as AnyToolFactory);
    registerTool(listTransactionsTool as AnyToolFactory);
    registerTool(getTransactionTool as AnyToolFactory);
}

// ── Vault-dependent stretch tools + resource ─────────

if (!localOnly) {

const rotateAndStoreTool = (client: OneClawClient) => ({
    name: "rotate_and_store",
    description:
        "Store a new value for an existing secret (creating a new version) and return the version number. Useful when an agent has regenerated an API key and needs to persist it.",
    parameters: z.object({
        path: z.string().min(1).describe("Secret path to rotate"),
        value: z.string().min(1).describe("The new secret value"),
    }),
    execute: async (
        args: { path: string; value: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        const result = await client.putSecret(args.path, {
            value: args.value,
            type: "api_key",
        });
        context.log.info(`secret rotated: ${args.path}`);
        return `Rotated secret at '${args.path}'. New version: ${result.version}.`;
    },
});
registerTool(rotateAndStoreTool as AnyToolFactory);

// ── Stretch: get_env_bundle ──────────────────────────
// Registered via registerTool so input/output go through security inspection.

const getEnvBundleTool = (client: OneClawClient) => ({
    name: "get_env_bundle",
    description:
        "Fetch a secret of type env_bundle, parse its KEY=VALUE lines, and return a structured JSON object. Useful for injecting environment variables into subprocesses.",
    parameters: z.object({
        path: z.string().min(1).describe("Path to an env_bundle secret"),
    }),
    execute: async (
        args: { path: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        try {
            const secret = await client.getSecret(args.path);
            context.log.info(`env_bundle accessed: ${args.path}`);

            if (secret.type !== "env_bundle") {
                throw new UserError(
                    `Secret at '${args.path}' is type '${secret.type}', not 'env_bundle'.`,
                );
            }

            const env: Record<string, string> = {};
            for (const line of secret.value.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) continue;
                const eqIdx = trimmed.indexOf("=");
                if (eqIdx === -1) continue;
                env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
            }

            return JSON.stringify(env, null, 2);
        } catch (err) {
            if (err instanceof OneClawApiError) {
                if (err.status === 410) {
                    throw new UserError(
                        `Secret at path '${args.path}' is expired or has exceeded its maximum access count.`,
                    );
                }
                if (err.status === 404) {
                    throw new UserError(
                        `No secret found at path '${args.path}'.`,
                    );
                }
            }
            throw err;
        }
    },
});
registerTool(getEnvBundleTool as AnyToolFactory);

} // end if (!localOnly) — stretch tools

// ── Resource: browsable secret listing ───────────────

if (!localOnly) {
server.addResource({
    uri: "vault://secrets",
    name: "Vault secrets",
    description:
        "Browsable listing of all secret paths in the configured vault (metadata only, no values).",
    mimeType: "application/json",
    async load(auth?: SessionAuth) {
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

// ── Start ────────────────────────────────────────────

if (transport === "httpStream") {
    server.start({
        transportType: "httpStream",
        httpStream: { port, host: "0.0.0.0" },
    });
    console.log(`1claw MCP server listening on port ${port} (HTTP streaming)${localOnly ? " [local-only mode]" : ""}`);
} else {
    server.start({ transportType: "stdio" });
    if (localOnly) {
        console.error("1claw MCP server started in local-only mode (security tools only, no vault credentials required)");
    }
}
