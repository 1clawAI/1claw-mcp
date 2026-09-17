/**
 * Per-session state for the MCP server: one cached `OneClawClient` per
 * session (so the ocv_ → JWT exchange happens once, not once per tool
 * call), plus the entitlement snapshot that decides which toolsets the
 * session is offered.
 *
 * Hosted sessions can outlive the flags they were admitted with, so the
 * snapshot carries `resolvedAt` and is refreshed on a TTL and on any 403
 * from the vault (see `refreshEntitlementsIfStale`).
 */

import {
    OneClawClient,
    OneClawApiError,
    type AgentProfileResponse,
    type AgentEntitlementsResponse,
} from "../client.js";
import {
    type Entitlements,
    type ToolsetId,
    type Principal,
    resolveToolsets,
    unknownEntitlements,
    describeToolsets,
    visibleToolNames,
} from "../toolsets.js";

export type SessionCredential =
    | { token: string; vaultId: string; runtimeId?: string }
    | { agentApiKey: string; agentId?: string; vaultId?: string; runtimeId?: string };

export type SessionAuth = SessionCredential & {
    entitlements: Entitlements;
    toolsets: Set<ToolsetId>;
    /** Raw `X-1Claw-Toolsets` / `ONECLAW_MCP_TOOLSETS` value, if any. */
    toolsetOverride?: string;
    /** When `entitlements` was last resolved (ms since epoch). */
    resolvedAt: number;
};

export const ENTITLEMENT_TTL_MS = 15 * 60 * 1000;

const clients = new WeakMap<object, OneClawClient>();

/** Build (once) and return the client for a session. */
export function clientForSession(session: SessionCredential, baseUrl: string): OneClawClient {
    const cached = clients.get(session);
    if (cached) return cached;
    const client =
        "agentApiKey" in session
            ? new OneClawClient({
                  baseUrl,
                  agentId: session.agentId,
                  apiKey: session.agentApiKey,
                  vaultId: session.vaultId,
                  runtimeId: session.runtimeId,
              })
            : new OneClawClient({
                  baseUrl,
                  token: session.token,
                  vaultId: session.vaultId,
                  runtimeId: session.runtimeId,
              });
    clients.set(session, client);
    return client;
}

/** Test hook: drop the cached client for a session. */
export function forgetSessionClient(session: object): void {
    clients.delete(session);
}

function principalOf(sub: unknown): Principal {
    if (typeof sub !== "string") return "unknown";
    if (sub.startsWith("agent:")) return "agent";
    if (sub.startsWith("user:")) return "user";
    if (sub.startsWith("platform:")) return "platform";
    return "unknown";
}

function agentIdOf(sub: unknown): string | undefined {
    return typeof sub === "string" && sub.startsWith("agent:") ? sub.slice("agent:".length) : undefined;
}

const flag = (v: unknown): boolean => v === true;

/** Fold a `/v1/agents/{id}` profile into an entitlement snapshot. */
export function entitlementsFromProfile(
    p: AgentProfileResponse,
    base: Partial<Entitlements> = {},
): Entitlements {
    return {
        lookup: "full",
        principal: "agent",
        agentId: p.id ?? base.agentId,
        intentsApi: flag(p.intents_api_enabled),
        executionIntents: flag(p.execution_intents_enabled),
        executionRequireTee: flag(p.execution_require_tee),
        cards: flag(p.cards_enabled),
        memory: flag(p.memory_enabled),
        shroud: flag(p.shroud_enabled),
        discoverable: flag(p.discoverable),
    };
}

/** Fold the token exchange's `entitlements` (vault ≥ 0.61.17) into a snapshot. */
export function entitlementsFromExchange(
    r: AgentEntitlementsResponse,
    base: Partial<Entitlements> = {},
): Entitlements {
    return {
        lookup: "full",
        principal: "agent",
        agentId: base.agentId,
        intentsApi: flag(r.intents_api),
        executionIntents: flag(r.execution_intents),
        executionRequireTee: flag(r.execution_require_tee),
        cards: flag(r.cards),
        memory: flag(r.memory),
        shroud: flag(r.shroud),
        discoverable: flag(r.discoverable),
        treasurySigner: flag(r.treasury_signer),
        hasDelegations: flag(r.has_delegations),
    };
}

/** Fold signed JWT claims into a snapshot. Flags the JWT does not carry stay off. */
export function entitlementsFromClaims(claims: Record<string, unknown>): Entitlements {
    return {
        lookup: "jwt_only",
        principal: principalOf(claims.sub),
        agentId: agentIdOf(claims.sub),
        intentsApi: flag(claims.intents_api_enabled),
        executionIntents: flag(claims.execution_intents_enabled),
        executionRequireTee: flag(claims.execution_require_tee),
        cards: false,
        memory: false,
        shroud: flag(claims.shroud_enabled),
        discoverable: false,
    };
}

export interface ResolveOptions {
    /** Called with a human-readable reason whenever the lookup is less than "full". */
    warn?: (msg: string) => void;
    /** Test seam: override the profile fetch. */
    fetchProfile?: (client: OneClawClient, agentId: string) => Promise<AgentProfileResponse>;
}

/**
 * Resolve what this session is entitled to. Order of trust:
 *   1. the signed JWT (always available once the client can authenticate)
 *   2. the agent profile (`GET /v1/agents/{id}`) for flags the JWT omits
 * Anything that cannot be confirmed is left off — a degraded lookup only
 * ever *narrows* the toolset.
 */
export async function resolveEntitlements(
    client: OneClawClient,
    opts: ResolveOptions = {},
): Promise<Entitlements> {
    const warn = opts.warn ?? (() => {});
    let claims: Record<string, unknown> | undefined;
    try {
        claims = await client.tokenClaims();
    } catch (err) {
        warn(`entitlement lookup failed: could not obtain a token (${errMessage(err)})`);
        return unknownEntitlements("failed");
    }
    if (!claims) {
        warn("entitlement lookup failed: token has no readable claims");
        return unknownEntitlements("failed");
    }

    const fromJwt = entitlementsFromClaims(claims);
    if (fromJwt.principal !== "agent" || !fromJwt.agentId) {
        // Users and platforms have no agent profile; the JWT is all there is.
        return fromJwt;
    }

    // Newer vaults answer everything on the exchange itself — no extra call.
    try {
        const fromExchange = await client.tokenEntitlements();
        if (fromExchange) return entitlementsFromExchange(fromExchange, fromJwt);
    } catch {
        /* fall through to the profile GET */
    }

    const fetchProfile = opts.fetchProfile ?? ((c, id) => c.getAgent(id));
    try {
        const profile = await fetchProfile(client, fromJwt.agentId);
        return entitlementsFromProfile(profile, fromJwt);
    } catch (err) {
        const status = err instanceof OneClawApiError ? err.status : undefined;
        warn(
            `entitlement lookup degraded to jwt_only: GET /v1/agents/${fromJwt.agentId} ` +
                `${status ? `→ HTTP ${status}` : `failed (${errMessage(err)})`}; ` +
                `cards/memory/directory toolsets withheld`,
        );
        return fromJwt;
    }
}

function errMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** Attach a freshly resolved snapshot + toolset selection to a credential. */
export function attachEntitlements(
    credential: SessionCredential,
    entitlements: Entitlements,
    toolsetOverride?: string,
    now = Date.now(),
): SessionAuth {
    const session = credential as SessionAuth;
    session.entitlements = entitlements;
    session.toolsetOverride = toolsetOverride;
    session.toolsets = resolveToolsets(entitlements, toolsetOverride);
    session.resolvedAt = now;
    return session;
}

/**
 * Re-resolve the session's entitlements when the snapshot is older than the
 * TTL (or `force`), mutating the session in place. Returns true when the
 * visible toolset changed — the caller then tells the client via
 * `notifications/tools/list_changed`.
 */
export async function refreshEntitlementsIfStale(
    session: SessionAuth,
    client: OneClawClient,
    opts: ResolveOptions & { force?: boolean; now?: number } = {},
): Promise<boolean> {
    const now = opts.now ?? Date.now();
    if (!opts.force && now - session.resolvedAt < ENTITLEMENT_TTL_MS) return false;
    const fresh = await resolveEntitlements(client, opts);
    // Never let a transient failure downgrade a snapshot we already trust
    // more than the failure tells us — a "failed" refresh keeps the old
    // flags but still counts as resolved so we don't hammer the vault.
    const next =
        fresh.lookup === "failed" && session.entitlements.lookup !== "failed"
            ? session.entitlements
            : fresh;
    const before = visibleToolNames(session.toolsets, session.entitlements);
    attachEntitlements(session, next, session.toolsetOverride, now);
    const after = visibleToolNames(session.toolsets, session.entitlements);
    return before.length !== after.length || before.some((n, i) => n !== after[i]);
}

/** One-line summary for logs: what the session was offered and why. */
export function describeSession(session: SessionAuth): string {
    const e = session.entitlements;
    return (
        `toolsets=${describeToolsets(session.toolsets)} lookup=${e.lookup} principal=${e.principal}` +
        (e.agentId ? ` agent=${e.agentId}` : "") +
        (e.executionRequireTee ? " execution_require_tee" : "") +
        (session.toolsetOverride ? ` override=${session.toolsetOverride}` : "")
    );
}
