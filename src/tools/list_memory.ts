import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function listMemoryTool(client: OneClawClient) {
  return {
    name: "list_memory" as const,
    description:
      "List memory entries in a namespace. Returns all keys and their metadata for the given agent and namespace.",
    parameters: z.object({
      agent_id: z
        .string()
        .min(1)
        .describe("The agent ID. Use 'me' to refer to the calling agent."),
      namespace: z
        .string()
        .min(1)
        .describe("Memory namespace to list (e.g. 'context', 'preferences', 'state')"),
    }),
    execute: async (
      args: { agent_id: string; namespace: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const agentId = args.agent_id === "me" ? client.agentId! : args.agent_id;
        if (!agentId) {
          throw new UserError("Cannot resolve agent ID. Provide an explicit agent_id or authenticate as an agent.");
        }

        const result = await client.listMemory(agentId, args.namespace);
        log.info(`memory listed: ${args.namespace}`);

        const entries = (result as { entries?: Array<Record<string, unknown>> }).entries ?? [];
        if (entries.length === 0) {
          return `No memory entries found in namespace '${args.namespace}'.`;
        }

        const lines = entries.map((e) => {
          const parts = [`- ${e.key}`];
          if (e.expires_at) parts.push(`(expires: ${e.expires_at})`);
          if (e.created_at) parts.push(`(created: ${e.created_at})`);
          return parts.join(" ");
        });

        return `Found ${entries.length} entry/entries in '${args.namespace}':\n${lines.join("\n")}`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Agent or namespace not found: ${err.detail}`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
