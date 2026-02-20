import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function describeSecretTool(client: OneClawClient) {
  return {
    name: "describe_secret" as const,
    description:
      "Get metadata for a secret (type, version, expiry, access count) without fetching its value. Use this to check if a secret exists or is still valid before fetching it.",
    parameters: z.object({
      path: z
        .string()
        .min(1)
        .describe("Secret path to describe, e.g. 'api-keys/stripe'"),
    }),
    execute: async (args: { path: string }) => {
      const data = await client.listSecrets();
      const match = data.secrets.find((s) => s.path === args.path);

      if (!match) {
        try {
          const secret = await client.getSecret(args.path);
          return JSON.stringify(
            {
              path: secret.path,
              type: secret.type,
              version: secret.version,
              metadata: secret.metadata,
              created_at: secret.created_at,
              expires_at: secret.expires_at,
            },
            null,
            2,
          );
        } catch (err) {
          if (err instanceof OneClawApiError) {
            if (err.status === 404) {
              throw new UserError(`No secret found at path '${args.path}'.`);
            }
            if (err.status === 410) {
              throw new UserError(
                `Secret at path '${args.path}' is expired or has exceeded its maximum access count.`,
              );
            }
          }
          throw err;
        }
      }

      return JSON.stringify(
        {
          path: match.path,
          type: match.type,
          version: match.version,
          metadata: match.metadata,
          created_at: match.created_at,
          expires_at: match.expires_at,
        },
        null,
        2,
      );
    },
  };
}
