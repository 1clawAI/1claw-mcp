import type { ToolsetModule } from "./types.js";
import { cancelAutomationRunTool } from "../tools/cancel_automation_run.js";
import { createAgentAutomationTool } from "../tools/create_agent_automation.js";
import { listAutomationPresetsTool } from "../tools/list_automation_presets.js";
import { listAutomationsTool } from "../tools/list_automations.js";
import { triggerAutomationTool } from "../tools/trigger_automation.js";

/** automations: opt-in. */
export const automationsToolset: ToolsetModule = {
    id: "automations",
    gate: "opt-in",
    tools: [
        listAutomationsTool,
        listAutomationPresetsTool,
        createAgentAutomationTool,
        triggerAutomationTool,
        cancelAutomationRunTool,
    ],
};
