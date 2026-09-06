import { z } from "zod";
import { OneClawClient, OneClawApiError } from "../client.js";

interface Installed {
  binding_id: string;
  binding_name: string;
  preset_slug: string;
  display_name?: string | null;
  is_active: boolean;
  connected: boolean;
  needs_reauth: boolean;
  created_at: string;
}

export function listInstalledConnectorsTool(client: OneClawClient) {
  return {
    name: "list_installed_connectors" as const,
    description:
      "List the connectors installed on an agent, and whether each is actually usable. " +
      "An install creates the binding; the binding holds no credential until a human " +
      "completes the OAuth flow, so 'installed' and 'connected' are different states.",
    parameters: z.object({
      agent_id: z.string().describe("Agent UUID"),
    }),
    execute: async (
      args: { agent_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = (await client.listInstalledConnectors(args.agent_id)) as {
          connectors?: Installed[];
        };
        const connectors = result.connectors ?? [];
        log.info(`listed ${connectors.length} installed connector(s)`);

        if (connectors.length === 0) {
          return "No connectors installed on this agent. Use list_connector_presets to see what is available; a human installs them.";
        }

        return connectors
          .map((c) => {
            const status = c.needs_reauth
              ? "needs reconnection — the stored token was rejected"
              : c.connected
                ? "connected"
                : "installed, not yet connected (a human must finish the OAuth flow)";
            return [
              `Connector: ${c.display_name ?? c.preset_slug}`,
              `Binding: ${c.binding_name} (${c.binding_id})`,
              `Status: ${status}`,
              `Active: ${c.is_active}`,
              `Installed: ${c.created_at}`,
            ].join("\n");
          })
          .join("\n---\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new Error(`Access denied: ${err.detail}`);
          if (err.status === 404) throw new Error(`Agent ${args.agent_id} not found.`);
        }
        throw err;
      }
    },
  };
}
