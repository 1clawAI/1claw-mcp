/**
 * Toolset gates — what a session must be entitled to before a toolset is
 * offered. The tool → toolset mapping itself is owned by the modules under
 * `src/toolsets/` and aggregated here into `TOOL_CATALOG`.
 *
 * No FastMCP, no network. `index.ts` consults it at
 * registration time (stdio) and per session via `canAccess` (hosted), and
 * `security/index.ts` derives its secret-carrying tool list from it so the
 * "hide under execution_require_tee" list and the "don't redact" list can
 * never drift apart.
 */

import { OneClawClient } from "./client.js";
import { TOOLSET_MODULES, type ToolsetId } from "./toolsets/index.js";
import { SECRET_READ_TOOLS, SECRET_WRITE_TOOLS } from "./toolsets/secret-tools.js";

export type { ToolsetId, ToolsetModule, ToolFactory } from "./toolsets/index.js";
export { TOOLSET_MODULES, SECRET_READ_TOOLS, SECRET_WRITE_TOOLS };

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
    /** Agent signs for ≥1 treasury. Undefined = the vault did not say. */
    treasurySigner?: boolean;
    /** Agent has an active delegation in either direction. Undefined = unknown. */
    hasDelegations?: boolean;
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

/** Tools whose factories take no client — registered by hand in index.ts. */
const CLIENTLESS_TOOLS: ReadonlyArray<[string, ToolsetId]> = [
    ["inspect_content", "inspect"],
    ["proxy_request", "local"],
];

/** A client that can never be used — only good for reading a factory's name. */
const PROBE_CLIENT = new OneClawClient({ baseUrl: "http://unused.invalid", token: "", vaultId: "" });

/**
 * Every tool the server can register, by toolset — DERIVED from the toolset
 * modules under `src/toolsets/`, which own their tool lists. A tool missing
 * from every module fails registration (see `toolsetOf`), so adding a tool
 * means deciding where it belongs.
 */
export const TOOL_CATALOG: ReadonlyMap<string, ToolsetId> = (() => {
    const map = new Map<string, ToolsetId>(CLIENTLESS_TOOLS);
    for (const module of TOOLSET_MODULES) {
        for (const factory of module.tools) {
            const name = factory(PROBE_CLIENT).name;
            const prior = map.get(name);
            if (prior && prior !== module.id) {
                throw new Error(`Tool '${name}' is claimed by both '${prior}' and '${module.id}'`);
            }
            map.set(name, module.id);
        }
    }
    return map;
})();

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

/**
 * What a session sees with no override: available minus the opt-in-only
 * sets — except that treasury and delegation come on by default when the
 * vault has positively said the agent uses them.
 */
export function defaultToolsets(e: Entitlements): Set<ToolsetId> {
    const out = availableToolsets(e);
    for (const ts of AGENT_OPT_IN) out.delete(ts);
    if (e.principal !== "platform" && e.lookup !== "none") {
        if (e.treasurySigner === true) out.add("treasury");
        if (e.hasDelegations === true) out.add("delegation");
    }
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
