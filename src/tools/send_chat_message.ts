import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function sendChatMessageTool(client: OneClawClient) {
  return {
    name: "send_chat_message" as const,
    description:
      "Send a chat message to an agent and receive a response via Shroud LLM. Optionally continue an existing conversation by providing a conversation_id.",
    parameters: z.object({
      agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
      message: z.string().min(1).describe("The message to send to the agent."),
      conversation_id: z.string().optional().describe("Conversation ID to continue an existing conversation."),
      model: z.string().optional().describe("LLM model to use (e.g. gpt-4o, claude-sonnet-4-20250514)."),
      provider: z.string().optional().describe("LLM provider (e.g. openai, anthropic)."),
    }),
    execute: async (
      args: {
        agent_id?: string;
        message: string;
        conversation_id?: string;
        model?: string;
        provider?: string;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "send_chat_message requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const result = await client.sendChatMessage(agentId, {
          message: args.message,
          conversation_id: args.conversation_id,
          model: args.model,
          provider: args.provider,
        }) as {
          conversation_id: string;
          message: {
            role: string;
            content: string;
            model?: string;
            tokens_prompt: number;
            tokens_completion: number;
          };
        };

        log.info(`chat message sent to agent ${agentId}`);

        const parts = [
          `Conversation: ${result.conversation_id}`,
          `Model: ${result.message.model ?? "default"}`,
          "",
          result.message.content,
        ];

        if (result.message.tokens_prompt || result.message.tokens_completion) {
          parts.push(
            "",
            `(${result.message.tokens_prompt} prompt + ${result.message.tokens_completion} completion tokens)`,
          );
        }

        return parts.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
