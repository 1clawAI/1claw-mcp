import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function listChannelsTool(client: OneClawClient) {
  return {
    name: "list_channels" as const,
    description:
      "List all messaging channels registered for an agent. Returns channel IDs, types, names, webhook URLs, and active status.",
    parameters: z.object({
      agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
    }),
    execute: async (
      args: { agent_id?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "list_channels requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const result = await client.listChannels(agentId) as {
          channels: Array<{
            id: string;
            channel_type: string;
            channel_name?: string;
            webhook_url?: string;
            is_active: boolean;
            created_at: string;
          }>;
        };

        const channels = result.channels ?? [];
        log.info(`listed ${channels.length} channel(s)`);

        if (channels.length === 0) return "No channels found for this agent.";

        return channels
          .map((ch) => {
            const parts = [
              `ID: ${ch.id}`,
              `Type: ${ch.channel_type}`,
            ];
            if (ch.channel_name) parts.push(`Name: ${ch.channel_name}`);
            if (ch.webhook_url) parts.push(`Webhook: ${ch.webhook_url}`);
            parts.push(`Active: ${ch.is_active}`);
            parts.push(`Created: ${ch.created_at}`);
            return parts.join("\n");
          })
          .join("\n---\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
