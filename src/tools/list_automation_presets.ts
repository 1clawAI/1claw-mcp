import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function listAutomationPresetsTool(client: OneClawClient) {
  return {
    name: "list_automation_presets" as const,
    description:
      "List available automation presets with pre-built workflow templates",
    parameters: z.object({}),
    execute: async (
      _args: Record<string, never>,
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.listAutomationPresets();
        log.info("listed automation presets");

        const presets = (result as { presets?: Array<Record<string, unknown>> }).presets ?? [];
        if (presets.length === 0) {
          return "No automation presets available.";
        }

        const lines = presets.map((p) => {
          const trigger = typeof p.trigger_type === "string" ? ` (${p.trigger_type})` : "";
          const cron =
            typeof p.default_cron === "string" && p.default_cron.length > 0
              ? ` cron: ${p.default_cron}`
              : "";
          const cost =
            typeof p.estimated_cost_per_run === "string"
              ? ` ~${p.estimated_cost_per_run}/run`
              : "";
          return `- ${p.id ?? p.name}: ${p.description ?? ""}${trigger}${cron}${cost}`;
        });

        return `Found ${presets.length} automation preset(s):\n${lines.join("\n")}`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
