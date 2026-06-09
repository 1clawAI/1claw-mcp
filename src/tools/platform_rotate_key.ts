import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function platformRotateKeyTool(client: OneClawClient) {
  return {
    name: "platform_rotate_key" as const,
    description:
      "Rotate the API key for a platform app. Returns a new one-time API key — store it securely, it cannot be retrieved again.",
    parameters: z.object({
      app_id: z
        .string()
        .uuid()
        .describe("The platform app ID whose key should be rotated"),
      api_key_expires_at: z
        .string()
        .optional()
        .describe("ISO 8601 expiration timestamp for the new key (e.g. '2025-12-31T23:59:59Z')"),
    }),
    execute: async (
      args: { app_id: string; api_key_expires_at?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.platformRotateKey(args.app_id, {
          api_key_expires_at: args.api_key_expires_at,
        });
        log.info(`platform app key rotated: ${args.app_id}`);

        const lines = [
          `Platform app key rotated successfully.`,
          `  Key prefix: ${result.api_key_prefix}`,
        ];

        if (result.api_key_expires_at) {
          lines.push(`  Key expires: ${result.api_key_expires_at}`);
        }

        lines.push(``);
        lines.push(`  New API Key prefix: ${result.api_key.slice(0, 12)}…`);
        lines.push(
          `  (Full key available in the dashboard — not shown in MCP output for security)`,
        );

        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403)
            throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 404)
            throw new UserError(`Platform app not found: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
