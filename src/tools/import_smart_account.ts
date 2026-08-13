import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function importSmartAccountTool(client: OneClawClient) {
    return {
        name: "import_smart_account" as const,
        description:
            "Import an existing Safe smart account for an agent. Optionally verifies on-chain that the agent's EOA is a signer on the Safe.",
        parameters: z.object({
            agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
            chain: z.string().describe("Chain name (e.g. 'ethereum', 'base', 'polygon')"),
            chain_id: z.number().int().describe("Chain ID (e.g. 1 for mainnet, 8453 for Base)"),
            safe_address: z.string().describe("Safe contract address"),
            verify: z
                .boolean()
                .default(true)
                .describe("Verify on-chain Safe ownership before importing"),
        }),
        execute: async (
            args: { agent_id?: string; chain: string; chain_id: number; safe_address: string; verify: boolean },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const agentId = args.agent_id || client.agentId;
            if (!agentId) {
                throw new UserError(
                    "import_smart_account requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
                );
            }

            try {
                await client.importSmartAccount(agentId, args.chain, args.chain_id, args.safe_address, args.verify);
                log.info(`smart account imported for agent ${agentId}`);
                return `Smart account imported: ${args.safe_address} on ${args.chain} (chain_id: ${args.chain_id}) for agent ${agentId}.`;
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 400) throw new UserError(err.detail);
                    if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
                    if (err.status === 409) throw new UserError(`Already exists: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}
