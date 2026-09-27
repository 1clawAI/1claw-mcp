import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { installToolsets, TOOL_CATALOG } from "../toolsets.js";
import { TOOLSET_MODULES } from "../toolsets/index.js";

/**
 * How many tools this server offers is a number three other places quote:
 * the marketing site, the `.well-known/mcp` document `1claw.co` serves, and
 * the `serverInfo.instructions` an MCP client reads on `initialize`.
 *
 * On 2026-09-27 they said 160, 30 and 160 respectively, and the truth was
 * 161. The 30 is the one that matters — that document is what an agent reads
 * to decide whether this server is worth connecting to.
 *
 * Every one of those was hand-copied, so every one of them was a snapshot of
 * whenever someone last remembered. `tool-manifest.json` is written from the
 * live catalog and committed, so the number has one source and the consumers
 * have something to check themselves against.
 */
installToolsets(TOOLSET_MODULES);

const manifest = JSON.parse(
  readFileSync(resolve(__dirname, "../../tool-manifest.json"), "utf8"),
) as { total: number; byToolset: Record<string, number> };

function liveCounts() {
  const byToolset: Record<string, number> = {};
  for (const [, set] of TOOL_CATALOG) byToolset[set] = (byToolset[set] ?? 0) + 1;
  return { total: TOOL_CATALOG.size, byToolset };
}

describe("the committed tool manifest", () => {
  it("matches the catalog this server actually installs", () => {
    const live = liveCounts();
    expect(
      manifest.total,
      `tool-manifest.json says ${manifest.total} tools, the server registers ` +
        `${live.total}. Run \`npm run tools:manifest\` and commit the result — ` +
        `the marketing site, the .well-known/mcp document and serverInfo all ` +
        `quote this number.`,
    ).toBe(live.total);
  });

  it("matches per toolset, so a tool moving between them is caught too", () => {
    // A tool moved from `vault` to `admin` leaves the total unchanged while
    // changing what a vault-only agent is offered, which is the number that
    // actually reaches most sessions.
    expect(manifest.byToolset).toEqual(liveCounts().byToolset);
  });

  it("counts every toolset the entrypoint installs", () => {
    // A module dropped from TOOLSET_MODULES would quietly shrink the catalog
    // and the manifest together if the manifest were regenerated blindly.
    for (const module of TOOLSET_MODULES) {
      expect(
        Object.keys(manifest.byToolset),
        `toolset '${module.id}' is installed but absent from the manifest`,
      ).toContain(module.id);
    }
  });
});
