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
      tx_conditions: z
        .object({
          match_mode: z.enum(["all", "any"]).optional().describe("Combine fields with AND (all, default) or OR (any) logic"),
          function_name_in: z.array(z.string()).optional(),
          function_selector_in: z.array(z.string()).optional(),
          erc20_amount_above: z.string().optional(),
          value_above: z.string().optional().describe("Native value threshold in gwei"),
          to_address_in: z.array(z.string()).optional(),
          chain_in: z.array(z.string()).optional(),
          intent_type_in: z.array(z.string()).optional(),
          decode_failed: z.boolean().optional(),
          program_id_in: z.array(z.string()).optional(),
          deep_inspect: z.boolean().optional().describe("When true, also inspect inner calls from multicall/Safe/ERC-4337 wrappers"),
        })
        .passthrough()
        .optional()
        .describe("Signing-time conditions on this policy (e.g. chain_in, value_above, to_address_in)"),
    }),
    execute: async (args: {
      vault_id: string;
      principal_type: "user" | "agent";
      principal_id: string;
      permissions: string[];
      secret_path_pattern: string;
      tx_conditions?: Record<string, unknown>;
    }) => {
      const policy = await client.createPolicy(
        args.vault_id,
        args.principal_type,
        args.principal_id,
        args.permissions,
        args.secret_path_pattern,
        args.tx_conditions,
      );
      return (
        `Access granted.\n` +
        `  Policy ID: ${policy.id}\n` +
        `  Vault: ${policy.vault_id}\n` +
        `  Granted to: ${policy.principal_type}:${policy.principal_id}\n` +
        `  Permissions: ${policy.permissions.join(", ")}\n` +
        `  Path pattern: ${policy.secret_path_pattern}` +
        (args.tx_conditions ? `\n  Tx conditions: ${JSON.stringify(args.tx_conditions)}` : "")
      );
    },
  };
}
