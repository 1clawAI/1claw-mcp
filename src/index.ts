#!/usr/bin/env node
// 1claw MCP server — umbrella entrypoint: every toolset, the full client.

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
