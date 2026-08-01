import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function listAutomationsTool(client: OneClawClient) {
  return {
    name: "list_automations" as const,
    description:
      "List all automations configured for the current organization. Returns automation names, schedules, and status.",
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
          return "No automations found.";
        }

        const lines = automations.map((a) => {
          const parts = [`- ${a.name ?? a.id}`];
          if (a.status) parts.push(`[${a.status}]`);
          if (a.schedule) parts.push(`(schedule: ${a.schedule})`);
          if (a.description) parts.push(`— ${a.description}`);
          return parts.join(" ");
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
