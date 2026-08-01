import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function getMemoryTool(client: OneClawClient) {
  return {
    name: "get_memory" as const,
    description:
      "Read a value from agent memory. Retrieves a previously stored JSON value by namespace and key.",
    parameters: z.object({
      agent_id: z
        .string()
        .min(1)
        .describe("The agent ID. Use 'me' to refer to the calling agent."),
      namespace: z
        .string()
        .min(1)
        .describe("Memory namespace (e.g. 'context', 'preferences', 'state')"),
      key: z
        .string()
        .min(1)
        .describe("Key within the namespace"),
    }),
    execute: async (
      args: { agent_id: string; namespace: string; key: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const agentId = args.agent_id === "me" ? client.agentId! : args.agent_id;
        if (!agentId) {
          throw new UserError("Cannot resolve agent ID. Provide an explicit agent_id or authenticate as an agent.");
        }

        const result = await client.getMemory(agentId, args.namespace, args.key);
        log.info(`memory read: ${args.namespace}/${args.key}`);
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Memory entry not found: ${args.namespace}/${args.key}`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
