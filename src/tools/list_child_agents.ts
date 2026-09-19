import { z } from "zod";
import type { OneClawClient } from "../client.js";
import { OneClawApiError } from "../client/core.js";

export function listChildAgentsTool(client: OneClawClient) {
  return {
    name: "list_child_agents" as const,
    description:
      "List this agent's child agents (vault ≥ 0.61.30). A child is a cheap sub-agent a human " +
      "created under a parent for fan-out work: its own API key, memory namespaces and approval " +
      "policy, a subset of the parent's vaults and scopes, the parent's policies inherited, not " +
      "counted against the plan's agent cap. Creation is human-only (POST /v1/agents/{id}/children).",
    parameters: z.object({
      agent_id: z.string().describe("Parent agent UUID (an agent may only list its own children)"),
    }),
    execute: async (
      args: { agent_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.listChildAgents(args.agent_id);
        const agents = result.agents ?? [];
        log.info(`listed ${agents.length} child agent(s)`);
        if (agents.length === 0) return "No child agents.";
        return agents
          .map((a) => {
            const r = a as unknown as { id: string; name: string; scopes?: string[]; is_active?: boolean };
            return `${r.name} (${r.id}) scopes=${(r.scopes ?? []).join(",") || "-"}${r.is_active === false ? " [inactive]" : ""}`;
          })
          .join("\n");
      } catch (e) {
        if (e instanceof OneClawApiError) return `Error: ${e.message}`;
        throw e;
      }
    },
  };
}
