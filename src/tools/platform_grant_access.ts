import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function platformGrantAccessTool(client: OneClawClient) {
  return {
    name: "platform_grant_access" as const,
    description:
      "Grant a platform app access to specific vaults and agents for a connected user. The calling user must own the connection and resources.",
    parameters: z.object({
      connection_id: z.string().uuid().describe("The connection ID"),
      vault_ids: z.array(z.string().uuid()).optional().describe("Vault IDs to grant access to"),
      agent_ids: z.array(z.string().uuid()).optional().describe("Agent IDs to grant access to"),
      allowed_paths: z.array(z.string()).optional().describe("Secret path patterns to allow"),
      permissions: z.array(z.string()).optional().describe("Permissions to grant (e.g. read, write)"),
      expires_at: z.string().optional().describe("ISO 8601 expiration timestamp"),
    }),
    execute: async (
      args: {
        connection_id: string;
        vault_ids?: string[];
        agent_ids?: string[];
        allowed_paths?: string[];
        permissions?: string[];
        expires_at?: string;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const { connection_id, ...data } = args;
        const result = await client.platformGrantAccess(connection_id, data);
        log.info(`grant created for connection ${connection_id}`);
        const grants = (result as Record<string, unknown>).grants as Array<Record<string, unknown>> | undefined;
        return [
          `Access granted successfully.`,
          `  Connection: ${(result as Record<string, unknown>).connection_id}`,
          `  Grants: ${grants?.length ?? 0}`,
          `  Vaults: ${((result as Record<string, unknown>).vault_ids as string[])?.join(", ") ?? "none"}`,
          `  Agents: ${((result as Record<string, unknown>).agent_ids as string[])?.join(", ") ?? "none"}`,
        ].join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 404) throw new UserError(`Connection not found: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
