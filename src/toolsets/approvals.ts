import type { ToolsetModule } from "./types.js";
import { getApprovalTool } from "../tools/get_approval.js";
import { getApprovalStatusTool } from "../tools/get_approval_status.js";
import { listApprovalsTool } from "../tools/list_approvals.js";
import { listPendingApprovalsTool } from "../tools/pending_approvals.js";
import { requestApprovalTool } from "../tools/request_approval.js";

/** approvals: any agent session. */
export const approvalsToolset: ToolsetModule = {
    id: "approvals",
    gate: "any agent session",
    tools: [
        requestApprovalTool,
        getApprovalStatusTool,
        getApprovalTool,
        listApprovalsTool,
        listPendingApprovalsTool,
    ],
};
