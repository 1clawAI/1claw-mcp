import type { z } from "zod";
import type { OneClawClient } from "../client.js";

export type ToolsetId =
    | "inspect"
    | "local"
    | "vault"
    | "approvals"
    | "intents"
    | "execute"
    | "cards"
    | "treasury"
    | "memory"
    | "delegation"
    | "channels"
    | "chat"
    | "automations"
    | "runtimes"
    | "directory"
    | "notification"
    | "admin"
    | "platform";

/** A tool factory: closes over a client, yields a FastMCP-shaped tool. */
export type ToolFactory = (client: OneClawClient) => {
    name: string;
    description: string;
    parameters: z.ZodTypeAny;
    execute: (args: never, ctx: never) => Promise<string>;
};

/**
 * One toolset, owned by one module under `src/toolsets/`. The module says
 * which tools it contains and (as prose, for docs and the server card) when
 * a session gets it; the gate logic itself lives in `toolsets.ts`.
 *
 * Boundary: a toolset module may import `./types`, `../tools/*` and
 * `../client`; never another toolset module. `import_boundaries.test.ts`
 * enforces it so Phase 3 extraction stays mechanical.
 */
export interface ToolsetModule {
    id: ToolsetId;
    gate: string;
    tools: readonly ToolFactory[];
}
