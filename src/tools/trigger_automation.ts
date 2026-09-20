import { z } from "zod";
import { UserError } from "fastmcp";
import type { OneClawClient } from "../client.js";
import { OneClawApiError } from "../client/core.js";

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
        .describe("Optional JSON input, exposed to steps as {{trigger.*}}"),
      idempotency_key: z
        .string()
        .max(128)
        .optional()
        .describe("Same key twice returns the run already started for it instead of starting another"),
    }),
    execute: async (
      args: { automation_id: string; input?: Record<string, unknown>; idempotency_key?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.triggerAutomation(args.automation_id, args.input, args.idempotency_key);
        log.info(`automation triggered: ${args.automation_id}`);

        const runId = (result as { id?: string; run_id?: string }).id ?? (result as { run_id?: string }).run_id;
        const status = (result as { status?: string }).status;
        let msg = `Automation '${args.automation_id}' triggered.`;
        if (runId) msg += ` Run ID: ${runId}`;
        if (status) msg += ` (status: ${status})`;
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
