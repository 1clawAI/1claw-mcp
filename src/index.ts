#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FastMCP, UserError, type Tool, type ToolParameters } from "fastmcp";
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
import { simulateBundleTool } from "./tools/simulate_bundle.js";
import { submitTransactionTool } from "./tools/submit_transaction.js";
import { signTransactionTool } from "./tools/sign_transaction.js";
import { listTransactionsTool } from "./tools/list_transactions.js";
import { getTransactionTool } from "./tools/get_transaction.js";
import { provisionSigningKeyTool } from "./tools/provision_signing_key.js";
import { listSigningKeysTool } from "./tools/list_signing_keys.js";
import { signMessageTool } from "./tools/sign_message.js";
import { signTypedDataTool } from "./tools/sign_typed_data.js";
import { signDigestTool } from "./tools/sign_digest.js";
import { leaseBankrKeyTool } from "./tools/lease_bankr_key.js";
import { orderCardTool, orderGiftCardTool } from "./tools/order_card.js";
import {
    listCardsTool,
    getCardStatusTool,
    searchGiftCardsTool,
} from "./tools/list_cards.js";
import { getSigningKeyBalanceTool } from "./tools/get_signing_key_balance.js";
import { inspectContentTool } from "./tools/inspect_content.js";
import { platformListAppsTool } from "./tools/platform_list_apps.js";
import { platformCreateAppTool } from "./tools/platform_create_app.js";
import { platformBootstrapUserTool } from "./tools/platform_bootstrap_user.js";
import { platformReissueClaimTool } from "./tools/platform_reissue_claim.js";
import { platformRotateKeyTool } from "./tools/platform_rotate_key.js";
import { platformListTemplatesTool } from "./tools/platform_list_templates.js";
import {
    listDirectoryJobsTool,
    getDirectoryJobTool,
    submitDirectoryJobBidTool,
} from "./tools/directory_jobs.js";
import {
    platformGetFleetTool,
    platformListFleetAgentsTool,
    platformPlanFleetRolloutTool,
} from "./tools/platform_fleet.js";
import { platformCreateTemplateTool } from "./tools/platform_create_template.js";
import { platformListUsersTool } from "./tools/platform_list_users.js";
import { platformGrantAccessTool } from "./tools/platform_grant_access.js";
import { platformListGrantsTool } from "./tools/platform_list_grants.js";
import { listApprovalsTool } from "./tools/list_approvals.js";
import { getApprovalTool } from "./tools/get_approval.js";
import { getApprovalStatusTool } from "./tools/get_approval_status.js";
import { requestApprovalTool } from "./tools/request_approval.js";
import { treasuryProposeTool } from "./tools/treasury_propose.js";
import { treasurySignProposalTool } from "./tools/treasury_sign_proposal.js";
import { treasuryListProposalsTool } from "./tools/treasury_list_proposals.js";
import { executeHttpTool } from "./tools/execute_http.js";
import { executeIntentTool } from "./tools/execute_intent.js";
import { listBindingsTool } from "./tools/list_bindings.js";
import { createBindingTool } from "./tools/create_binding.js";
import { testBindingTool } from "./tools/test_binding.js";
import { listExecutionsTool } from "./tools/list_executions.js";
import { putMemoryTool } from "./tools/put_memory.js";
import { getMemoryTool } from "./tools/get_memory.js";
import { listMemoryTool } from "./tools/list_memory.js";
import { deleteMemoryTool } from "./tools/delete_memory.js";
import { listAutomationsTool } from "./tools/list_automations.js";
import { createAgentAutomationTool } from "./tools/create_agent_automation.js";
import { listAutomationPresetsTool } from "./tools/list_automation_presets.js";
import { triggerAutomationTool } from "./tools/trigger_automation.js";
import { cancelAutomationRunTool } from "./tools/cancel_automation_run.js";
import { listRuntimesTool } from "./tools/list_runtimes.js";
import { manageRuntimeTool } from "./tools/manage_runtime.js";
import { searchDirectoryTool } from "./tools/search_directory.js";
import { searchMemoryTool } from "./tools/search_memory.js";
import { runtimeStatusTool } from "./tools/runtime_status.js";
import { runtimeLogsTool } from "./tools/runtime_logs.js";
import { sendChatMessageTool } from "./tools/send_chat_message.js";
import { listChatConversationsTool } from "./tools/list_chat_conversations.js";
import { createChannelTool } from "./tools/create_channel.js";
import { listChannelsTool } from "./tools/list_channels.js";
import { sendChannelMessageTool } from "./tools/send_channel_message.js";
import { listConnectorPresetsTool } from "./tools/list_connector_presets.js";
import { listNotificationTargetsTool } from "./tools/list_notification_targets.js";
import { getPeerContextTool } from "./tools/get_peer_context.js";
import { listInstalledConnectorsTool } from "./tools/list_installed_connectors.js";
import { listOAuthProvidersTool } from "./tools/list_oauth_providers.js";
import { listOAuthConnectionsTool } from "./tools/list_oauth_connections.js";
import { oauthRevokeTokenTool } from "./tools/oauth_revoke_token.js";
import { oauthRevokeConsentTool } from "./tools/oauth_revoke_consent.js";
import { orgDirectoryTool } from "./tools/org_directory.js";
import { delegateTaskTool } from "./tools/delegate_task.js";
import { listDelegationsTool, createDelegationTool, getEffectiveDelegationsTool } from "./tools/delegation.js";
import { platformMarketplaceTool } from "./tools/platform_marketplace.js";
import { platformAppStatsTool } from "./tools/platform_app_stats.js";
import { platformRotateWebhookSecretTool } from "./tools/platform_rotate_webhook_secret.js";
import {
    platformSiweChallengeTool,
    platformGetConnectionTool,
    platformConnectionUsageTool,
    platformListEntitlementsTool,
    platformPreviewTemplateTool,
    platformTransferOwnershipTool,
    platformDeleteAppTool,
    platformGetSpendPolicyTool,
    platformGetConnectionSpendPolicyTool,
    platformListConnectionApprovalsTool,
    platformGetConnectionApprovalTool,
    platformListConnectionPendingApprovalsTool,
    platformGetTemplateTool,
    platformSetConnectionSpendPolicyTool,
    platformCreateConnectionRuntimeTool,
    platformGetConnectionRuntimeTool,
    platformDeleteConnectionRuntimeTool,
    platformConnectionPasskeyEnrollBeginTool,
    platformConnectionPasskeyEnrollCompleteTool,
    platformConnectionAgentChatTool,
    platformDecideConnectionPendingApprovalTool,
    platformDecideConnectionApprovalTool,
    platformListConnectionSigningKeysTool,
    platformGetConnectionSigningKeyTool,
    platformDeactivateConnectionSigningKeyTool,
    platformPatchConnectionAgentTool,
    platformCreateConnectionPendingApprovalTool,
    platformGetConnectionPortfolioTool,
    platformListConnectionAutomationsTool,
    platformGetConnectionOtelSummaryTool,
    platformGetConnectionOtelThreatsTool,
    platformGetConnectionOtelTopologyTool,
} from "./tools/platform_expansion.js";
import { importSigningKeyTool } from "./tools/import_signing_key.js";
import { listCedarPoliciesTool } from "./tools/list_cedar_policies.js";
import { testCedarPolicyTool } from "./tools/test_cedar_policy.js";
import { listOpaPoliciesTool } from "./tools/list_opa_policies.js";
import { testOpaPolicyTool } from "./tools/test_opa_policy.js";
import { listSubOrgsTool } from "./tools/list_sub_orgs.js";
import { createSubOrgTool } from "./tools/create_sub_org.js";
import { getPortfolioTool } from "./tools/get_portfolio.js";
import { importSmartAccountTool } from "./tools/import_smart_account.js";
import { getPolicyBackendSettingsTool, updatePolicyBackendSettingsTool, getShadowReportTool } from "./tools/policy_backend.js";
import {
    getGuardrailShadowReportTool,
    listGuardrailRevisionsTool,
    replayAgentGuardrailsTool,
} from "./tools/guardrail_governance.js";
import { uploadContractAbiTool, listContractAbisTool } from "./tools/contract_abis.js";
import { listPendingApprovalsTool, approvePendingApprovalTool, executePendingApprovalTool } from "./tools/pending_approvals.js";
import {
    listAgentAccountsTool,
    migrateAgentToSafeTool,
    deprecateAgentEoaTool,
    getSafeModuleRegistryTool,
    syncOrgSafeAllowancesTool,
} from "./tools/safe_accounts.js";
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
} from "./session.js";
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

if (!localOnly && !isLocalDaemonMode()) {
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
    registerTool(simulateBundleTool as AnyToolFactory);
    registerTool(submitTransactionTool as AnyToolFactory);
    registerTool(signTransactionTool as AnyToolFactory);
    registerTool(listTransactionsTool as AnyToolFactory);
    registerTool(getTransactionTool as AnyToolFactory);
    registerTool(provisionSigningKeyTool as AnyToolFactory);
    registerTool(listSigningKeysTool as AnyToolFactory);
    registerTool(signMessageTool as AnyToolFactory);
    registerTool(signTypedDataTool as AnyToolFactory);
    registerTool(signDigestTool as AnyToolFactory);
    registerTool(leaseBankrKeyTool as AnyToolFactory);
    registerTool(getSigningKeyBalanceTool as AnyToolFactory);
    registerTool(platformListAppsTool as AnyToolFactory);
    registerTool(platformCreateAppTool as AnyToolFactory);
    registerTool(platformBootstrapUserTool as AnyToolFactory);
    registerTool(platformReissueClaimTool as AnyToolFactory);
    registerTool(platformRotateKeyTool as AnyToolFactory);
    registerTool(platformListTemplatesTool as AnyToolFactory);
    registerTool(platformGetFleetTool as AnyToolFactory);
    registerTool(platformListFleetAgentsTool as AnyToolFactory);
    registerTool(platformPlanFleetRolloutTool as AnyToolFactory);
    registerTool(listDirectoryJobsTool as AnyToolFactory);
    registerTool(getDirectoryJobTool as AnyToolFactory);
    registerTool(submitDirectoryJobBidTool as AnyToolFactory);
    registerTool(platformCreateTemplateTool as AnyToolFactory);
    registerTool(platformListUsersTool as AnyToolFactory);
    registerTool(platformGrantAccessTool as AnyToolFactory);
    registerTool(platformListGrantsTool as AnyToolFactory);
    registerTool(platformSiweChallengeTool as AnyToolFactory);
    registerTool(platformGetConnectionTool as AnyToolFactory);
    registerTool(platformConnectionUsageTool as AnyToolFactory);
    registerTool(platformListEntitlementsTool as AnyToolFactory);
    registerTool(platformPreviewTemplateTool as AnyToolFactory);
    registerTool(platformTransferOwnershipTool as AnyToolFactory);
    registerTool(platformDeleteAppTool as AnyToolFactory);
    registerTool(platformGetSpendPolicyTool as AnyToolFactory);
    registerTool(platformGetConnectionSpendPolicyTool as AnyToolFactory);
    registerTool(platformListConnectionApprovalsTool as AnyToolFactory);
    registerTool(platformGetConnectionApprovalTool as AnyToolFactory);
    registerTool(platformListConnectionPendingApprovalsTool as AnyToolFactory);
    registerTool(platformGetTemplateTool as AnyToolFactory);
    registerTool(platformSetConnectionSpendPolicyTool as AnyToolFactory);
    registerTool(platformCreateConnectionRuntimeTool as AnyToolFactory);
    registerTool(platformGetConnectionRuntimeTool as AnyToolFactory);
    registerTool(platformDeleteConnectionRuntimeTool as AnyToolFactory);
    registerTool(platformConnectionPasskeyEnrollBeginTool as AnyToolFactory);
    registerTool(platformConnectionPasskeyEnrollCompleteTool as AnyToolFactory);
    registerTool(platformConnectionAgentChatTool as AnyToolFactory);
    registerTool(platformDecideConnectionPendingApprovalTool as AnyToolFactory);
    registerTool(platformDecideConnectionApprovalTool as AnyToolFactory);
    registerTool(platformListConnectionSigningKeysTool as AnyToolFactory);
    registerTool(platformGetConnectionSigningKeyTool as AnyToolFactory);
    registerTool(platformDeactivateConnectionSigningKeyTool as AnyToolFactory);
    registerTool(platformPatchConnectionAgentTool as AnyToolFactory);
    registerTool(platformCreateConnectionPendingApprovalTool as AnyToolFactory);
    registerTool(platformGetConnectionPortfolioTool as AnyToolFactory);
    registerTool(platformListConnectionAutomationsTool as AnyToolFactory);
    registerTool(platformGetConnectionOtelSummaryTool as AnyToolFactory);
    registerTool(platformGetConnectionOtelThreatsTool as AnyToolFactory);
    registerTool(platformGetConnectionOtelTopologyTool as AnyToolFactory);
    registerTool(listApprovalsTool as AnyToolFactory);
    registerTool(getApprovalTool as AnyToolFactory);
    registerTool(getApprovalStatusTool as AnyToolFactory);
    registerTool(requestApprovalTool as AnyToolFactory);
    registerTool(treasuryProposeTool as AnyToolFactory);
    registerTool(treasurySignProposalTool as AnyToolFactory);
    registerTool(treasuryListProposalsTool as AnyToolFactory);
    registerTool(executeHttpTool as AnyToolFactory);
    registerTool(executeIntentTool as AnyToolFactory);
    registerTool(listBindingsTool as AnyToolFactory);
    registerTool(createBindingTool as AnyToolFactory);
    registerTool(testBindingTool as AnyToolFactory);
    registerTool(listExecutionsTool as AnyToolFactory);
    registerTool(orderCardTool as AnyToolFactory);
    registerTool(orderGiftCardTool as AnyToolFactory);
    registerTool(searchGiftCardsTool as AnyToolFactory);
    registerTool(listCardsTool as AnyToolFactory);
    registerTool(getCardStatusTool as AnyToolFactory);
    registerTool(putMemoryTool as AnyToolFactory);
    registerTool(getMemoryTool as AnyToolFactory);
    registerTool(listMemoryTool as AnyToolFactory);
    registerTool(deleteMemoryTool as AnyToolFactory);
    registerTool(listAutomationsTool as AnyToolFactory);
    registerTool(createAgentAutomationTool as AnyToolFactory);
    registerTool(listAutomationPresetsTool as AnyToolFactory);
    registerTool(triggerAutomationTool as AnyToolFactory);
    registerTool(cancelAutomationRunTool as AnyToolFactory);
    registerTool(listRuntimesTool as AnyToolFactory);
    registerTool(manageRuntimeTool as AnyToolFactory);
    registerTool(searchDirectoryTool as AnyToolFactory);
    registerTool(searchMemoryTool as AnyToolFactory);
    registerTool(runtimeStatusTool as AnyToolFactory);
    registerTool(runtimeLogsTool as AnyToolFactory);
    registerTool(sendChatMessageTool as AnyToolFactory);
    registerTool(listChatConversationsTool as AnyToolFactory);
    registerTool(createChannelTool as AnyToolFactory);
    registerTool(listChannelsTool as AnyToolFactory);
    registerTool(sendChannelMessageTool as AnyToolFactory);
    registerTool(listOAuthProvidersTool as AnyToolFactory);
    registerTool(listConnectorPresetsTool as AnyToolFactory);
    registerTool(listNotificationTargetsTool as AnyToolFactory);
    registerTool(getPeerContextTool as AnyToolFactory);
    registerTool(listInstalledConnectorsTool as AnyToolFactory);
    registerTool(listOAuthConnectionsTool as AnyToolFactory);
    registerTool(oauthRevokeTokenTool as AnyToolFactory);
    registerTool(oauthRevokeConsentTool as AnyToolFactory);
    registerTool(orgDirectoryTool as AnyToolFactory);
    registerTool(delegateTaskTool as AnyToolFactory);
    registerTool(listDelegationsTool as AnyToolFactory);
    registerTool(createDelegationTool as AnyToolFactory);
    registerTool(getEffectiveDelegationsTool as AnyToolFactory);
    registerTool(platformMarketplaceTool as AnyToolFactory);
    registerTool(platformAppStatsTool as AnyToolFactory);
    registerTool(platformRotateWebhookSecretTool as AnyToolFactory);
    registerTool(importSigningKeyTool as AnyToolFactory);
    registerTool(listCedarPoliciesTool as AnyToolFactory);
    registerTool(testCedarPolicyTool as AnyToolFactory);
    registerTool(listOpaPoliciesTool as AnyToolFactory);
    registerTool(testOpaPolicyTool as AnyToolFactory);
    registerTool(listSubOrgsTool as AnyToolFactory);
    registerTool(createSubOrgTool as AnyToolFactory);
    registerTool(getPortfolioTool as AnyToolFactory);
    registerTool(importSmartAccountTool as AnyToolFactory);
    registerTool(getPolicyBackendSettingsTool as AnyToolFactory);
    registerTool(updatePolicyBackendSettingsTool as AnyToolFactory);
    registerTool(getShadowReportTool as AnyToolFactory);
    registerTool(getGuardrailShadowReportTool as AnyToolFactory);
    registerTool(listGuardrailRevisionsTool as AnyToolFactory);
    registerTool(replayAgentGuardrailsTool as AnyToolFactory);
    registerTool(uploadContractAbiTool as AnyToolFactory);
    registerTool(listContractAbisTool as AnyToolFactory);
    registerTool(listPendingApprovalsTool as AnyToolFactory);
    registerTool(approvePendingApprovalTool as AnyToolFactory);
    registerTool(executePendingApprovalTool as AnyToolFactory);
    registerTool(listAgentAccountsTool as AnyToolFactory);
    registerTool(migrateAgentToSafeTool as AnyToolFactory);
    registerTool(deprecateAgentEoaTool as AnyToolFactory);
    registerTool(getSafeModuleRegistryTool as AnyToolFactory);
    registerTool(syncOrgSafeAllowancesTool as AnyToolFactory);
}

// ── Vault-dependent stretch tools + resource ─────────

if (!localOnly && !isLocalDaemonMode()) {

const rotateAndStoreTool = (client: OneClawClient) => ({
    name: "rotate_and_store",
    description:
        "Store a new value for an existing secret (creating a new version) and return the version number. Useful when an agent has regenerated an API key and needs to persist it.",
    parameters: z.object({
        path: z.string().min(1).describe("Secret path to rotate"),
        value: z.string().min(1).describe("The new secret value"),
        type: z.string().optional().describe("Secret type (api_key, password, etc.). Uses existing type if omitted."),
    }),
    execute: async (
        args: { path: string; value: string; type?: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        const result = await client.putSecret(args.path, {
            value: args.value,
            type: args.type ?? "api_key",
        });
        context.log.info(`secret rotated: ${args.path}`);
        return `Rotated secret at '${args.path}'. New version: ${result.version}.`;
    },
});
registerTool(rotateAndStoreTool as AnyToolFactory);

const rotateGenerateTool = (client: OneClawClient) => ({
    name: "rotate_generate",
    description:
        "Server-side secret rotation: generates a cryptographically random value and stores it as a new version. The secret value never leaves the server. Returns the new version number.",
    parameters: z.object({
        path: z.string().min(1).describe("Secret path to rotate"),
        length: z.number().min(8).max(1024).optional().describe("Length of generated value (default 32)"),
        charset: z.enum(["hex", "base64", "alphanumeric", "ascii"]).optional().describe("Character set (default hex)"),
    }),
    execute: async (
        args: { path: string; length?: number; charset?: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        const result = await client.rotateGenerate(args.path, {
            length: args.length,
            charset: args.charset,
        });
        context.log.info(`secret rotated (server-generated): ${args.path}`);
        return `Rotated secret at '${args.path}' with server-generated value. New version: ${result.version}.`;
    },
});
registerTool(rotateGenerateTool as AnyToolFactory);

const listVersionsTool = (client: OneClawClient) => ({
    name: "list_versions",
    description:
        "List all versions of a secret at the given path. Returns version numbers, creation dates, and disabled status.",
    parameters: z.object({
        path: z.string().min(1).describe("Secret path"),
    }),
    execute: async (
        args: { path: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        const result = await client.listVersions(args.path);
        context.log.info(`listed versions: ${args.path}`);
        const versions = result.versions ?? [];
        if (versions.length === 0) return `No versions found for '${args.path}'.`;
        const lines = versions.map(
            (v) => `v${v.version} (${v.created_at})${v.is_disabled ? " [disabled]" : ""}`,
        );
        return `Versions for '${args.path}' (${versions.length} total):\n${lines.join("\n")}`;
    },
});
registerTool(listVersionsTool as AnyToolFactory);

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

// ── resolve_env: Resolve env vars for a vault (Phase 4) ──────────────────────────

const resolveEnvTool = (client: OneClawClient) => ({
    name: "resolve_env",
    description:
        "Resolve environment variables for a vault, returning the final KEY=VALUE set with precedence applied (shared < vault < branch override). If environment is omitted, the agent's tagged environment is used automatically.",
    parameters: z.object({
        environment: z
            .string()
            .optional()
            .describe(
                "Target environment (production, preview, development, or custom). Omit to use the agent's tagged environment.",
            ),
        git_branch: z
            .string()
            .optional()
            .describe("Optional git branch for preview overrides"),
    }),
    execute: async (
        args: { environment?: string; git_branch?: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        const result = await client.resolveEnvVars(args.environment, args.git_branch);
        const envLabel = args.environment ?? "(agent default)";
        context.log.info(
            `Resolved env vars for ${envLabel}${args.git_branch ? ` (branch: ${args.git_branch})` : ""}: ${Object.keys(result.vars ?? {}).length} variables`,
        );
        return JSON.stringify(result, null, 2);
    },
});
registerTool(resolveEnvTool as AnyToolFactory);

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
