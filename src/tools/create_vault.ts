import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function createVaultTool(client: OneClawClient) {
  return {
    name: "create_vault" as const,
    description:
      "Create a new vault for organising secrets. The vault is owned by this agent and automatically shared with the human who registered you. Use descriptive names so your human collaborator can find it in the dashboard.",
    parameters: z.object({
      name: z
        .string()
        .min(1)
        .max(255)
        .describe("Vault name (e.g. 'stripe-production', 'ci-deploy-keys')"),
      description: z
        .string()
        .optional()
        .describe("Short description of what this vault is for"),
    }),
    execute: async (args: { name: string; description?: string }) => {
      const vault = await client.createVault(args.name, args.description);
      return (
        `Vault created successfully.\n` +
        `  ID: ${vault.id}\n` +
        `  Name: ${vault.name}\n` +
        `  Owner: ${vault.created_by_type}:${vault.created_by}\n\n` +
        `The vault has been automatically shared with your creator. ` +
        `You can now store secrets with put_secret (use the vault list to switch vaults).`
      );
    },
  };
}
