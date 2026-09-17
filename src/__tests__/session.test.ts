import { describe, it, expect } from "vitest";
import { OneClawApiError, type OneClawClient } from "../client.js";
import {
    clientForSession,
    resolveEntitlements,
    attachEntitlements,
    refreshEntitlementsIfStale,
    ENTITLEMENT_TTL_MS,
    type SessionCredential,
} from "../session.js";
import { registerSecret, clearSecrets, trackedSecretCount } from "../security/index.js";

const fakeClient = (
    claims: Record<string, unknown> | undefined,
    profile?: Record<string, unknown> | Error,
    exchange?: Record<string, unknown>,
) =>
    ({
        tokenClaims: async () => {
            if (claims instanceof Error) throw claims;
            return claims;
        },
        tokenEntitlements: async () => exchange,
        getAgent: async () => {
            if (profile instanceof Error) throw profile;
            return { id: "agent-1", ...(profile ?? {}) };
        },
    }) as unknown as OneClawClient;

describe("clientForSession", () => {
    it("builds one client per session object and reuses it", () => {
        const a: SessionCredential = { agentApiKey: "ocv_a" };
        const b: SessionCredential = { agentApiKey: "ocv_a" }; // same key, different session
        const c1 = clientForSession(a, "https://api.example");
        expect(clientForSession(a, "https://api.example")).toBe(c1);
        expect(clientForSession(b, "https://api.example")).not.toBe(c1);
    });
});

describe("resolveEntitlements", () => {
    it("is 'full' when the profile answers and takes flags from it", async () => {
        const warnings: string[] = [];
        const e = await resolveEntitlements(
            fakeClient({ sub: "agent:agent-1", intents_api_enabled: false }, { intents_api_enabled: true, cards_enabled: true, execution_require_tee: true }),
            { warn: (m) => warnings.push(m) },
        );
        expect(e.lookup).toBe("full");
        expect(e.agentId).toBe("agent-1");
        expect(e.intentsApi).toBe(true);
        expect(e.cards).toBe(true);
        expect(e.executionRequireTee).toBe(true);
        expect(warnings).toEqual([]);
    });

    it("degrades to jwt_only with the signed flags when the profile GET fails, and says so", async () => {
        const warnings: string[] = [];
        const e = await resolveEntitlements(
            fakeClient({ sub: "agent:agent-1", intents_api_enabled: true, execution_require_tee: true }, new OneClawApiError(403, "nope")),
            { warn: (m) => warnings.push(m) },
        );
        expect(e.lookup).toBe("jwt_only");
        expect(e.intentsApi).toBe(true);
        expect(e.executionRequireTee).toBe(true);
        expect(e.cards).toBe(false);
        expect(warnings.join("\n")).toMatch(/jwt_only.*HTTP 403/s);
    });

    it("prefers the exchange's entitlements and skips the profile GET", async () => {
        const e = await resolveEntitlements(
            fakeClient({ sub: "agent:agent-1" }, new Error("must not be called"), {
                intents_api: true, execution_intents: false, execution_require_tee: false, intents_require_tee: false,
                cards: false, memory: true, shroud: false, discoverable: false, treasury_signer: true, has_delegations: false,
            }),
        );
        expect(e.lookup).toBe("full");
        expect(e.intentsApi).toBe(true);
        expect(e.memory).toBe(true);
        expect(e.treasurySigner).toBe(true);
        expect(e.hasDelegations).toBe(false);
        const { resolveToolsets } = await import("../toolsets.js");
        const ts = resolveToolsets(e);
        expect(ts.has("treasury")).toBe(true);
        expect(ts.has("delegation")).toBe(false);
    });

    it("is 'failed' when no token can be obtained", async () => {
        const e = await resolveEntitlements(fakeClient(new Error("network") as never));
        expect(e.lookup).toBe("failed");
        expect(e.intentsApi).toBe(false);
    });

    it("does not fetch an agent profile for a user JWT", async () => {
        const client = fakeClient({ sub: "user:u-1" }, new Error("must not be called"));
        const e = await resolveEntitlements(client);
        expect(e.principal).toBe("user");
        expect(e.lookup).toBe("jwt_only");
    });
});

describe("refreshEntitlementsIfStale", () => {
    it("is a no-op inside the TTL and re-resolves after it, reporting a visible change", async () => {
        const cred: SessionCredential = { agentApiKey: "ocv_a" };
        const first = await resolveEntitlements(fakeClient({ sub: "agent:agent-1" }, {}));
        const session = attachEntitlements(cred, first, undefined, 1_000);
        expect(session.toolsets.has("intents")).toBe(false);

        const grantsIntents = fakeClient({ sub: "agent:agent-1" }, { intents_api_enabled: true });
        expect(await refreshEntitlementsIfStale(session, grantsIntents, { now: 1_000 + ENTITLEMENT_TTL_MS - 1 })).toBe(false);
        expect(session.toolsets.has("intents")).toBe(false);

        expect(await refreshEntitlementsIfStale(session, grantsIntents, { now: 1_000 + ENTITLEMENT_TTL_MS })).toBe(true);
        expect(session.toolsets.has("intents")).toBe(true);
        expect(session.resolvedAt).toBe(1_000 + ENTITLEMENT_TTL_MS);
    });

    it("a forced refresh that revokes a flag drops the toolset", async () => {
        const cred: SessionCredential = { agentApiKey: "ocv_a" };
        const first = await resolveEntitlements(fakeClient({ sub: "agent:agent-1" }, { intents_api_enabled: true }));
        const session = attachEntitlements(cred, first);
        expect(session.toolsets.has("intents")).toBe(true);
        const revoked = fakeClient({ sub: "agent:agent-1" }, { intents_api_enabled: false });
        expect(await refreshEntitlementsIfStale(session, revoked, { force: true })).toBe(true);
        expect(session.toolsets.has("intents")).toBe(false);
    });

    it("a refresh that cannot even get a token keeps the trusted snapshot", async () => {
        const cred: SessionCredential = { agentApiKey: "ocv_a" };
        const first = await resolveEntitlements(fakeClient({ sub: "agent:agent-1" }, { intents_api_enabled: true }));
        const session = attachEntitlements(cred, first);
        const dead = fakeClient(new Error("network") as never);
        expect(await refreshEntitlementsIfStale(session, dead, { force: true })).toBe(false);
        expect(session.entitlements.lookup).toBe("full");
        expect(session.toolsets.has("intents")).toBe(true);
    });

    it("honours the toolset override across refreshes", async () => {
        const cred: SessionCredential = { agentApiKey: "ocv_a" };
        const first = await resolveEntitlements(fakeClient({ sub: "agent:agent-1" }, { intents_api_enabled: true }));
        const session = attachEntitlements(cred, first, "vault");
        expect([...session.toolsets].sort()).toEqual(["inspect", "vault"]);
        await refreshEntitlementsIfStale(session, fakeClient({ sub: "agent:agent-1" }, { intents_api_enabled: true }), { force: true });
        expect([...session.toolsets].sort()).toEqual(["inspect", "vault"]);
    });
});

describe("secret cache scoping", () => {
    it("evicts within the filling agent's scope only", () => {
        clearSecrets();
        registerSecret("b/one", "bbbbbbbbbbbbbbbbbbbb-b-1", "agent-b");
        for (let i = 0; i < 1000; i++) registerSecret(`a/${i}`, `aaaaaaaaaaaaaaaaaaaa-a-${i}`, "agent-a");
        expect(trackedSecretCount("agent-a")).toBe(1000);
        registerSecret("a/overflow", "aaaaaaaaaaaaaaaaaaaa-a-overflow", "agent-a");
        expect(trackedSecretCount("agent-a")).toBe(1000);
        expect(trackedSecretCount("agent-b")).toBe(1);
        clearSecrets();
    });
});
