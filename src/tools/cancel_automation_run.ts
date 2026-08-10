import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function cancelAutomationRunTool(client: OneClawClient) {
  return {
    name: "cancel_automation_run" as const,
    description:
      "Cancel a running or awaiting_approval automation run. Only runs with status 'running' or 'awaiting_approval' can be cancelled.",
    parameters: z.object({
      automation_id: z
        .string()
        .min(1)
        .describe("The UUID of the automation"),
      run_id: z
        .string()
        .min(1)
        .describe("The UUID of the run to cancel"),
    }),
    execute: async (
      args: { automation_id: string; run_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.cancelAutomationRun(args.automation_id, args.run_id);
        log.info(`automation run cancelled: ${args.run_id}`);
        return `Run '${args.run_id}' cancelled successfully. Status: ${(result as { status?: string }).status ?? "cancelled"}.`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Automation or run not found`);
          if (err.status === 400) throw new UserError(`Cannot cancel this run: ${err.detail}`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
