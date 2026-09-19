import type { ToolsetModule } from "./types.js";
import { createVaultTool } from "../tools/create_vault.js";
import { deleteSecretTool } from "../tools/delete_secret.js";
import { describeSecretTool } from "../tools/describe_secret.js";
import { getEnvBundleTool, resolveEnvTool } from "../tools/env.js";
import { getSecretTool } from "../tools/get_secret.js";
import { grantAccessTool } from "../tools/grant_access.js";
import { listChildAgentsTool } from "../tools/list_child_agents.js";
import { listOAuthConnectionsTool } from "../tools/list_oauth_connections.js";
import { listOAuthProvidersTool } from "../tools/list_oauth_providers.js";
import { listSecretsTool } from "../tools/list_secrets.js";
import { listVaultsTool } from "../tools/list_vaults.js";
import { oauthRevokeConsentTool } from "../tools/oauth_revoke_consent.js";
import { oauthRevokeTokenTool } from "../tools/oauth_revoke_token.js";
import { putSecretTool } from "../tools/put_secret.js";
import { listVersionsTool, rotateAndStoreTool, rotateGenerateTool } from "../tools/secret_versions.js";
import { shareSecretTool } from "../tools/share_secret.js";

/** vault: any agent session. */
export const vaultToolset: ToolsetModule = {
    id: "vault",
    gate: "any agent session",
    tools: [
        listSecretsTool,
        getSecretTool,
        putSecretTool,
        deleteSecretTool,
        describeSecretTool,
        listVersionsTool,
        rotateAndStoreTool,
        rotateGenerateTool,
        getEnvBundleTool,
        listChildAgentsTool,
        resolveEnvTool,
        shareSecretTool,
        grantAccessTool,
        createVaultTool,
        listVaultsTool,
        listOAuthConnectionsTool,
        listOAuthProvidersTool,
        oauthRevokeConsentTool,
        oauthRevokeTokenTool,
    ],
};
