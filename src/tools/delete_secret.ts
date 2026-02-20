import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

export function deleteSecretTool(client: OneClawClient) {
  return {
    name: "delete_secret" as const,
    description:
      "Soft-delete a secret at the given path. All versions are marked deleted. This is reversible by an admin.",
    parameters: z.object({
      path: z
        .string()
        .min(1)
        .describe("Secret path to delete, e.g. 'api-keys/old-stripe'"),
    }),
    execute: async (args: { path: string }, { log }: { log: { info: (msg: string) => void } }) => {
      try {
        await client.deleteSecret(args.path);
        log.info(`secret deleted: ${args.path}`);
        return `Secret at '${args.path}' has been soft-deleted.`;
      } catch (err) {
        if (err instanceof OneClawApiError && err.status === 404) {
          throw new UserError(`No secret found at path '${args.path}'.`);
        }
        throw err;
      }
    },
  };
}
