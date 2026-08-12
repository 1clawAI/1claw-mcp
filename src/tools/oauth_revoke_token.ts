import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function oauthRevokeTokenTool(client: OneClawClient) {
  return {
    name: "oauth_revoke_token" as const,
    description:
      "Revoke an OAuth access token or refresh token issued by 1Claw's OAuth authorization server. Follows RFC 7009 token revocation.",
    parameters: z.object({
      token: z
        .string()
        .min(1)
        .describe("The access token or refresh token to revoke"),
      token_type_hint: z
        .enum(["access_token", "refresh_token"])
        .optional()
        .describe("Hint about the token type being revoked (access_token or refresh_token)"),
    }),
    execute: async (
      args: { token: string; token_type_hint?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        await client.oauthRevokeToken({
          token: args.token,
          token_type_hint: args.token_type_hint,
        });
        log.info("OAuth token revoked");
        return "OAuth token revoked successfully.";
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 401) throw new UserError(`Unauthorized: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
