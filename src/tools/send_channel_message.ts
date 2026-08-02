import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function sendChannelMessageTool(client: OneClawClient) {
  return {
    name: "send_channel_message" as const,
    description:
      "Send an outbound message via a registered channel (Telegram, WhatsApp, or Discord). Requires the external chat/user ID of the recipient.",
    parameters: z.object({
      agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
      channel_id: z.string().describe("Channel ID to send through."),
      external_chat_id: z
        .string()
        .describe("External platform chat/user ID (e.g. Telegram chat_id, WhatsApp phone number, Discord channel_id)."),
      content: z.string().min(1).describe("Message content to send."),
    }),
    execute: async (
      args: {
        agent_id?: string;
        channel_id: string;
        external_chat_id: string;
        content: string;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "send_channel_message requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        await client.sendChannelMessage(agentId, args.channel_id, {
          external_chat_id: args.external_chat_id,
          content: args.content,
        });

        log.info(`channel message sent via ${args.channel_id}`);
        return `Message sent successfully to ${args.external_chat_id} via channel ${args.channel_id}.`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 404) throw new UserError(`Channel not found: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
