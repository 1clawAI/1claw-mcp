import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function deleteMemoryTool(client: OneClawClient) {
  return {
    name: "delete_memory" as const,
    description:
      "Delete a memory entry. Removes a value from agent memory by namespace and key.",
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
        .describe("Key within the namespace to delete"),
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

        await client.deleteMemory(agentId, args.namespace, args.key);
        log.info(`memory deleted: ${args.namespace}/${args.key}`);
        return `Memory entry '${args.namespace}/${args.key}' has been deleted.`;
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
