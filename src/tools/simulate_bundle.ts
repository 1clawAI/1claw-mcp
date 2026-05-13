import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

const txSchema = z.object({
    to: z.string().describe("Destination address (0x-prefixed)"),
    value: z.string().describe("Value in ETH as decimal string (e.g. '0.01')"),
    chain: z.string().describe("Chain name ('base', 'ethereum', etc.) or numeric chain ID"),
    data: z.string().optional().describe("Hex-encoded calldata for contract interactions"),
    signing_key_path: z.string().optional().describe("Vault path to the signing key. Auto-resolves per-chain signing key if provisioned, otherwise keys/{chain}-signer"),
    gas_limit: z.number().int().optional().describe("Gas limit. Defaults to 21000"),
});

export function simulateBundleTool(client: OneClawClient) {
    return {
        name: "simulate_bundle" as const,
        description:
            "Simulate a sequence of EVM transactions via Tenderly (simulate-bundle). Runs in order and returns per-tx results without signing or broadcasting. Use to preview multi-step flows (e.g. approve + swap).",
        parameters: z.object({
            transactions: z
                .array(txSchema)
                .min(1)
                .describe("Ordered list of transactions to simulate as a bundle"),
        }),
        execute: async (
            args: { transactions: z.infer<typeof txSchema>[] },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const agentId = client.agentId;
            if (!agentId) {
                throw new UserError(
                    "simulate_bundle requires agent authentication (ONECLAW_AGENT_API_KEY, or ONECLAW_AGENT_ID + key; agent ID is resolved from token exchange when omitted).",
                );
            }

            try {
                const bundle = await client.simulateBundle(agentId, args.transactions);
                log.info(`bundle simulation: ${bundle.simulations.length} step(s)`);

                const blocks: string[] = [];
                bundle.simulations.forEach((result, i) => {
                    const lines: string[] = [
                        `--- Step ${i + 1} (${result.status.toUpperCase()}) ---`,
                        `Gas used: ${result.gas_used}`,
                    ];
                    if (result.gas_estimate_usd) {
                        lines.push(`Gas estimate: ${result.gas_estimate_usd}`);
                    }
                    if (result.balance_changes.length > 0) {
                        lines.push("Balance changes:");
                        for (const bc of result.balance_changes) {
                            const token = bc.token_symbol ?? bc.token ?? "ETH";
                            lines.push(`  ${bc.address}: ${bc.change ?? "?"} ${token}`);
                        }
                    }
                    if (result.error) lines.push(`Error: ${result.error}`);
                    if (result.error_human_readable) lines.push(`Reason: ${result.error_human_readable}`);
                    if (result.tenderly_dashboard_url) lines.push(`Tenderly: ${result.tenderly_dashboard_url}`);
                    blocks.push(lines.join("\n"));
                });

                return blocks.join("\n\n");
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 400) throw new UserError(err.detail);
                    if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
                    if (err.status === 422) throw new UserError(`Bundle simulation failed: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}
