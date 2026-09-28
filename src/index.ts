#!/usr/bin/env node
// 1claw MCP server — umbrella entrypoint: every toolset, the full client.

// FIRST, and it has to stay first. ESM evaluates imported modules in source
// order, so this refuses an unsupported Node while the rest of the graph is
// still unevaluated. Below it, `./client.js` pulls in undici, which on Node
// 18 throws `ReferenceError: File is not defined` at import time — the
// process dies mid-handshake and the client reports only "Server
// disconnected". See require-node.ts.
import "./require-node.js";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OneClawClient } from "./client.js";
import { TOOLSET_MODULES } from "./toolsets/index.js";
import { startServer } from "./core/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as { version: string };

/** Resolves once the server is listening. Also the handle the in-process test harness uses. */
export const running = startServer({
    name: "1claw",
    version: pkg.version,
    modules: TOOLSET_MODULES,
    createClient: (config) => new OneClawClient(config),
});
export const started: Promise<void> = running.then(() => undefined);
