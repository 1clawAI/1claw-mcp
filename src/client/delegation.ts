import { ClientCore } from "./core.js";

/** delegation domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class DelegationApi extends ClientCore {
    // ── Agent Delegations ────────────────────────────────────────────────

    async listDelegations(
        agentId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/delegations`,
        );
    }

    async createDelegation(
        agentId: string,
        data: {
            delegate_id: string;
            allowed_tools?: string[];
            blocked_tools?: string[];
            max_daily_delegations?: number;
            max_depth?: number;
            guardrails?: Record<string, unknown>;
            delegation_mode?: string;
            expires_at?: string;
        },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/delegations`,
            {
                method: "POST",
                body: JSON.stringify(data),
            },
        );
    }

    async getEffectiveDelegations(
        agentId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/delegations/effective`,
        );
    }

}
