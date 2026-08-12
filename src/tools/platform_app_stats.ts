import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function platformAppStatsTool(client: OneClawClient) {
  return {
    name: "platform_app_stats" as const,
    description:
      "Get usage statistics for a platform app — connected users, bootstrap count, API request volume, and more.",
    parameters: z.object({
      app_id: z
        .string()
        .uuid()
        .describe("The platform app ID to get statistics for"),
    }),
    execute: async (
      args: { app_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const stats = (await client.platformAppStats(args.app_id)) as {
          app_id: string;
          connected_users?: number;
          active_users?: number;
          total_bootstraps?: number;
          total_api_requests?: number;
          total_grants?: number;
          [key: string]: unknown;
        };

        log.info(`fetched stats for platform app: ${args.app_id}`);

        const lines = [`Statistics for platform app ${args.app_id}:`];
        if (stats.connected_users != null) lines.push(`  Connected users: ${stats.connected_users}`);
        if (stats.active_users != null) lines.push(`  Active users: ${stats.active_users}`);
        if (stats.total_bootstraps != null) lines.push(`  Total bootstraps: ${stats.total_bootstraps}`);
        if (stats.total_api_requests != null) lines.push(`  Total API requests: ${stats.total_api_requests}`);
        if (stats.total_grants != null) lines.push(`  Total grants: ${stats.total_grants}`);

        const extra = Object.entries(stats).filter(
          ([k]) =>
            !["app_id", "connected_users", "active_users", "total_bootstraps", "total_api_requests", "total_grants"].includes(k),
        );
        for (const [k, v] of extra) {
          lines.push(`  ${k}: ${JSON.stringify(v)}`);
        }

        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 404) throw new UserError(`Platform app not found: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
