import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function listRuntimesTool(client: OneClawClient) {
  return {
    name: "list_runtimes" as const,
    description:
      "List all agent runtimes for the current organization. Returns runtime names, status, and configuration.",
    parameters: z.object({}),
    execute: async (
      _args: Record<string, never>,
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.listRuntimes();
        log.info("listed runtimes");

        const runtimes = (result as { runtimes?: Array<Record<string, unknown>> }).runtimes ?? [];
        if (runtimes.length === 0) {
          return "No runtimes found.";
        }

        const lines = runtimes.map((r) => {
          const parts = [`- ${r.name ?? r.id}`];
          if (r.status) parts.push(`[${r.status}]`);
          if (r.runtime_type) parts.push(`(type: ${r.runtime_type})`);
          if (r.agent_id) parts.push(`(agent: ${r.agent_id})`);
          return parts.join(" ");
        });

        return `Found ${runtimes.length} runtime(s):\n${lines.join("\n")}`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
