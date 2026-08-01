import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function putMemoryTool(client: OneClawClient) {
  return {
    name: "put_memory" as const,
    description:
      "Write a value to agent memory. Stores a JSON value under a namespace and key for later retrieval. Supports optional TTL for auto-expiry.",
    parameters: z.object({
      agent_id: z
        .string()
        .min(1)
        .describe("The agent ID. Use 'me' to refer to the calling agent."),
      namespace: z
        .string()
        .min(1)
        .describe("Memory namespace (e.g. 'context', 'preferences', 'state')"),
      key: z
        .string()
        .min(1)
        .describe("Key within the namespace"),
      value: z
        .unknown()
        .describe("JSON value to store"),
      ttl_seconds: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Optional TTL in seconds. Entry auto-expires after this duration."),
    }),
    execute: async (
      args: {
        agent_id: string;
        namespace: string;
        key: string;
        value: unknown;
        ttl_seconds?: number;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const agentId = args.agent_id === "me" ? client.agentId! : args.agent_id;
        if (!agentId) {
          throw new UserError("Cannot resolve agent ID. Provide an explicit agent_id or authenticate as an agent.");
        }

        await client.putMemory(agentId, args.namespace, args.key, {
          value: args.value,
          ttl_seconds: args.ttl_seconds,
        });

        log.info(`memory written: ${args.namespace}/${args.key}`);
        let msg = `Memory entry stored: ${args.namespace}/${args.key}`;
        if (args.ttl_seconds) {
          msg += ` (expires in ${args.ttl_seconds}s)`;
        }
        return msg;
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
