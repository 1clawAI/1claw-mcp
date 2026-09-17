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
