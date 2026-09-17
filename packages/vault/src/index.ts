#!/usr/bin/env node
// @1claw/mcp-vault — secrets and approvals only. No signing or execute code
// is in this package's tree; see packages/vault/README.md.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { VaultClient } from "../../../src/client/vault-facade.js";
import type { OneClawClient } from "../../../src/client/index.js";
import { vaultToolset } from "../../../src/toolsets/vault.js";
import { approvalsToolset } from "../../../src/toolsets/approvals.js";
import { startServer } from "../../../src/core/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/packages/<name>/src → four up is the package root (its own package.json, lockstep version).
const pkg = JSON.parse(readFileSync(join(__dirname, "../../../../package.json"), "utf8")) as { version: string };

export const running = startServer({
    name: "1claw-vault",
    version: pkg.version,
    modules: [vaultToolset, approvalsToolset],
    // The vault tools only ever call secrets/approvals methods; the wider
    // facade type is what their signatures name, so the narrow client is
    // presented as it. The bundle test proves the rest is not in the tree.
    createClient: (config) => new VaultClient(config) as unknown as OneClawClient,
    instructions:
        "This is the vault-only 1Claw MCP server: secrets, versions, rotation, env bundles, vaults, sharing, " +
        "connected accounts, and human approvals. Signing, execution, cards, memory and platform tools are not " +
        "included in this package — install @1claw/mcp for those.",
});
export const started: Promise<void> = running.then(() => undefined);
