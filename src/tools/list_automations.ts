import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function listAutomationsTool(client: OneClawClient) {
  return {
    name: "list_automations" as const,
    description:
      "List all automations configured for the current organization. Returns names, trigger type, cron, and active status.",
    parameters: z.object({}),
    execute: async (
      _args: Record<string, never>,
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.listAutomations();
        log.info("listed automations");

        const automations = (result as { automations?: Array<Record<string, unknown>> }).automations ?? [];
        if (automations.length === 0) {
          return (
            "No automations found.\n\n" +
            "Hint: use create_agent_automation to create a simple manual/webhook workflow " +
            "(log, notify, memory, wait steps), or ask your operator to configure advanced automations in the dashboard."
          );
        }

        const lines = automations.map((a) => {
          const active = a.is_active === false ? "inactive" : "active";
          const trigger = typeof a.trigger_type === "string" ? a.trigger_type : "unknown";
          const cron =
            typeof a.cron_expr === "string" && a.cron_expr.length > 0
              ? ` cron: ${a.cron_expr}`
              : "";
          return `- ${a.name ?? a.id} [${active}] (${trigger}${cron})`;
        });

        return `Found ${automations.length} automation(s):\n${lines.join("\n")}`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
