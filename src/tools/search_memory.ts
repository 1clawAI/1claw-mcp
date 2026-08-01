import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function searchMemoryTool(client: OneClawClient) {
  return {
    name: "search_memory" as const,
    description:
      "Search agent memory using semantic similarity",
    parameters: z.object({
      agent_id: z
        .string()
        .min(1)
        .describe("The agent ID. Use 'me' to refer to the calling agent."),
      namespace: z
        .string()
        .min(1)
        .describe("Memory namespace to search within"),
      query: z
        .string()
        .min(1)
        .describe("Natural language search query for semantic similarity matching"),
      top_k: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Number of results to return (default 5)"),
    }),
    execute: async (
      args: { agent_id: string; namespace: string; query: string; top_k?: number },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const agentId = args.agent_id === "me" ? client.agentId! : args.agent_id;
        if (!agentId) {
          throw new UserError("Cannot resolve agent ID. Provide an explicit agent_id or authenticate as an agent.");
        }

        const result = await client.searchMemory(agentId, {
          namespace: args.namespace,
          query: args.query,
          top_k: args.top_k ?? 5,
        });
        log.info(`search_memory: namespace=${args.namespace} query="${args.query}"`);

        const results = (result as { results?: Array<Record<string, unknown>> }).results ?? [];
        if (results.length === 0) {
          return `No memory entries found matching query "${args.query}" in namespace '${args.namespace}'.`;
        }

        const lines = results.map((r, i) => {
          const parts = [`${i + 1}. ${r.key}`];
          if (r.score !== undefined) parts.push(`(score: ${(r.score as number).toFixed(3)})`);
          if (r.value !== undefined) parts.push(`— ${JSON.stringify(r.value).slice(0, 200)}`);
          return parts.join(" ");
        });

        return `Found ${results.length} result(s) in '${args.namespace}':\n${lines.join("\n")}`;
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
