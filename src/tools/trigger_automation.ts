import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function triggerAutomationTool(client: OneClawClient) {
  return {
    name: "trigger_automation" as const,
    description:
      "Manually trigger an automation by ID. Optionally provide input data that the automation receives as its execution payload.",
    parameters: z.object({
      automation_id: z
        .string()
        .min(1)
        .describe("The UUID of the automation to trigger"),
      input: z
        .record(z.unknown())
        .optional()
        .describe("Optional JSON input to pass to the automation"),
    }),
    execute: async (
      args: { automation_id: string; input?: Record<string, unknown> },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.triggerAutomation(args.automation_id, args.input);
        log.info(`automation triggered: ${args.automation_id}`);

        const runId = (result as { run_id?: string }).run_id;
        let msg = `Automation '${args.automation_id}' triggered successfully.`;
        if (runId) msg += ` Run ID: ${runId}`;
        return msg;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Automation not found: ${args.automation_id}`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 409) throw new UserError(`Automation is already running or disabled: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
