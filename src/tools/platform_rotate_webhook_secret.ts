import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function platformRotateWebhookSecretTool(client: OneClawClient) {
  return {
    name: "platform_rotate_webhook_secret" as const,
    description:
      "Rotate the webhook secret for a platform app. The new secret is used to compute HMAC-SHA256 signatures on webhook deliveries.",
    parameters: z.object({
      app_id: z
        .string()
        .uuid()
        .describe("The platform app ID whose webhook secret should be rotated"),
    }),
    execute: async (
      args: { app_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = (await client.platformRotateWebhookSecret(args.app_id)) as {
          webhook_secret_prefix?: string;
          rotated_at?: string;
          [key: string]: unknown;
        };

        log.info(`webhook secret rotated for platform app: ${args.app_id}`);

        const lines = [
          `Webhook secret rotated successfully for app ${args.app_id}.`,
        ];
        if (result.webhook_secret_prefix) {
          lines.push(`  Secret prefix: ${result.webhook_secret_prefix}…`);
        }
        if (result.rotated_at) {
          lines.push(`  Rotated at: ${result.rotated_at}`);
        }
        lines.push(`  (Full secret available in the dashboard — not shown in MCP output for security)`);

        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 404) throw new UserError(`Platform app not found: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
