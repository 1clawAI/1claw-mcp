import type { ToolsetModule } from "./types.js";
import { getPortfolioTool } from "../tools/get_portfolio.js";
import { getSigningKeyBalanceTool } from "../tools/get_signing_key_balance.js";
import { getTransactionTool } from "../tools/get_transaction.js";
import { importSigningKeyTool } from "../tools/import_signing_key.js";
import { importSmartAccountTool } from "../tools/import_smart_account.js";
import { leaseBankrKeyTool } from "../tools/lease_bankr_key.js";
import { listSigningKeysTool } from "../tools/list_signing_keys.js";
import { listTransactionsTool } from "../tools/list_transactions.js";
import { provisionSigningKeyTool } from "../tools/provision_signing_key.js";
import { listAgentAccountsTool, getSafeModuleRegistryTool } from "../tools/safe_accounts.js";
import { signDigestTool } from "../tools/sign_digest.js";
import { signMessageTool } from "../tools/sign_message.js";
import { signTransactionTool } from "../tools/sign_transaction.js";
import { signTypedDataTool } from "../tools/sign_typed_data.js";
import { simulateBundleTool } from "../tools/simulate_bundle.js";
import { simulateTransactionTool } from "../tools/simulate_transaction.js";
import { spendFromPasskeySafeTool } from "../tools/spend_from_passkey_safe.js";
import { submitTransactionTool } from "../tools/submit_transaction.js";

/** intents: agent flag intents_api_enabled. */
export const intentsToolset: ToolsetModule = {
    id: "intents",
    gate: "agent flag intents_api_enabled",
    tools: [
        simulateTransactionTool,
        simulateBundleTool,
        submitTransactionTool,
        signTransactionTool,
        signMessageTool,
        signTypedDataTool,
        signDigestTool,
        listTransactionsTool,
        getTransactionTool,
        provisionSigningKeyTool,
        importSigningKeyTool,
        listSigningKeysTool,
        getSigningKeyBalanceTool,
        getPortfolioTool,
        importSmartAccountTool,
        listAgentAccountsTool,
        getSafeModuleRegistryTool,
        leaseBankrKeyTool,
        spendFromPasskeySafeTool,
    ],
};
