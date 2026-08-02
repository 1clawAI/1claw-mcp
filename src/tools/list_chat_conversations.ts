import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function listChatConversationsTool(client: OneClawClient) {
  return {
    name: "list_chat_conversations" as const,
    description:
      "List chat conversations for an agent. Returns conversation IDs, titles, modes, models, and timestamps.",
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
          "list_chat_conversations requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const result = await client.listChatConversations(agentId) as {
          conversations: Array<{
            id: string;
            title?: string;
            mode: string;
            model?: string;
            provider?: string;
            created_at: string;
            updated_at: string;
          }>;
        };

        const convos = result.conversations ?? [];
        log.info(`listed ${convos.length} conversation(s)`);

        if (convos.length === 0) return "No conversations found for this agent.";

        return convos
          .map((c) => {
            const parts = [
              `ID: ${c.id}`,
              `Title: ${c.title ?? "(untitled)"}`,
              `Mode: ${c.mode}`,
            ];
            if (c.model) parts.push(`Model: ${c.model}`);
            if (c.provider) parts.push(`Provider: ${c.provider}`);
            parts.push(`Updated: ${c.updated_at}`);
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
