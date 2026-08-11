import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function delegateTaskTool(client: OneClawClient) {
  return {
    name: "delegate_task" as const,
    description:
      "Send a task to another agent via chat. Enables inter-agent communication within the same organization.",
    parameters: z.object({
      agent_id: z.string().min(1).describe("Target agent UUID"),
      message: z.string().min(1).describe("Task or message to send"),
      model: z.string().optional().describe("LLM model"),
      provider: z.string().optional().describe("LLM provider"),
    }),
    execute: async (
      args: {
        agent_id: string;
        message: string;
        model?: string;
        provider?: string;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = (await client.sendChatMessage(args.agent_id, {
          message: args.message,
          model: args.model,
          provider: args.provider,
        })) as {
          conversation_id: string;
          message: {
            role: string;
            content: string;
            model?: string;
            tokens_prompt: number;
            tokens_completion: number;
          };
        };

        log.info(`task delegated to agent ${args.agent_id}`);

        const parts = [
          `Task sent to agent ${args.agent_id}`,
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
          if (err.status === 403) {
            throw new UserError(`Access denied: ${err.detail}`);
          }
          if (err.status === 404) {
            throw new UserError(
              `Agent ${args.agent_id} not found or not accessible.`,
            );
          }
        }
        throw err;
      }
    },
  };
}
