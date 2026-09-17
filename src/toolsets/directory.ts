import type { ToolsetModule } from "./types.js";
import { listDirectoryJobsTool, getDirectoryJobTool, submitDirectoryJobBidTool } from "../tools/directory_jobs.js";
import { searchDirectoryTool } from "../tools/search_directory.js";

/** directory: agent flag discoverable. */
export const directoryToolset: ToolsetModule = {
    id: "directory",
    gate: "agent flag discoverable",
    tools: [
        searchDirectoryTool,
        listDirectoryJobsTool,
        getDirectoryJobTool,
        submitDirectoryJobBidTool,
    ],
};
