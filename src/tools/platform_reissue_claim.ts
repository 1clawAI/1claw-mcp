import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function platformReissueClaimTool(client: OneClawClient) {
  return {
    name: "platform_reissue_claim" as const,
    description:
      "Reissue a claim URL for an already-bootstrapped connection. Use when the original 10-minute claim token has expired — no resources are re-provisioned.",
    parameters: z.object({
      connection_id: z
        .string()
        .uuid()
        .describe("The connection ID to reissue a claim for"),
      return_to: z
        .string()
        .url()
        .optional()
        .describe("URL to redirect the user to after claiming"),
    }),
    execute: async (
      args: { connection_id: string; return_to?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.platformReissueClaim(
          args.connection_id,
          { return_to: args.return_to },
        );
        log.info(`claim reissued: connection=${args.connection_id}`);

        return [
          `Claim URL reissued successfully.`,
          `  Connection: ${result.connection_id}`,
          `  Claim URL: ${result.claim_url}`,
          `  Expires in: ${result.expires_in}s`,
        ].join("\n");
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
