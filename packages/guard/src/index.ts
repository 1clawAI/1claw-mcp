#!/usr/bin/env node
// @1claw/mcp-guard — inspect_content only. No vault credentials, no vault
// client in the tree; see packages/guard/README.md.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer } from "../../../src/core/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/packages/<name>/src → four up is the package root (its own package.json, lockstep version).
const pkg = JSON.parse(readFileSync(join(__dirname, "../../../../package.json"), "utf8")) as { version: string };

export const running = startServer({
    name: "1claw-guard",
    version: pkg.version,
    modules: [],
    localOnly: true,
    // Never called: with no modules and localOnly forced, no session is
    // admitted and no client is built. Present so the contract is total.
    createClient: () => {
        throw new Error("@1claw/mcp-guard has no vault client");
    },
    instructions:
        "This is the 1Claw guard MCP server: one tool, inspect_content, which scores text for prompt injection, " +
        "command injection, encoded payloads, PII and leaked secrets. It needs no account and makes no network calls.",
});
export const started: Promise<void> = running.then(() => undefined);
