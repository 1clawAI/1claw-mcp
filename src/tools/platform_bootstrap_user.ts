import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function platformBootstrapUserTool(client: OneClawClient) {
  return {
    name: "platform_bootstrap_user" as const,
    description:
      "Bootstrap a connected platform user — provisions vaults, agents, and policies from a template. Returns a claim URL the user opens to activate their account.",
    parameters: z.object({
      connection_id: z
        .string()
        .uuid()
        .describe("The connection ID from upsert_user or list_users"),
      template_id: z
        .string()
        .uuid()
        .optional()
        .describe("Template ID to provision from (uses app default if omitted)"),
      return_to: z
        .string()
        .url()
        .optional()
        .describe("URL to redirect the user to after claiming"),
    }),
    execute: async (
      args: {
        connection_id: string;
        template_id?: string;
        return_to?: string;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.platformBootstrapUser(
          args.connection_id,
          {
            template_id: args.template_id,
            return_to: args.return_to,
          },
        );
        log.info(`user bootstrapped: connection=${args.connection_id}`);

        const lines = [
          `User bootstrapped successfully.`,
          `  Connection: ${result.connection_id}`,
          `  Claim URL: ${result.claim_url}`,
          `  Expires in: ${result.expires_in}s`,
        ];

        if (result.summary.vault_id) {
          lines.push(`  Vault: ${result.summary.vault_id}`);
        }
        if (result.summary.agent_id) {
          lines.push(`  Agent: ${result.summary.agent_id}`);
        }
        if (result.summary.policy_ids.length > 0) {
          lines.push(
            `  Policies: ${result.summary.policy_ids.join(", ")}`,
          );
        }

        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403)
            throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 404)
            throw new UserError(`Connection not found: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
