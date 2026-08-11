import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function platformListUsersTool(client: OneClawClient) {
  return {
    name: "platform_list_users" as const,
    description:
      "List all connected users for a platform app. Shows connection status, provisioned resources, and claim state.",
    parameters: z.object({
      app_id: z.string().uuid().describe("The platform app ID"),
    }),
    execute: async (args: { app_id: string }) => {
      const data = await client.platformListUsers(args.app_id);
      const users = data.users ?? [];
      if (users.length === 0) {
        return "No connected users found for this app.";
      }
      const lines = users.map(
        (u: Record<string, unknown>) =>
          `- connection: ${u.connection_id}, user: ${u.user_id}, status: ${u.status}, vaults: ${(u.vault_ids as string[])?.length ?? 0}, agents: ${(u.agent_ids as string[])?.length ?? 0}`,
      );
      return `Found ${users.length} connected user(s):\n${lines.join("\n")}`;
    },
  };
}
