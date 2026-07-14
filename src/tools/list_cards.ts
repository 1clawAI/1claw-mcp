import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function listCardsTool(client: OneClawClient) {
    return {
        name: "list_cards" as const,
        description:
            "List payment cards visible to the caller (agents see only their own). Always masked — shows last4, brand, status, and balance, never the full PAN/CVV.",
        parameters: z.object({}),
        execute: async () => {
            try {
                const { cards } = await client.listCards();
                if (cards.length === 0) return "No payment cards found.";
                return cards
                    .map((c) =>
                        [
                            `${c.id}`,
                            `  ${c.kind} · ${c.status}${c.brand ? ` · ${c.brand}` : ""}`,
                            c.last4 ? `  ····${c.last4}` : undefined,
                            c.balance ? `  balance: ${c.balance} ${c.currency}` : undefined,
                        ]
                            .filter(Boolean)
                            .join("\n"),
                    )
                    .join("\n\n");
            } catch (err) {
                if (err instanceof OneClawApiError && err.status === 403)
                    throw new UserError(`Access denied: ${err.detail}`);
                throw err;
            }
        },
    };
}

export function getCardStatusTool(client: OneClawClient) {
    return {
        name: "get_card_status" as const,
        description:
            "Get the status and masked details of a single payment card (last4, brand, balance, status). Never returns the PAN/CVV — a human reveals card details in the dashboard.",
        parameters: z.object({
            card_id: z.string().describe("The card ID."),
        }),
        execute: async (args: { card_id: string }) => {
            try {
                const c = await client.getCard(args.card_id);
                return [
                    `Card ${c.id}`,
                    `Kind: ${c.kind}`,
                    `Status: ${c.status}`,
                    c.brand ? `Brand: ${c.brand}` : undefined,
                    c.last4 ? `Last 4: ····${c.last4}` : undefined,
                    c.balance ? `Balance: ${c.balance} ${c.currency}` : undefined,
                    c.exp_month && c.exp_year
                        ? `Expiry: ${c.exp_month}/${c.exp_year}`
                        : undefined,
                ]
                    .filter(Boolean)
                    .join("\n");
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 404)
                        throw new UserError("Card not found.");
                    if (err.status === 403)
                        throw new UserError(`Access denied: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}

export function searchGiftCardsTool(client: OneClawClient) {
    return {
        name: "search_gift_cards" as const,
        description:
            "Search available Laso gift-card brands/servers for the org's Laso account. Returns brand ids usable as laso_server_id in order_gift_card.",
        parameters: z.object({
            query: z.string().optional().describe("Brand/keyword filter."),
            country: z.string().optional().describe("Country code filter."),
        }),
        execute: async (args: { query?: string; country?: string }) => {
            try {
                const result = await client.searchGiftCards({
                    query: args.query,
                    country: args.country,
                });
                return JSON.stringify(result, null, 2);
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 400) throw new UserError(err.detail);
                    if (err.status === 403)
                        throw new UserError(`Access denied: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}
