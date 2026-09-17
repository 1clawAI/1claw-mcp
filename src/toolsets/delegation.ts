import type { ToolsetModule } from "./types.js";
import { delegateTaskTool } from "../tools/delegate_task.js";
import { listDelegationsTool, createDelegationTool, getEffectiveDelegationsTool } from "../tools/delegation.js";
import { orgDirectoryTool } from "../tools/org_directory.js";

/** delegation: has_delegations on the token exchange, else opt-in. */
export const delegationToolset: ToolsetModule = {
    id: "delegation",
    gate: "has_delegations on the token exchange, else opt-in",
    tools: [
        listDelegationsTool,
        createDelegationTool,
        getEffectiveDelegationsTool,
        delegateTaskTool,
        orgDirectoryTool,
    ],
};
