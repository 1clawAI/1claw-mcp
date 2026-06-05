import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function leaseBankrKeyTool(client: OneClawClient) {
  return {
    name: "lease_bankr_key" as const,
    description:
      "Provision a short-lived Bankr wallet API key for an agent. The 1Claw vault holds the partner key and calls the Bankr Partner API to issue a scoped, time-limited key. Returns the ephemeral bk_usr_ key, wallet ID, and expiry.",
    parameters: z.object({
      agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
      wallet_id: z.string().optional().describe("Bankr wallet ID (wlt_...). Uses org default if omitted."),
      ttl_seconds: z.number().optional().describe("Lease TTL in seconds (default 3600, max 86400)."),
      llm_gateway_enabled: z.boolean().optional().describe("Enable LLM gateway access (default true)."),
      agent_api_enabled: z.boolean().optional().describe("Enable agent API access (default false)."),
      read_only: z.boolean().optional().describe("Read-only key (default true)."),
    }),
    execute: async (
      args: {
        agent_id?: string;
        wallet_id?: string;
        ttl_seconds?: number;
        llm_gateway_enabled?: boolean;
        agent_api_enabled?: boolean;
        read_only?: boolean;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "lease_bankr_key requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const result = await client.leaseBankrKey(agentId, {
          wallet_id: args.wallet_id,
          ttl_seconds: args.ttl_seconds,
          permissions: {
            llm_gateway_enabled: args.llm_gateway_enabled ?? true,
            agent_api_enabled: args.agent_api_enabled ?? false,
            read_only: args.read_only ?? true,
          },
        });
        log.info(`Bankr key leased: ${result.lease_id}`);

        return [
          `Bankr key leased successfully`,
          `Lease ID: ${result.lease_id}`,
          `API key: ${result.api_key}`,
          `Wallet: ${result.wallet_id}`,
          `Expires: ${result.expires_at}`,
        ].join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
