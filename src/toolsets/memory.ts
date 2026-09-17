import type { ToolsetModule } from "./types.js";
import { deleteMemoryTool } from "../tools/delete_memory.js";
import { getMemoryTool } from "../tools/get_memory.js";
import { getPeerContextTool } from "../tools/get_peer_context.js";
import { listMemoryTool } from "../tools/list_memory.js";
import { putMemoryTool } from "../tools/put_memory.js";
import { searchMemoryTool } from "../tools/search_memory.js";

/** memory: agent flag memory_enabled. */
export const memoryToolset: ToolsetModule = {
    id: "memory",
    gate: "agent flag memory_enabled",
    tools: [
        putMemoryTool,
        getMemoryTool,
        listMemoryTool,
        searchMemoryTool,
        deleteMemoryTool,
        getPeerContextTool,
    ],
};
