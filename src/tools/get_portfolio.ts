import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function getPortfolioTool(client: OneClawClient) {
    return {
        name: "get_portfolio" as const,
        description:
            "Get a unified portfolio view of all wallet balances across treasury wallets, signing keys, and smart accounts.",
        parameters: z.object({
            chains: z
                .string()
                .optional()
                .describe("Filter by chains (comma-separated, e.g. 'ethereum,solana')"),
            include_tokens: z
                .boolean()
                .default(false)
                .describe("Include token balances alongside native balances"),
        }),
        execute: async (
            args: { chains?: string; include_tokens: boolean },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.getPortfolio(args.chains, args.include_tokens);
            log.info(`portfolio: ${res.wallets.length} wallets`);
            return JSON.stringify(res, null, 2);
        },
    };
}
