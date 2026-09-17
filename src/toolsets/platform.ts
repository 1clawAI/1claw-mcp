import type { ToolsetModule } from "./types.js";
import { platformAppStatsTool } from "../tools/platform_app_stats.js";
import { platformBootstrapUserTool } from "../tools/platform_bootstrap_user.js";
import { platformCreateAppTool } from "../tools/platform_create_app.js";
import { platformCreateTemplateTool } from "../tools/platform_create_template.js";
import { platformDeleteAppTool, platformSiweChallengeTool, platformTransferOwnershipTool, platformGetTemplateTool, platformPreviewTemplateTool, platformListEntitlementsTool, platformGetSpendPolicyTool, platformGetConnectionTool, platformConnectionUsageTool, platformGetConnectionSpendPolicyTool, platformSetConnectionSpendPolicyTool, platformListConnectionApprovalsTool, platformGetConnectionApprovalTool, platformDecideConnectionApprovalTool, platformListConnectionPendingApprovalsTool, platformCreateConnectionPendingApprovalTool, platformDecideConnectionPendingApprovalTool, platformCreateConnectionRuntimeTool, platformGetConnectionRuntimeTool, platformDeleteConnectionRuntimeTool, platformConnectionAgentChatTool, platformListConnectionSigningKeysTool, platformGetConnectionSigningKeyTool, platformDeactivateConnectionSigningKeyTool, platformPatchConnectionAgentTool, platformConnectionPasskeyEnrollBeginTool, platformConnectionPasskeyEnrollCompleteTool, platformGetConnectionPortfolioTool, platformListConnectionAutomationsTool, platformGetConnectionOtelSummaryTool, platformGetConnectionOtelThreatsTool, platformGetConnectionOtelTopologyTool } from "../tools/platform_expansion.js";
import { platformGetFleetTool, platformListFleetAgentsTool, platformPlanFleetRolloutTool } from "../tools/platform_fleet.js";
import { platformGrantAccessTool } from "../tools/platform_grant_access.js";
import { platformListAppsTool } from "../tools/platform_list_apps.js";
import { platformListGrantsTool } from "../tools/platform_list_grants.js";
import { platformListTemplatesTool } from "../tools/platform_list_templates.js";
import { platformListUsersTool } from "../tools/platform_list_users.js";
import { platformMarketplaceTool } from "../tools/platform_marketplace.js";
import { platformReissueClaimTool } from "../tools/platform_reissue_claim.js";
import { platformRotateKeyTool } from "../tools/platform_rotate_key.js";
import { platformRotateWebhookSecretTool } from "../tools/platform_rotate_webhook_secret.js";

/** platform: never — plt_ credentials are rejected. */
export const platformToolset: ToolsetModule = {
    id: "platform",
    gate: "never — plt_ credentials are rejected",
    tools: [
        platformListAppsTool,
        platformCreateAppTool,
        platformDeleteAppTool,
        platformRotateKeyTool,
        platformRotateWebhookSecretTool,
        platformAppStatsTool,
        platformListUsersTool,
        platformBootstrapUserTool,
        platformSiweChallengeTool,
        platformReissueClaimTool,
        platformTransferOwnershipTool,
        platformGrantAccessTool,
        platformListGrantsTool,
        platformMarketplaceTool,
        platformListTemplatesTool,
        platformCreateTemplateTool,
        platformGetTemplateTool,
        platformPreviewTemplateTool,
        platformListEntitlementsTool,
        platformGetSpendPolicyTool,
        platformGetConnectionTool,
        platformConnectionUsageTool,
        platformGetConnectionSpendPolicyTool,
        platformSetConnectionSpendPolicyTool,
        platformListConnectionApprovalsTool,
        platformGetConnectionApprovalTool,
        platformDecideConnectionApprovalTool,
        platformListConnectionPendingApprovalsTool,
        platformCreateConnectionPendingApprovalTool,
        platformDecideConnectionPendingApprovalTool,
        platformCreateConnectionRuntimeTool,
        platformGetConnectionRuntimeTool,
        platformDeleteConnectionRuntimeTool,
        platformConnectionAgentChatTool,
        platformListConnectionSigningKeysTool,
        platformGetConnectionSigningKeyTool,
        platformDeactivateConnectionSigningKeyTool,
        platformPatchConnectionAgentTool,
        platformConnectionPasskeyEnrollBeginTool,
        platformConnectionPasskeyEnrollCompleteTool,
        platformGetConnectionPortfolioTool,
        platformListConnectionAutomationsTool,
        platformGetConnectionOtelSummaryTool,
        platformGetConnectionOtelThreatsTool,
        platformGetConnectionOtelTopologyTool,
        platformGetFleetTool,
        platformListFleetAgentsTool,
        platformPlanFleetRolloutTool,
    ],
};
