import type { ToolsetModule } from "./types.js";
import { listCardsTool, getCardStatusTool, searchGiftCardsTool } from "../tools/list_cards.js";
import { orderCardTool, orderGiftCardTool } from "../tools/order_card.js";

/** cards: agent flag cards_enabled. */
export const cardsToolset: ToolsetModule = {
    id: "cards",
    gate: "agent flag cards_enabled",
    tools: [
        listCardsTool,
        getCardStatusTool,
        searchGiftCardsTool,
        orderCardTool,
        orderGiftCardTool,
    ],
};
