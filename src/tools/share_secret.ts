import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function shareSecretTool(client: OneClawClient) {
  return {
    name: "share_secret" as const,
    description:
      "Share a specific secret with a user, agent, or your creator (the human who registered you). " +
      "Use recipient_type 'creator' to share back with the human who owns this agent — " +
      "no recipient_id needed. Agents cannot create email-based shares. " +
      "For vault-wide access, use grant_access instead.",
    parameters: z.object({
      secret_id: z
        .string()
        .uuid()
        .describe("UUID of the secret entry to share"),
      recipient_type: z
        .enum(["user", "agent", "anyone_with_link", "creator"])
        .describe(
          "Type of recipient: 'creator' (share with the human who registered this agent — recommended), " +
          "'user' (by UUID), 'agent' (by UUID), or 'anyone_with_link'"
        ),
      recipient_id: z
        .string()
        .uuid()
        .optional()
        .describe("UUID of the recipient user or agent (required for user/agent types, not needed for creator)"),
      expires_at: z
        .string()
        .describe("ISO-8601 expiry date (e.g. '2026-12-31T00:00:00Z')"),
      max_access_count: z
        .number()
        .int()
        .positive()
        .default(5)
        .describe("Max number of times the secret can be accessed (default: 5)"),
    }),
    execute: async (args: {
      secret_id: string;
      recipient_type: "user" | "agent" | "anyone_with_link" | "creator";
      recipient_id?: string;
      expires_at: string;
      max_access_count: number;
    }) => {
      if (
        (args.recipient_type === "user" || args.recipient_type === "agent") &&
        !args.recipient_id
      ) {
        return `Error: recipient_id is required when sharing with a ${args.recipient_type}.`;
      }

      const share = await client.shareSecret(args.secret_id, {
        recipient_type: args.recipient_type,
        recipient_id: args.recipient_id,
        expires_at: args.expires_at,
        max_access_count: args.max_access_count,
      });

      const recipientLabel =
        args.recipient_type === "creator"
          ? "your creator (the human who registered this agent)"
          : `${args.recipient_type}${args.recipient_id ? ` (${args.recipient_id})` : ""}`;

      return (
        `Secret shared successfully.\n` +
        `  Share ID: ${share.id}\n` +
        `  Recipient: ${recipientLabel}\n` +
        `  Expires: ${share.expires_at}\n` +
        `  Max accesses: ${share.max_access_count}\n` +
        `  URL: ${share.share_url}\n\n` +
        `The recipient must accept the share before they can access the secret.`
      );
    },
  };
}
