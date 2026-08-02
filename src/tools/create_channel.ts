import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function createChannelTool(client: OneClawClient) {
  return {
    name: "create_channel" as const,
    description:
      "Register a messaging channel (Telegram, WhatsApp, or Discord) for an agent. The channel enables the agent to send and receive messages via the platform. Returns the channel ID and webhook URL.",
    parameters: z.object({
      agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
      channel_type: z
        .enum(["telegram", "whatsapp", "discord"])
        .describe("Channel type: telegram, whatsapp, or discord."),
      channel_name: z.string().optional().describe("Optional display name for the channel."),
      config: z
        .record(z.string())
        .describe(
          "Channel config. Telegram: { bot_token }. WhatsApp: { phone_number_id, access_token, verify_token }. Discord: { bot_token, application_id }.",
        ),
    }),
    execute: async (
      args: {
        agent_id?: string;
        channel_type: string;
        channel_name?: string;
        config: Record<string, string>;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "create_channel requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const result = await client.createChannel(agentId, {
          channel_type: args.channel_type,
          channel_name: args.channel_name,
          config: args.config,
        }) as {
          id: string;
          channel_type: string;
          channel_name?: string;
          webhook_url?: string;
          is_active: boolean;
          created_at: string;
        };

        log.info(`channel created: ${result.channel_type} (${result.id})`);

        const parts = [
          `Channel created successfully.`,
          `ID: ${result.id}`,
          `Type: ${result.channel_type}`,
        ];
        if (result.channel_name) parts.push(`Name: ${result.channel_name}`);
        if (result.webhook_url) parts.push(`Webhook URL: ${result.webhook_url}`);
        parts.push(`Active: ${result.is_active}`);

        return parts.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 400) throw new UserError(`Invalid request: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
