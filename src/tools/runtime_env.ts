import { z } from "zod";
import { UserError } from "fastmcp";
import type { OneClawClient } from "../client.js";
import { OneClawApiError } from "../client/core.js";

/** `GET /v1/runtimes/{id}/env/resolved` — what the container is started with. */
export function runtimeEnvTool(client: OneClawClient) {
  return {
    name: "runtime_env" as const,
    description:
      "List every environment variable a runtime container is started with, with its source (platform, env_public, vault_env, agent, secret) and which wins on a name collision. Vault-derived and minted values are masked.",
    parameters: z.object({
      runtime_id: z.string().min(1).describe("The UUID of the runtime"),
    }),
    execute: async (args: { runtime_id: string }) => {
      try {
        const r = (await client.runtimeResolvedEnv(args.runtime_id)) as {
          environment?: string;
          restart_required_for_changes?: boolean;
          entries?: Array<{ key: string; source: string; value?: string; masked: boolean; overrides?: string | null }>;
        };
        const lines = (r.entries ?? []).map(
          (e) => `${e.key} = ${e.masked ? "••••••" : (e.value ?? "")}  [${e.source}${e.overrides ? `, overrides ${e.overrides}` : ""}]`,
        );
        return `Environment (${r.environment ?? "production"} scope${r.restart_required_for_changes ? "; changes apply on restart" : ""}):\n${lines.join("\n")}`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Runtime not found: ${args.runtime_id}`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
