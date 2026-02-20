import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function listSecretsTool(client: OneClawClient) {
  return {
    name: "list_secrets" as const,
    description:
      "List all secrets stored in the 1claw vault. Returns paths, types, versions, and metadata — never secret values. Use this to discover what credentials are available before fetching one.",
    parameters: z.object({
      prefix: z
        .string()
        .optional()
        .describe("Optional path prefix to filter secrets (e.g. 'api-keys/')"),
    }),
    execute: async (args: { prefix?: string }) => {
      const data = await client.listSecrets();
      let secrets = data.secrets;

      if (args.prefix) {
        secrets = secrets.filter((s) => s.path.startsWith(args.prefix!));
      }

      if (secrets.length === 0) {
        return "No secrets found in this vault.";
      }

      const lines = secrets.map(
        (s) =>
          `- ${s.path}  (type: ${s.type}, version: ${s.version}, expires: ${s.expires_at ?? "never"})`,
      );

      return `Found ${secrets.length} secret(s):\n${lines.join("\n")}`;
    },
  };
}
