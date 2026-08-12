import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function oauthRevokeConsentTool(client: OneClawClient) {
  return {
    name: "oauth_revoke_consent" as const,
    description:
      "Revoke OAuth consent previously granted to a platform app. This removes the app's access and invalidates any tokens issued through the consent.",
    parameters: z.object({
      app_id: z
        .string()
        .uuid()
        .describe("The platform app ID whose OAuth consent should be revoked"),
    }),
    execute: async (
      args: { app_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        await client.oauthRevokeConsent(args.app_id);
        log.info(`OAuth consent revoked for app: ${args.app_id}`);
        return `OAuth consent revoked for app ${args.app_id}. The app can no longer access your account.`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 404) throw new UserError(`No consent found for app ${args.app_id}`);
        }
        throw err;
      }
    },
  };
}
