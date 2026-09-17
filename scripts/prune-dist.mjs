#!/usr/bin/env node
/**
 * Keep only the runtime import closure of an entry file in a dist folder.
 *
 * tsc emits every file in the program, including ones reached only through
 * `import type`, so a split package's dist would otherwise carry the whole
 * client. Emitted JS has type imports erased, so walking `import … from`
 * in the JS is exactly the runtime graph.
 *
 *   node scripts/prune-dist.mjs <distDir> <entryRelativeToDist>
 */
import { readFileSync, readdirSync, statSync, unlinkSync, rmdirSync, existsSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";

const [distDir, entryRel] = process.argv.slice(2);
if (!distDir || !entryRel) {
    console.error("usage: prune-dist.mjs <distDir> <entryRelativeToDist>");
    process.exit(2);
}
const dist = resolve(distDir);
const entry = resolve(dist, entryRel);

const keep = new Set();
const stack = [entry];
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["'](\.[^"']+)["']|import\(\s*["'](\.[^"']+)["']\s*\)/g;
while (stack.length) {
    const f = stack.pop();
    if (keep.has(f) || !existsSync(f)) continue;
    keep.add(f);
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(IMPORT_RE)) {
        const spec = m[1] ?? m[2];
        stack.push(resolve(dirname(f), spec));
    }
}

function walk(dir) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
            walk(p);
            if (readdirSync(p).length === 0) rmdirSync(p);
        } else if (!keep.has(p) && !p.endsWith(".map") && !p.endsWith(".d.ts")) {
            unlinkSync(p);
        } else if ((p.endsWith(".map") || p.endsWith(".d.ts")) && !keep.has(p.replace(/\.js\.map$|\.d\.ts$/, ".js"))) {
            unlinkSync(p);
        }
    }
}
walk(dist);
console.log(`kept ${keep.size} files under ${relative(process.cwd(), dist)}`);
