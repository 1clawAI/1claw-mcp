import { ClientCore } from "./core.js";
import type {
    CardResponse,
} from "../types.js";

/** cards domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class CardsApi extends ClientCore {
    // ── Payment Cards ─────────────────────────────────────

    async orderCard(
        agentId: string,
        body: {
            kind: "prepaid" | "gift_card";
            amount_usd: string;
            laso_server_id?: string;
            country?: string;
        },
        idempotencyKey?: string,
    ): Promise<CardResponse> {
        const key = idempotencyKey ?? crypto.randomUUID();
        return this.request<CardResponse>(
            `${this.baseUrl}/v1/agents/${agentId}/cards/order`,
            {
                method: "POST",
                body: JSON.stringify(body),
                headers: { "Idempotency-Key": key },
            },
        );
    }

    async listCards(): Promise<{ cards: CardResponse[] }> {
        return this.request<{ cards: CardResponse[] }>(
            `${this.baseUrl}/v1/cards`,
        );
    }

    async getCard(cardId: string): Promise<CardResponse> {
        return this.request<CardResponse>(`${this.baseUrl}/v1/cards/${cardId}`);
    }

    async searchGiftCards(body: {
        query?: string;
        country?: string;
    }): Promise<unknown> {
        return this.request<unknown>(
            `${this.baseUrl}/v1/cards/gift-cards/search`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

}
