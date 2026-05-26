import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function getSecretTool(client: OneClawClient) {
  return {
    name: "get_secret" as const,
    description:
      "Fetch the decrypted value of a secret from the 1claw vault by its path (e.g. 'api-keys/stripe'). Use this immediately before making an API call that requires the credential. Do not store the value or include it in summaries.",
    parameters: z.object({
      path: z
        .string()
        .min(1)
        .describe("Secret path, e.g. 'api-keys/stripe' or 'passwords/db-prod'"),
      client_share: z
        .string()
        .optional()
        .describe("Base64-encoded client share for 2-of-2 MPC vaults. Required when the vault uses client custody."),
    }),
    execute: async (args: { path: string; client_share?: string }, { log }: { log: { info: (msg: string) => void } }) => {
      try {
        const secret = await client.getSecret(args.path, args.client_share);
        log.info(`secret accessed: ${args.path}`);
        return JSON.stringify({
          path: secret.path,
          type: secret.type,
          version: secret.version,
          value: secret.value,
        });
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 410) {
            throw new UserError(
              `Secret at path '${args.path}' is expired or has exceeded its maximum access count.`,
            );
          }
          if (err.status === 404) {
            throw new UserError(`No secret found at path '${args.path}'.`);
          }
          if (err.status === 403) {
            throw new UserError(`Access denied for secret '${args.path}': ${err.detail}`);
          }
        }
        throw err;
      }
    },
  };
}
