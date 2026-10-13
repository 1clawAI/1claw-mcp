import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const src = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(src, "..");

/**
 * Runtime import closure of a TypeScript entry: `import type` lines are
 * erased by tsc and are skipped here, so this is the same graph
 * `scripts/prune-dist.mjs` keeps after a build.
 */
function runtimeClosure(entry: string): Set<string> {
    const seen = new Set<string>();
    const stack = [entry];
    const re = /^\s*(?:import|export)\s+(?!type\s)[^;]*?from\s+["'](\.[^"']+)["']/gm;
    while (stack.length) {
        const f = stack.pop()!;
        if (seen.has(f) || !existsSync(f)) continue;
        seen.add(f);
        const text = readFileSync(f, "utf8");
        for (const m of text.matchAll(re)) {
            stack.push(resolve(dirname(f), m[1].replace(/\.js$/, ".ts")));
        }
    }
    return seen;
}

const rel = (set: Set<string>) => [...set].map((f) => f.replace(repo + "/", "")).sort();

describe("split packages carry only what they claim", () => {
    it("@1claw/mcp-vault has no signing, execute, cards, memory, platform or admin code", () => {
        const files = rel(runtimeClosure(join(repo, "packages/vault/src/index.ts")));
        expect(files).toContain("src/client/secrets.ts");
        expect(files).toContain("src/toolsets/vault.ts");
        expect(files).toContain("src/toolsets/approvals.ts");
        for (const forbidden of [
            "src/client/index.ts", "src/client/intents.ts", "src/client/execute.ts", "src/client/platform.ts",
            "src/client/cards.ts", "src/client/memory.ts", "src/client/admin.ts", "src/toolsets/intents.ts",
            "src/toolsets/execute.ts", "src/toolsets/platform.ts", "src/toolsets/index.ts",
            "src/tools/sign_transaction.ts", "src/tools/execute_http.ts", "src/tools/order_card.ts",
        ]) {
            expect(files, forbidden).not.toContain(forbidden);
        }
        expect(files.filter((f) => f.startsWith("src/tools/")).length).toBeLessThan(30);
    });

    it("@1claw/mcp-guard has no vault client and only the clientless tools", () => {
        const files = rel(runtimeClosure(join(repo, "packages/guard/src/index.ts")));
        expect(files).toContain("src/tools/inspect_content.ts");
        expect(files).toContain("src/security/index.ts");
        for (const f of files) {
            expect(f, f).not.toMatch(/^src\/client\/(?!error\.ts$)/);
            expect(f, f).not.toMatch(/^src\/toolsets\/(?!secret-tools\.ts$)/);
            expect(f, f).not.toMatch(/^src\/auth\//);
        }
        const tools = files.filter((f) => f.startsWith("src/tools/"));
        expect(tools.sort()).toEqual(["src/tools/inspect_content.ts", "src/tools/proxy_request.ts"]);
    });

    it("the umbrella still reaches everything", () => {
        const files = rel(runtimeClosure(join(src, "index.ts")));
        expect(files).toContain("src/toolsets/platform.ts");
        expect(files).toContain("src/client/intents.ts");
    });
});

/**
 * The split packages must carry the umbrella's version.
 *
 * `@1claw/mcp-vault` and `@1claw/mcp-guard` compile the umbrella's own source:
 * their tsconfig sets `rootDir: "../.."` and their entrypoints import from
 * `../../../src/`. So a change to `src/security/index.ts` or `src/core/server.ts`
 * changes what they would publish, without changing anything inside their own
 * directories — and nothing made that visible.
 *
 * Measured 2026-10-13: both sat at 0.63.0 while the umbrella had reached
 * 0.63.11, twelve patch releases apart. Five files in their compile closure had
 * changed in between (`client/core.ts`, `core/server.ts`, `security/index.ts`,
 * `toolsets/vault.ts`, `toolsets/approvals.ts`), so the published packages were
 * missing, among other things, the `stripe_key` and `openai_key` credential
 * shapes added to the security layer. `@1claw/mcp-guard` exists only to run
 * `inspect_content`, which makes a stale pattern set there the sharpest version
 * of the problem.
 *
 * The README and `.cursor/rules/1claw.mdc` both already described these as
 * "lockstep versions". Nothing enforced it, so it was an intention rather than
 * a fact. This makes it a fact: bumping the umbrella now fails this test until
 * the split packages follow, and the publish workflow skips any version already
 * on npm, so a matching bump is what triggers their release.
 */
describe("split package versions", () => {
    it("match the umbrella version exactly", async () => {
        const { readFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const root = join(__dirname, "..", "..");
        const version = (rel: string) =>
            JSON.parse(readFileSync(join(root, rel), "utf8")).version as string;

        const umbrella = version("package.json");
        for (const rel of ["packages/vault/package.json", "packages/guard/package.json"]) {
            expect(
                version(rel),
                `${rel} is ${version(rel)} but the umbrella is ${umbrella}. These packages ` +
                    `compile the umbrella's src/, so a release of it changes what they would ` +
                    `publish. Bump them together, or they ship stale code at a version that ` +
                    `looks current.`,
            ).toBe(umbrella);
        }
    });
});
