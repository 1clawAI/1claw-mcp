import type { ToolsetModule } from "./types.js";
import { executeHttpTool } from "../tools/execute_http.js";
import { executeIntentTool } from "../tools/execute_intent.js";
import { listBindingsTool } from "../tools/list_bindings.js";
import { listConnectorPresetsTool } from "../tools/list_connector_presets.js";
import { listExecutionsTool } from "../tools/list_executions.js";
import { listInstalledConnectorsTool } from "../tools/list_installed_connectors.js";
import { testBindingTool } from "../tools/test_binding.js";

/** execute: agent flag execution_intents_enabled. */
export const executeToolset: ToolsetModule = {
    id: "execute",
    gate: "agent flag execution_intents_enabled",
    tools: [
        listBindingsTool,
        testBindingTool,
        executeHttpTool,
        executeIntentTool,
        listExecutionsTool,
        listInstalledConnectorsTool,
        listConnectorPresetsTool,
    ],
};
