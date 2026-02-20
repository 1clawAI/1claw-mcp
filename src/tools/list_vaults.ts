import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function listVaultsTool(client: OneClawClient) {
  return {
    name: "list_vaults" as const,
    description:
      "List all vaults accessible to you (both your own and those shared with you). Returns vault IDs, names, and who created them. Use this to discover available vaults before accessing secrets.",
    parameters: z.object({}),
    execute: async () => {
      const data = await client.listVaults();
      const vaults = data.vaults;

      if (vaults.length === 0) {
        return "No vaults found. Create one with create_vault.";
      }

      const lines = vaults.map(
        (v) =>
          `- ${v.name}  (id: ${v.id}, created by: ${v.created_by_type}, ${v.created_at})`,
      );

      return `Found ${vaults.length} vault(s):\n${lines.join("\n")}`;
    },
  };
}
