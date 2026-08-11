import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function listOAuthConnectionsTool(client: OneClawClient) {
  return {
    name: "list_oauth_connections" as const,
    description:
      "List OAuth connected accounts for an agent",
    parameters: z.object({
      agent_id: z.string().describe("Agent ID to list OAuth connections for"),
    }),
    execute: async (
      args: { agent_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "list_oauth_connections requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const result = await client.listOAuthConnections(agentId) as {
          connections: Array<{
            id: string;
            provider_slug: string;
            provider_name?: string;
            account_label?: string;
            status: string;
            scopes?: string[];
            created_at: string;
            expires_at?: string;
          }>;
        };

        const connections = result.connections ?? [];
        log.info(`listed ${connections.length} OAuth connection(s)`);

        if (connections.length === 0) return "No OAuth connections found for this agent.";

        return connections
          .map((c) => {
            const parts = [
              `ID: ${c.id}`,
              `Provider: ${c.provider_slug}`,
            ];
            if (c.provider_name) parts.push(`Provider Name: ${c.provider_name}`);
            if (c.account_label) parts.push(`Account: ${c.account_label}`);
            parts.push(`Status: ${c.status}`);
            if (c.scopes?.length) parts.push(`Scopes: ${c.scopes.join(", ")}`);
            parts.push(`Created: ${c.created_at}`);
            if (c.expires_at) parts.push(`Expires: ${c.expires_at}`);
            return parts.join("\n");
          })
          .join("\n---\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 404) throw new UserError(`Agent not found: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
