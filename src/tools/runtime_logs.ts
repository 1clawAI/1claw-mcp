import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function runtimeLogsTool(client: OneClawClient) {
  return {
    name: "runtime_logs" as const,
    description:
      "Get recent logs from an agent's cloud runtime",
    parameters: z.object({
      runtime_id: z
        .string()
        .min(1)
        .describe("The UUID of the runtime to fetch logs from"),
      lines: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Number of log lines to return (default 50)"),
    }),
    execute: async (
      args: { runtime_id: string; lines?: number },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.getRuntimeLogs(args.runtime_id, args.lines ?? 50);
        log.info(`runtime_logs: ${args.runtime_id} (${args.lines ?? 50} lines)`);

        const logs = (result as { logs?: Array<Record<string, unknown>> | string }).logs;
        if (!logs || (Array.isArray(logs) && logs.length === 0)) {
          return `No logs available for runtime ${args.runtime_id}.`;
        }

        if (typeof logs === "string") {
          return logs;
        }

        const lines = logs.map((entry) => {
          const parts: string[] = [];
          if (entry.timestamp) parts.push(`[${entry.timestamp}]`);
          if (entry.level) parts.push(`${entry.level}`.toUpperCase());
          if (entry.message) parts.push(String(entry.message));
          return parts.join(" ") || JSON.stringify(entry);
        });

        return `Logs for runtime ${args.runtime_id} (${lines.length} lines):\n${lines.join("\n")}`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Runtime not found: ${args.runtime_id}`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
