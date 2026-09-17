/**
 * Toolset catalog — the single place that says which toolset every MCP tool
 * belongs to and what a session must be entitled to before that toolset is
 * offered.
 *
 * Pure module: no FastMCP, no network. `index.ts` consults it at
 * registration time (stdio) and per session via `canAccess` (hosted), and
 * `security/index.ts` derives its secret-carrying tool list from it so the
 * "hide under execution_require_tee" list and the "don't redact" list can
 * never drift apart.
 */

export type ToolsetId =
    | "inspect"
    | "local"
    | "vault"
    | "approvals"
    | "intents"
    | "execute"
    | "cards"
    | "treasury"
    | "memory"
    | "delegation"
    | "channels"
    | "chat"
    | "automations"
    | "runtimes"
    | "directory"
    | "notification"
    | "admin"
    | "platform";

/** How much the server actually knows about the session's entitlements. */
export type EntitlementLookup =
    /** Agent profile fetched — every gate below is authoritative. */
    | "full"
    /** Only the JWT claims were available (static token, or profile GET failed softly). */
    | "jwt_only"
    /** Profile GET failed hard; entitlement-gated toolsets are withheld. */
    | "failed"
    /** No cloud credentials at all (local-only / local-daemon mode). */
    | "none";

export type Principal = "agent" | "user" | "platform" | "unknown";

export interface Entitlements {
    lookup: EntitlementLookup;
    principal: Principal;
    agentId?: string;
    intentsApi: boolean;
    executionIntents: boolean;
    /** Vault refuses to hand secret *values* to this agent outside a TEE. */
    executionRequireTee: boolean;
    cards: boolean;
    memory: boolean;
    shroud: boolean;
    discoverable: boolean;
}

/** The most conservative snapshot: an agent about which nothing is known. */
export function unknownEntitlements(lookup: EntitlementLookup = "failed"): Entitlements {
    return {
        lookup,
        principal: "agent",
        intentsApi: false,
        executionIntents: false,
        executionRequireTee: false,
        cards: false,
        memory: false,
        shroud: false,
        discoverable: false,
    };
}

/** Tools that return secret values. Hidden under `execution_require_tee`; never redacted. */
export const SECRET_READ_TOOLS: readonly string[] = ["get_secret", "get_env_bundle", "resolve_env"];
/** Tools that accept secret values as input. Kept under `execution_require_tee`; never redacted. */
export const SECRET_WRITE_TOOLS: readonly string[] = ["put_secret", "rotate_and_store"];

const T = (toolset: ToolsetId, names: string[]): Array<[string, ToolsetId]> =>
    names.map((n) => [n, toolset]);

/**
 * Every tool the server can register, by toolset. A tool missing from this
 * table fails registration (see `toolsetOf`), so adding a tool means
 * deciding where it belongs.
 */
export const TOOL_CATALOG: ReadonlyMap<string, ToolsetId> = new Map<string, ToolsetId>([
    ...T("inspect", ["inspect_content"]),
    ...T("local", ["proxy_request"]),

    ...T("vault", [
        "list_secrets",
        "get_secret",
        "put_secret",
        "delete_secret",
        "describe_secret",
        "list_versions",
        "rotate_and_store",
        "rotate_generate",
        "get_env_bundle",
        "resolve_env",
        "share_secret",
        "grant_access",
        "create_vault",
        "list_vaults",
        "list_oauth_connections",
        "list_oauth_providers",
        "oauth_revoke_consent",
        "oauth_revoke_token",
    ]),

    ...T("approvals", [
        "request_approval",
        "get_approval_status",
        "get_approval",
        "list_approvals",
        "list_pending_approvals",
    ]),

    ...T("intents", [
        "simulate_transaction",
        "simulate_bundle",
        "submit_transaction",
        "sign_transaction",
        "sign_message",
        "sign_typed_data",
        "sign_digest",
        "list_transactions",
        "get_transaction",
        "provision_signing_key",
        "import_signing_key",
        "list_signing_keys",
        "get_signing_key_balance",
        "get_portfolio",
        "import_smart_account",
        "list_agent_accounts",
        "get_safe_module_registry",
        "lease_bankr_key",
    ]),

    ...T("execute", [
        "list_bindings",
        "test_binding",
        "execute_http",
        "execute_intent",
        "list_executions",
        "list_installed_connectors",
        "list_connector_presets",
    ]),

    ...T("cards", ["list_cards", "get_card_status", "search_gift_cards", "order_card", "order_gift_card"]),

    ...T("treasury", ["treasury_propose", "treasury_list_proposals", "treasury_sign_proposal"]),

    ...T("memory", [
        "put_memory",
        "get_memory",
        "list_memory",
        "search_memory",
        "delete_memory",
        "get_peer_context",
    ]),

    ...T("delegation", [
        "list_delegations",
        "create_delegation",
        "get_effective_delegations",
        "delegate_task",
        "org_directory",
    ]),

    ...T("channels", ["list_channels", "create_channel", "send_channel_message"]),

    ...T("chat", ["list_chat_conversations", "send_chat_message"]),

    ...T("automations", [
        "list_automations",
        "list_automation_presets",
        "create_agent_automation",
        "trigger_automation",
        "cancel_automation_run",
    ]),

    ...T("runtimes", ["list_runtimes", "manage_runtime", "runtime_status", "runtime_logs"]),

    ...T("directory", [
        "search_agent_directory",
        "list_directory_jobs",
        "get_directory_job",
        "submit_directory_job_bid",
    ]),

    ...T("notification", ["list_notification_targets"]),

    // Human-only at the vault (`principal_type != "user"` → 403). Never
    // offered on an agent session.
    ...T("admin", [
        "create_binding",
        "create_sub_org",
        "list_sub_orgs",
        "approve_pending_approval",
        "execute_pending_approval",
        "migrate_agent_to_safe",
        "deprecate_agent_eoa",
        "sync_org_safe_allowances",
        "list_cedar_policies",
        "test_cedar_policy",
        "list_opa_policies",
        "test_opa_policy",
        "get_policy_backend_settings",
        "update_policy_backend_settings",
        "get_shadow_report",
        "get_guardrail_shadow_report",
        "list_guardrail_revisions",
        "replay_agent_guardrails",
        "upload_contract_abi",
        "list_contract_abis",
    ]),

    // `plt_` auth only; the MCP server rejects plt_ credentials outright, so
    // these are never offered on any session today.
    ...T("platform", [
        "platform_list_apps",
        "platform_create_app",
        "platform_delete_app",
        "platform_rotate_key",
        "platform_rotate_webhook_secret",
        "platform_app_stats",
        "platform_list_users",
        "platform_bootstrap_user",
        "platform_siwe_challenge",
        "platform_reissue_claim",
        "platform_transfer_ownership",
        "platform_grant_access",
        "platform_list_grants",
        "platform_marketplace",
        "platform_list_templates",
        "platform_create_template",
        "platform_get_template",
        "platform_preview_template",
        "platform_list_entitlements",
        "platform_get_spend_policy",
        "platform_get_connection",
        "platform_connection_usage",
        "platform_get_connection_spend_policy",
        "platform_set_connection_spend_policy",
        "platform_list_connection_approvals",
        "platform_get_connection_approval",
        "platform_decide_connection_approval",
        "platform_list_connection_pending_approvals",
        "platform_create_connection_pending_approval",
        "platform_decide_connection_pending_approval",
        "platform_create_connection_runtime",
        "platform_get_connection_runtime",
        "platform_delete_connection_runtime",
        "platform_connection_agent_chat",
        "platform_list_connection_signing_keys",
        "platform_get_connection_signing_key",
        "platform_deactivate_connection_signing_key",
        "platform_patch_connection_agent",
        "platform_connection_passkey_enroll_begin",
        "platform_connection_passkey_enroll_complete",
        "platform_get_connection_portfolio",
        "platform_list_connection_automations",
        "platform_get_connection_otel_summary",
        "platform_get_connection_otel_threats",
        "platform_get_connection_otel_topology",
        "platform_get_fleet",
        "platform_list_fleet_agents",
        "platform_plan_fleet_rollout",
    ]),
]);

export const TOOLSET_IDS: readonly ToolsetId[] = [
    "inspect", "local", "vault", "approvals", "intents", "execute", "cards", "treasury",
    "memory", "delegation", "channels", "chat", "automations", "runtimes", "directory",
    "notification", "admin", "platform",
];

/** Toolsets offered to every agent session without any flag. */
const AGENT_DEFAULT: readonly ToolsetId[] = ["inspect", "vault", "approvals"];

/**
 * Toolsets the vault has no per-agent flag for. They are never on by
 * default (the vault still authorizes each call) but an operator may opt in
 * with `ONECLAW_MCP_TOOLSETS` / `X-1Claw-Toolsets`.
 */
const AGENT_OPT_IN: readonly ToolsetId[] = [
    "treasury", "delegation", "chat", "automations", "runtimes", "notification",
];

export function toolsetOf(toolName: string): ToolsetId {
    const ts = TOOL_CATALOG.get(toolName);
    if (!ts) {
        throw new Error(
            `Tool '${toolName}' is not in the toolset catalog (packages/mcp/src/toolsets.ts). ` +
                `Every tool must be assigned to a toolset before it can be registered.`,
        );
    }
    return ts;
}

/**
 * Toolsets this session could ever be offered. `principal` decides the
 * human/platform boundaries; the agent flags decide the rest. An explicit
 * override can pick from this set but never add to it.
 */
export function availableToolsets(e: Entitlements): Set<ToolsetId> {
    const out = new Set<ToolsetId>(["inspect"]);
    if (e.lookup === "none") return out;

    if (e.principal === "platform") {
        out.add("platform");
        return out;
    }

    for (const ts of AGENT_DEFAULT) out.add(ts);
    for (const ts of AGENT_OPT_IN) out.add(ts);
    if (e.principal === "user") out.add("admin");

    // Entitlement-gated. Under "failed" every flag is false, so these stay
    // off — fail closed with the signal carried in `lookup`.
    if (e.intentsApi) out.add("intents");
    if (e.executionIntents) out.add("execute");
    if (e.cards) out.add("cards");
    if (e.memory) out.add("memory");
    if (e.shroud) {
        out.add("channels");
        out.add("chat");
    }
    if (e.discoverable) out.add("directory");
    return out;
}

/** What a session sees with no override: available minus the opt-in-only sets. */
export function defaultToolsets(e: Entitlements): Set<ToolsetId> {
    const out = availableToolsets(e);
    for (const ts of AGENT_OPT_IN) out.delete(ts);
    // Chat is opt-in even for Shroud agents — `channels` is the working
    // surface; `chat` is a self-conversation and rarely what a tool caller wants.
    out.delete("chat");
    return out;
}

/**
 * Parse an override string ("vault,intents", "all", "") into toolset ids.
 * Unknown names are reported back so the caller can log them; they never
 * throw, because a typo in a header must not take a session down.
 */
export function parseToolsetOverride(
    raw: string | undefined,
): { all: boolean; toolsets: ToolsetId[]; unknown: string[] } | undefined {
    if (raw === undefined) return undefined;
    const parts = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return undefined;
    if (parts.includes("all")) return { all: true, toolsets: [], unknown: [] };
    const toolsets: ToolsetId[] = [];
    const unknown: string[] = [];
    for (const p of parts) {
        if ((TOOLSET_IDS as readonly string[]).includes(p)) toolsets.push(p as ToolsetId);
        else unknown.push(p);
    }
    return { all: false, toolsets, unknown };
}

/**
 * Final toolset for a session. The override is intersected with what the
 * entitlements allow — it can narrow or opt in, never widen past the vault.
 */
export function resolveToolsets(e: Entitlements, override?: string): Set<ToolsetId> {
    const parsed = parseToolsetOverride(override);
    const available = availableToolsets(e);
    if (!parsed) return defaultToolsets(e);
    if (parsed.all) {
        // "all" = everything that could work on this session — the
        // human/platform sets are still principal-gated inside `available`.
        return available;
    }
    const out = new Set<ToolsetId>(["inspect"]);
    for (const ts of parsed.toolsets) if (available.has(ts)) out.add(ts);
    return out;
}

/** The per-tool decision: is `toolName` visible to a session with these toolsets? */
export function toolVisible(
    toolName: string,
    toolsets: ReadonlySet<ToolsetId>,
    e: Entitlements,
): boolean {
    const ts = TOOL_CATALOG.get(toolName);
    if (!ts) return false;
    if (!toolsets.has(ts)) return false;
    if (e.executionRequireTee && SECRET_READ_TOOLS.includes(toolName)) return false;
    return true;
}

/** Tool names visible for a given toolset selection, in catalog order. */
export function visibleToolNames(toolsets: ReadonlySet<ToolsetId>, e: Entitlements): string[] {
    const out: string[] = [];
    for (const name of TOOL_CATALOG.keys()) {
        if (toolVisible(name, toolsets, e)) out.push(name);
    }
    return out;
}

/** Stable, human-readable summary used for logs and the initialize `instructions`. */
export function describeToolsets(toolsets: ReadonlySet<ToolsetId>): string {
    return TOOLSET_IDS.filter((t) => toolsets.has(t)).join(",");
}
