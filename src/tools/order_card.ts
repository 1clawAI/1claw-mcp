import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

function formatCard(c: {
    id: string;
    kind: string;
    status: string;
    last4?: string;
    balance?: string;
    order_amount_usd?: string;
}): string {
    return [
        `Card ordered.`,
        `Card ID: ${c.id}`,
        `Kind: ${c.kind}`,
        `Status: ${c.status}`,
        c.order_amount_usd ? `Order amount: $${c.order_amount_usd}` : undefined,
        c.last4 ? `Last 4: ${c.last4}` : undefined,
        `Card details (PAN/CVV) are never returned here. Poll get_card_status; a human reveals via the dashboard.`,
    ]
        .filter(Boolean)
        .join("\n");
}

export function orderCardTool(client: OneClawClient) {
    return {
        name: "order_card" as const,
        description:
            "Order a US prepaid payment card for an agent, paying via x402 from the agent's Base USDC balance. Requires cards_enabled on the agent and a Pro+ plan. Never returns PAN/CVV — poll get_card_status, then a human reveals card details in the dashboard.",
        parameters: z.object({
            amount_usd: z
                .string()
                .describe("USD amount to load onto the card, e.g. '25.00'."),
            country: z
                .string()
                .optional()
                .describe("Country code for the prepaid card (default US)."),
            agent_id: z
                .string()
                .optional()
                .describe(
                    "Agent ID. Uses the current authenticated agent if omitted.",
                ),
        }),
        execute: async (
            args: { amount_usd: string; country?: string; agent_id?: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const agentId = args.agent_id || client.agentId;
            if (!agentId) {
                throw new UserError(
                    "order_card requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
                );
            }
            try {
                const card = await client.orderCard(agentId, {
                    kind: "prepaid",
                    amount_usd: args.amount_usd,
                    country: args.country,
                });
                log.info(`Card ordered: ${card.id}`);
                return formatCard(card);
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 400) throw new UserError(err.detail);
                    if (err.status === 403)
                        throw new UserError(`Access denied: ${err.detail}`);
                    if (err.status === 409) throw new UserError(err.detail);
                }
                throw err;
            }
        },
    };
}

export function orderGiftCardTool(client: OneClawClient) {
    return {
        name: "order_gift_card" as const,
        description:
            "Order a gift card for an agent, paying via x402 from the agent's Base USDC balance. Use search_gift_cards to find a laso_server_id first. Requires cards_enabled and Pro+. Redemption codes are stored securely and reveal-gated — never returned here.",
        parameters: z.object({
            amount_usd: z.string().describe("USD amount, e.g. '25.00'."),
            laso_server_id: z
                .string()
                .optional()
                .describe("Laso gift-card brand/server id (see search_gift_cards)."),
            agent_id: z
                .string()
                .optional()
                .describe(
                    "Agent ID. Uses the current authenticated agent if omitted.",
                ),
        }),
        execute: async (
            args: {
                amount_usd: string;
                laso_server_id?: string;
                agent_id?: string;
            },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const agentId = args.agent_id || client.agentId;
            if (!agentId) {
                throw new UserError(
                    "order_gift_card requires an agent_id parameter or agent authentication.",
                );
            }
            try {
                const card = await client.orderCard(agentId, {
                    kind: "gift_card",
                    amount_usd: args.amount_usd,
                    laso_server_id: args.laso_server_id,
                });
                log.info(`Gift card ordered: ${card.id}`);
                return formatCard(card);
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 400) throw new UserError(err.detail);
                    if (err.status === 403)
                        throw new UserError(`Access denied: ${err.detail}`);
                    if (err.status === 409) throw new UserError(err.detail);
                }
                throw err;
            }
        },
    };
}
