import { ClientCore } from "./core.js";

/** treasury domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class TreasuryApi extends ClientCore {
    // ── Treasury Proposals ──────────────────────────────────────────

    async treasuryPropose(
        treasuryId: string,
        data: {
            to: string;
            value_wei?: string;
            data?: string;
            operation?: number;
            safe_tx_hash: string;
            nonce: number;
        },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/treasury/${treasuryId}/proposals`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async treasurySignProposal(
        treasuryId: string,
        proposalId: string,
        data: { signature: string; signer_address: string; decision?: string },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/treasury/${treasuryId}/proposals/${proposalId}/sign`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async treasuryListProposals(
        treasuryId: string,
        status?: string,
    ): Promise<Record<string, unknown>> {
        const qs = status ? `?status=${status}` : "";
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/treasury/${treasuryId}/proposals${qs}`,
        );
    }

}
