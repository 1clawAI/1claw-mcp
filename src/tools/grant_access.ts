import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function grantAccessTool(client: OneClawClient) {
  return {
    name: "grant_access" as const,
    description:
      "Grant a user or agent access to one of your vaults. You can only grant access on vaults you created. " +
      "Use this to share secrets with team members or other agents.",
    parameters: z.object({
      vault_id: z.string().uuid().describe("ID of the vault to share"),
      principal_type: z
        .enum(["user", "agent"])
        .describe("Type of principal to grant access to"),
      principal_id: z
        .string()
        .uuid()
        .describe("UUID of the user or agent to grant access to"),
      permissions: z
        .array(z.enum(["read", "write", "delete"]))
        .default(["read"])
        .describe("Permissions to grant (default: read-only)"),
      secret_path_pattern: z
        .string()
        .default("**")
        .describe("Glob pattern for which secrets the policy covers (default: all)"),
    }),
    execute: async (args: {
      vault_id: string;
      principal_type: "user" | "agent";
      principal_id: string;
      permissions: string[];
      secret_path_pattern: string;
    }) => {
      const policy = await client.createPolicy(
        args.vault_id,
        args.principal_type,
        args.principal_id,
        args.permissions,
        args.secret_path_pattern,
      );
      return (
        `Access granted.\n` +
        `  Policy ID: ${policy.id}\n` +
        `  Vault: ${policy.vault_id}\n` +
        `  Granted to: ${policy.principal_type}:${policy.principal_id}\n` +
        `  Permissions: ${policy.permissions.join(", ")}\n` +
        `  Path pattern: ${policy.secret_path_pattern}`
      );
    },
  };
}
