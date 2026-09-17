import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");

function imports(file: string): string[] {
    const text = readFileSync(file, "utf8");
    return [...text.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

function tsFiles(dir: string): string[] {
    return readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => join(dir, f));
}

/**
 * The module layout that makes a later package split mechanical:
 *   toolsets/*  → only ./types, ./secret-tools, ../tools/*, ../client
 *   tools/*     → never toolsets, core or index (inspect_content wraps security)
 *   core/*      → never tools or toolsets modules
 *   security/*  → only toolsets/secret-tools from outside itself
 */
describe("import boundaries", () => {
    it("toolset modules import tools and the client, never each other", () => {
        for (const f of tsFiles(join(src, "toolsets"))) {
            if (f.endsWith("/index.ts")) continue;
            for (const dep of imports(f)) {
                const ok =
                    dep === "./types.js" ||
                    dep === "./secret-tools.js" ||
                    dep.startsWith("../tools/") ||
                    dep === "../client.js" ||
                    dep === "zod";
                expect(ok, `${f} imports ${dep}`).toBe(true);
            }
        }
    });

    it("tool modules never reach up into toolsets, core or the server", () => {
        for (const f of tsFiles(join(src, "tools"))) {
            for (const dep of imports(f)) {
                expect(dep, `${f} imports ${dep}`).not.toMatch(/toolsets|\/core\/|\.\.\/index/);
            }
        }
    });

    it("core never imports a domain tool, a toolset module, or the client facade at runtime", () => {
        for (const f of tsFiles(join(src, "core"))) {
            const text = readFileSync(f, "utf8");
            for (const dep of imports(f)) {
                // The two clientless tools are the only tools core may know about.
                const clientless = dep === "../tools/inspect_content.js" || dep === "../tools/proxy_request.js";
                expect(clientless || !/\/tools\//.test(dep), `${f} imports ${dep}`).toBe(true);
                expect(dep, `${f} imports ${dep}`).not.toMatch(/\/toolsets\/[a-z]+\.js$|toolsets\/index/);
            }
            // The facade may be named as a type only — a value import would drag every domain in.
            expect(text).not.toMatch(/^import \{[^}]*\bOneClawClient\b[^}]*\} from "\.\.\/client(\/index)?\.js"/m);
        }
    });

    it("client domains extend core and never import each other", () => {
        for (const f of tsFiles(join(src, "client"))) {
            // index.ts and vault-facade.ts are the two assembly points; they may name domains.
            if (f.endsWith("/index.ts") || f.endsWith("/vault-facade.ts")) continue;
            for (const dep of imports(f)) {
                const ok =
                    dep === "./core.js" || dep === "./error.js" || dep === "../types.js" || dep === "../auth/dpop.js";
                expect(ok, `${f} imports ${dep}`).toBe(true);
            }
        }
        // core is a leaf among the domains: it must not name a domain method.
        const core = readFileSync(join(src, "client", "core.ts"), "utf8");
        expect(core).not.toMatch(/this\.(listSecrets|listVaults|simulateTransaction|platformListApps)\(/);
    });

    it("the facade mixes in every domain class and each method resolves", async () => {
        const { OneClawClient, CLIENT_DOMAINS } = await import("../client/index.js");
        const c = new OneClawClient({ baseUrl: "http://unused.invalid", token: "", vaultId: "" });
        for (const [domain, cls] of Object.entries(CLIENT_DOMAINS)) {
            for (const name of Object.getOwnPropertyNames(cls.prototype)) {
                if (name === "constructor") continue;
                expect(typeof (c as unknown as Record<string, unknown>)[name], `${domain}.${name}`).toBe("function");
            }
        }
        expect(typeof c.listSecrets).toBe("function");
        expect(typeof c.simulateTransaction).toBe("function");
        expect(typeof c.platformListApps).toBe("function");
    });

    it("the security subpath stays lightweight", () => {
        for (const f of tsFiles(join(src, "security"))) {
            for (const dep of imports(f)) {
                if (dep.startsWith(".")) {
                    expect(dep, `${f} imports ${dep}`).toMatch(/^\.\/|secret-tools\.js$/);
                }
            }
        }
    });
});
