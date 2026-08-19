import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

const nonEvmParams = {
  destination_tag: z.number().int().optional().describe("XRP: destination tag for exchange deposits"),
  memo: z.string().optional().describe("XRP / Solana: optional memo"),
  fee_rate_sat_per_vbyte: z.number().int().optional().describe("Bitcoin: override fee rate (sat/vByte)"),
  fee_limit_sun: z.number().int().optional().describe("Tron: TRC-20 energy fee limit in sun"),
  token_mint: z.string().optional().describe("Solana SPL / Tron TRC-20: token mint or contract; omit for native transfer"),
  token_decimals: z.number().int().optional().describe("Solana / Tron: token decimals (default 6)"),
  ttl: z.number().int().optional().describe("Cardano: transaction time-to-live (absolute slot)"),
  xrpl_tx_json: z.record(z.unknown()).optional().describe("Raw XRPL transaction JSON for full transaction type coverage (TrustSet, OfferCreate, NFTokenMint, AMMCreate, EscrowCreate, etc.). Account/Sequence/Fee/SigningPubKey are auto-filled."),
  raw_transaction: z.string().optional().describe("Pre-built raw transaction as base64 byte string for deep-inspect before signing (non-EVM)"),
  tron_transaction: z.record(z.unknown()).optional().describe("Pre-built Tron transaction JSON object for full Tron transaction type coverage"),
};

export function signTransactionTool(client: OneClawClient) {
  return {
    name: "sign_transaction" as const,
    description:
      "Sign a transaction without broadcasting. Returns signed_tx/raw_tx and tx_hash for the caller to submit via their own RPC. Supports EVM and non-EVM chains (Bitcoin, Solana, XRP, Cardano, Tron). All agent guardrails (allowlists, value caps, daily limits) are enforced.",
    parameters: z.object({
      to: z.string().describe("Destination address (0x for EVM; chain-native format for non-EVM)"),
      value: z.string().describe("Value in major units as decimal string (e.g. '0.01' ETH, '0.001' BTC, '0.25' SOL)"),
      chain: z.string().describe("Chain name ('ethereum', 'bitcoin-testnet', 'solana-devnet', etc.) or numeric EVM chain ID"),
      data: z.string().optional().describe("Hex-encoded calldata (EVM contract interactions)"),
      signing_key_path: z.string().optional().describe("Vault path to the signing key. Auto-resolves per-chain signing key if provisioned, otherwise keys/{chain}-signer"),
      nonce: z.number().int().optional().describe("Transaction nonce (EVM; auto-resolved if omitted)"),
      gas_price: z.string().optional().describe("Gas price in wei (EVM legacy mode)"),
      gas_limit: z.number().int().optional().describe("Gas limit (EVM). Defaults to 21000"),
      max_fee_per_gas: z.string().optional().describe("EIP-1559 max fee per gas in wei (EVM)"),
      max_priority_fee_per_gas: z.string().optional().describe("EIP-1559 max priority fee per gas in wei (EVM)"),
      simulate_first: z.boolean().default(true).describe("Run Tenderly simulation before signing (EVM-only). Defaults to true."),
      ...nonEvmParams,
    }),
    execute: async (
      args: {
        to: string;
        value: string;
        chain: string;
        data?: string;
        signing_key_path?: string;
        nonce?: number;
        gas_price?: string;
        gas_limit?: number;
        max_fee_per_gas?: string;
        max_priority_fee_per_gas?: string;
        simulate_first?: boolean;
        destination_tag?: number;
        memo?: string;
        fee_rate_sat_per_vbyte?: number;
        fee_limit_sun?: number;
        token_mint?: string;
        token_decimals?: number;
        ttl?: number;
        xrpl_tx_json?: Record<string, unknown>;
        raw_transaction?: string;
        tron_transaction?: Record<string, unknown>;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = client.agentId;
      if (!agentId) {
        throw new UserError(
          "sign_transaction requires agent authentication (ONECLAW_AGENT_API_KEY, or ONECLAW_AGENT_ID + key; agent ID is resolved from token exchange when omitted).",
        );
      }

      try {
        const result = await client.signTransaction(agentId, args);
        log.info(`transaction signed: ${result.tx_hash}`);

        const lines: string[] = [
          `Transaction SIGNED (not broadcast)`,
          `Tx hash: ${result.tx_hash}`,
          `From: ${result.from}`,
          `To: ${result.to}`,
          `Chain: ${result.chain} (${result.chain_id})`,
          `Nonce: ${result.nonce}`,
          `Value: ${result.value_wei} wei`,
          `Signed tx: ${result.signed_tx}`,
        ];

        if (result.simulation_id) lines.push(`Simulation: ${result.simulation_id} (${result.simulation_status})`);

        return lines.join("\n");
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
