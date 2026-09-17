import type { ToolsetModule } from "./types.js";
import { listRuntimesTool } from "../tools/list_runtimes.js";
import { manageRuntimeTool } from "../tools/manage_runtime.js";
import { runtimeLogsTool } from "../tools/runtime_logs.js";
import { runtimeStatusTool } from "../tools/runtime_status.js";

/** runtimes: opt-in. */
export const runtimesToolset: ToolsetModule = {
    id: "runtimes",
    gate: "opt-in",
    tools: [
        listRuntimesTool,
        manageRuntimeTool,
        runtimeStatusTool,
        runtimeLogsTool,
    ],
};
