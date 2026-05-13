import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function platformCreateAppTool(client: OneClawClient) {
  return {
    name: "platform_create_app" as const,
    description:
      "Create a new platform app for multi-tenant integration. Returns the app record and a one-time API key. Store the API key securely — it cannot be retrieved again.",
    parameters: z.object({
      name: z
        .string()
        .min(1)
        .max(255)
        .describe("Display name for the platform app"),
      slug: z
        .string()
        .min(1)
        .max(63)
        .describe("URL-safe slug (e.g. 'my-saas-app')"),
      billing_model: z
        .enum(["platform_pays", "user_pays"])
        .default("platform_pays")
        .describe("Who pays for API usage: the platform or each connected user"),
      auth_mode: z
        .enum(["silent", "explicit"])
        .default("silent")
        .describe("Whether users are silently provisioned or must explicitly consent"),
      description: z
        .string()
        .optional()
        .describe("Short description of the platform app"),
    }),
    execute: async (
      args: {
        name: string;
        slug: string;
        billing_model?: string;
        auth_mode?: string;
        description?: string;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.platformCreateApp(args);
        log.info(`platform app created: ${result.id}`);

        const lines = [
          `Platform app created successfully.`,
          `  ID: ${result.id}`,
          `  Name: ${result.name}`,
          `  Slug: ${result.slug}`,
          `  Billing: ${result.billing_model}`,
          `  Auth mode: ${result.auth_mode}`,
        ];

        if (result.api_key) {
          lines.push(``);
          lines.push(`  API Key (save this — it won't be shown again):`);
          lines.push(`  ${result.api_key}`);
        }

        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403)
            throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 409)
            throw new UserError(`Conflict: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
