import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function manageRuntimeTool(client: OneClawClient) {
  return {
    name: "manage_runtime" as const,
    description:
      "Start or stop an agent runtime. Use this to control the lifecycle of a runtime instance.",
    parameters: z.object({
      runtime_id: z
        .string()
        .min(1)
        .describe("The UUID of the runtime to manage"),
      action: z
        .enum(["start", "stop"])
        .describe("Action to perform: 'start' to launch the runtime, 'stop' to shut it down"),
    }),
    execute: async (
      args: { runtime_id: string; action: "start" | "stop" },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.manageRuntime(args.runtime_id, args.action);
        log.info(`runtime ${args.action}: ${args.runtime_id}`);

        const status = (result as { status?: string }).status ?? (args.action === "start" ? "starting" : "stopping");
        return `Runtime '${args.runtime_id}' ${args.action === "start" ? "started" : "stopped"} successfully. Status: ${status}`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Runtime not found: ${args.runtime_id}`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 409) throw new UserError(`Runtime cannot be ${args.action === "start" ? "started" : "stopped"}: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
