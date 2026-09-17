import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
    TOOL_CATALOG,
    TOOLSET_IDS,
    SECRET_READ_TOOLS,
    resolveToolsets,
    visibleToolNames,
    toolVisible,
    unknownEntitlements,
    parseToolsetOverride,
    type Entitlements,
} from "../toolsets.js";
import { SECRET_TOOLS } from "../security/index.js";
import { installToolsets } from "../toolsets.js";
import { TOOLSET_MODULES } from "../toolsets/index.js";

installToolsets(TOOLSET_MODULES);

const here = dirname(fileURLToPath(import.meta.url));

/** Every `name: "<tool>"` literal in src/tools plus the tools defined inline in index.ts. */
function everyToolName(): Set<string> {
    const names = new Set<string>();
    const toolsDir = join(here, "..", "tools");
    for (const f of readdirSync(toolsDir)) {
        if (!f.endsWith(".ts")) continue;
        const src = readFileSync(join(toolsDir, f), "utf8");
        for (const m of src.matchAll(/name:\s*"([a-z][a-z0-9_]*)"/g)) names.add(m[1]);
    }
    const index = readFileSync(join(here, "..", "index.ts"), "utf8");
    for (const m of index.matchAll(/^\s+name:\s*"([a-z][a-z0-9_]*)",\s*$/gm)) names.add(m[1]);
    return names;
}

const agent = (over: Partial<Entitlements> = {}): Entitlements => ({
    ...unknownEntitlements("full"),
    agentId: "agent-1",
    ...over,
});

describe("toolset catalog", () => {
    it("assigns every registered tool to exactly one toolset", () => {
        const names = everyToolName();
        expect(names.size).toBeGreaterThan(150);
        const missing = [...names].filter((n) => !TOOL_CATALOG.has(n));
        expect(missing).toEqual([]);
        const stale = [...TOOL_CATALOG.keys()].filter((n) => !names.has(n));
        expect(stale).toEqual([]);
    });

    it("keeps the secret-read hide list and the redaction skip list in one place", () => {
        expect(SECRET_READ_TOOLS).toContain("resolve_env");
        for (const t of SECRET_READ_TOOLS) expect(SECRET_TOOLS.has(t)).toBe(true);
        expect(SECRET_TOOLS.has("put_secret")).toBe(true);
    });
});

describe("resolveToolsets", () => {
    it("vault-only agent sees inspect + vault + approvals and nothing else", () => {
        const e = agent();
        const ts = resolveToolsets(e);
        expect([...ts].sort()).toEqual(["approvals", "inspect", "vault"]);
        const visible = visibleToolNames(ts, e);
        expect(visible).toContain("get_secret");
        expect(visible).toContain("request_approval");
        expect(visible).not.toContain("sign_transaction");
        expect(visible).not.toContain("platform_transfer_ownership");
        expect(visible).not.toContain("create_binding");
        expect(visible.length).toBeLessThan(30);
    });

    it("flags turn toolsets on", () => {
        const e = agent({ intentsApi: true, executionIntents: true, cards: true, memory: true, shroud: true, discoverable: true });
        const ts = resolveToolsets(e);
        for (const t of ["intents", "execute", "cards", "memory", "channels", "directory"]) expect(ts.has(t as never)).toBe(true);
        // chat is opt-in even with shroud
        expect(ts.has("chat")).toBe(false);
        const visible = visibleToolNames(ts, e);
        expect(visible).toContain("sign_transaction");
        expect(visible).toContain("execute_http");
        expect(visible).toContain("get_peer_context");
    });

    it("execution_require_tee hides secret reads and keeps writes", () => {
        const e = agent({ executionRequireTee: true });
        const ts = resolveToolsets(e);
        const visible = visibleToolNames(ts, e);
        for (const t of ["get_secret", "get_env_bundle", "resolve_env"]) expect(visible).not.toContain(t);
        for (const t of ["put_secret", "rotate_and_store", "rotate_generate", "describe_secret", "list_secrets", "list_versions"]) {
            expect(visible).toContain(t);
        }
    });

    it("'all' is everything the agent could use — never platform or admin", () => {
        const e = agent({ intentsApi: true });
        const ts = resolveToolsets(e, "all");
        expect(ts.has("platform")).toBe(false);
        expect(ts.has("admin")).toBe(false);
        for (const t of ["treasury", "delegation", "chat", "automations", "runtimes", "notification", "intents"]) {
            expect(ts.has(t as never)).toBe(true);
        }
        // still entitlement-gated inside "all"
        expect(ts.has("cards")).toBe(false);
    });

    it("an override can narrow or opt in but never widen past entitlements", () => {
        const e = agent();
        const narrowed = resolveToolsets(e, "vault");
        expect([...narrowed].sort()).toEqual(["inspect", "vault"]);
        const widened = resolveToolsets(e, "vault,intents,cards,platform,admin,automations");
        expect([...widened].sort()).toEqual(["automations", "inspect", "vault"]);
    });

    it("a failed lookup fails closed to the agent defaults", () => {
        const e = unknownEntitlements("failed");
        expect([...resolveToolsets(e)].sort()).toEqual(["approvals", "inspect", "vault"]);
        expect(resolveToolsets(e, "all").has("intents")).toBe(false);
    });

    it("a user JWT (stdio only) gets admin; an agent never can, even by asking", () => {
        const user: Entitlements = { ...unknownEntitlements("jwt_only"), principal: "user" };
        expect(resolveToolsets(user).has("admin")).toBe(true);
        expect(resolveToolsets(user, "vault").has("admin")).toBe(false);
        expect(resolveToolsets(agent(), "admin").has("admin")).toBe(false);
        expect(resolveToolsets(agent(), "all").has("admin")).toBe(false);
    });

    it("local-only mode is inspect only", () => {
        const e = unknownEntitlements("none");
        expect([...resolveToolsets(e)]).toEqual(["inspect"]);
        expect([...resolveToolsets(e, "all")]).toEqual(["inspect"]);
    });

    it("parses overrides forgivingly", () => {
        expect(parseToolsetOverride(undefined)).toBeUndefined();
        expect(parseToolsetOverride("")).toBeUndefined();
        expect(parseToolsetOverride(" Vault , nope ,ALL")).toEqual({ all: true, toolsets: [], unknown: [] });
        expect(parseToolsetOverride("vault,nope")).toEqual({ all: false, toolsets: ["vault"], unknown: ["nope"] });
        expect(TOOLSET_IDS).toContain("vault");
    });

    it("toolVisible is false for unknown tools", () => {
        expect(toolVisible("no_such_tool", new Set(["vault"]), agent())).toBe(false);
    });
});
