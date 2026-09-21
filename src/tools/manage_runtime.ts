import { z } from "zod";
import { UserError } from "fastmcp";
import type { OneClawClient } from "../client.js";
import { OneClawApiError } from "../client/core.js";

export function manageRuntimeTool(client: OneClawClient) {
  return {
    name: "manage_runtime" as const,
    description:
      "Start, stop or restart an agent runtime, or roll it back to the previous image it ran (rollback restarts on previous_image_digest; 409 when none is recorded).",
    parameters: z.object({
      runtime_id: z
        .string()
        .min(1)
        .describe("The UUID of the runtime to manage"),
      action: z
        .enum(["start", "stop", "restart", "rollback"])
        .describe("'start', 'stop', 'restart', or 'rollback' (restart on the previous resolved image)"),
    }),
    execute: async (
      args: { runtime_id: string; action: "start" | "stop" | "restart" | "rollback" },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.manageRuntime(args.runtime_id, args.action);
        log.info(`runtime ${args.action}: ${args.runtime_id}`);

        const status = (result as { status?: string }).status ?? args.action;
        const verb = { start: "started", stop: "stopped", restart: "restarted", rollback: "rolled back to the previous image" }[args.action];
        return `Runtime '${args.runtime_id}' ${verb}. Status: ${status}`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Runtime not found: ${args.runtime_id}`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 409) throw new UserError(`Runtime cannot ${args.action}: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
