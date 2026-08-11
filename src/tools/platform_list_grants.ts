import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function platformListGrantsTool(client: OneClawClient) {
  return {
    name: "platform_list_grants" as const,
    description:
      "List active resource grants for a platform connection. Shows which vaults and agents the platform app can access.",
    parameters: z.object({
      connection_id: z.string().uuid().describe("The connection ID"),
    }),
    execute: async (args: { connection_id: string }) => {
      const data = await client.platformListGrants(args.connection_id);
      const grants = data.grants ?? [];
      if (grants.length === 0) {
        return "No active grants for this connection.";
      }
      const lines = grants.map(
        (g: Record<string, unknown>) =>
          `- grant: ${g.id}, vault: ${g.vault_id}, permissions: ${(g.permissions as string[])?.join(", ") ?? "—"}, paths: ${(g.allowed_paths as string[])?.join(", ") ?? "*"}`,
      );
      return `Found ${grants.length} active grant(s):\n${lines.join("\n")}`;
    },
  };
}
