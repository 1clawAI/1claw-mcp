import type { ToolsetModule } from "./types.js";
import { uploadContractAbiTool, listContractAbisTool } from "../tools/contract_abis.js";
import { createBindingTool } from "../tools/create_binding.js";
import { createSubOrgTool } from "../tools/create_sub_org.js";
import { getGuardrailShadowReportTool, listGuardrailRevisionsTool, replayAgentGuardrailsTool } from "../tools/guardrail_governance.js";
import { listCedarPoliciesTool } from "../tools/list_cedar_policies.js";
import { listOpaPoliciesTool } from "../tools/list_opa_policies.js";
import { listSubOrgsTool } from "../tools/list_sub_orgs.js";
import { approvePendingApprovalTool, executePendingApprovalTool } from "../tools/pending_approvals.js";
import { getPolicyBackendSettingsTool, updatePolicyBackendSettingsTool, getShadowReportTool } from "../tools/policy_backend.js";
import { migrateAgentToSafeTool, deprecateAgentEoaTool, syncOrgSafeAllowancesTool } from "../tools/safe_accounts.js";
import { testCedarPolicyTool } from "../tools/test_cedar_policy.js";
import { testOpaPolicyTool } from "../tools/test_opa_policy.js";

/** admin: user principal only (never an agent). */
export const adminToolset: ToolsetModule = {
    id: "admin",
    gate: "user principal only (never an agent)",
    tools: [
        createBindingTool,
        createSubOrgTool,
        listSubOrgsTool,
        approvePendingApprovalTool,
        executePendingApprovalTool,
        migrateAgentToSafeTool,
        deprecateAgentEoaTool,
        syncOrgSafeAllowancesTool,
        listCedarPoliciesTool,
        testCedarPolicyTool,
        listOpaPoliciesTool,
        testOpaPolicyTool,
        getPolicyBackendSettingsTool,
        updatePolicyBackendSettingsTool,
        getShadowReportTool,
        getGuardrailShadowReportTool,
        listGuardrailRevisionsTool,
        replayAgentGuardrailsTool,
        uploadContractAbiTool,
        listContractAbisTool,
    ],
};
