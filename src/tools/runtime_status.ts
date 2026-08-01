import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function runtimeStatusTool(client: OneClawClient) {
  return {
    name: "runtime_status" as const,
    description:
      "Get the status of an agent's cloud runtime",
    parameters: z.object({
      agent_id: z
        .string()
        .min(1)
        .describe("The agent ID. Use 'me' to refer to the calling agent."),
    }),
    execute: async (
      args: { agent_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const agentId = args.agent_id === "me" ? client.agentId! : args.agent_id;
        if (!agentId) {
          throw new UserError("Cannot resolve agent ID. Provide an explicit agent_id or authenticate as an agent.");
        }

        const result = await client.getRuntimesForAgent(agentId);
        log.info(`runtime_status: agent ${agentId}`);

        const runtimes = (result as { runtimes?: Array<Record<string, unknown>> }).runtimes ?? [];
        if (runtimes.length === 0) {
          return `No runtime found for agent ${agentId}.`;
        }

        const rt = runtimes[0];
        const parts: string[] = [];
        parts.push(`Runtime ID: ${rt.id}`);
        if (rt.status) parts.push(`Status: ${rt.status}`);
        if (rt.uptime) parts.push(`Uptime: ${rt.uptime}`);
        if (rt.preset) parts.push(`Preset: ${rt.preset}`);
        if (rt.public_url) parts.push(`Public URL: ${rt.public_url}`);
        if (rt.runtime_type) parts.push(`Type: ${rt.runtime_type}`);
        if (rt.created_at) parts.push(`Created: ${rt.created_at}`);

        return parts.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Agent not found: ${args.agent_id}`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
