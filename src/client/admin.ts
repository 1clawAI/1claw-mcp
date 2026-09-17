import { ClientCore } from "./core.js";

/** admin domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class AdminApi extends ClientCore {
    // ── Cedar Policies ──────────────────────────────────────────────────

    async listCedarPolicies(): Promise<{ policies: Array<{ id: string; policy_text: string; description?: string; created_at: string }> }> {
        return this.request(
            `${this.baseUrl}/v1/org/cedar-policies`,
        );
    }

    async testCedarPolicy(
        principal: string,
        action: string,
        resource: string,
        context?: Record<string, unknown>,
    ): Promise<{ decision: string; reasons: string[] }> {
        return this.request(
            `${this.baseUrl}/v1/org/cedar-policies/test`,
            { method: "POST", body: JSON.stringify({ principal, action, resource, context }) },
        );
    }


    // ── OPA Policies ────────────────────────────────────────────────────

    async listOpaPolicies(): Promise<{ policies: Array<{ id: string; rego_module: string; description?: string; created_at: string }> }> {
        return this.request(
            `${this.baseUrl}/v1/org/opa-policies`,
        );
    }

    async testOpaPolicy(
        input: Record<string, unknown>,
        data?: Record<string, unknown>,
    ): Promise<{ decision: string; result: unknown }> {
        return this.request(
            `${this.baseUrl}/v1/org/opa-policies/test`,
            { method: "POST", body: JSON.stringify({ input, data }) },
        );
    }


    // ── Sub-Organizations ───────────────────────────────────────────────

    async listSubOrgs(): Promise<{ sub_orgs: Array<{ id: string; name: string; status: string; created_at: string }> }> {
        return this.request(
            `${this.baseUrl}/v1/org/sub-orgs`,
        );
    }

    async createSubOrg(
        name: string,
        description?: string,
        billingModel?: string,
    ): Promise<{ id: string; name: string }> {
        const body: Record<string, unknown> = { name };
        if (description) body.description = description;
        if (billingModel) body.billing_model = billingModel;
        return this.request(
            `${this.baseUrl}/v1/org/sub-orgs`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }


    // ── Policy Backend Settings ──────────────────────────────────────────

    async getPolicyBackendSettings(): Promise<{ backend: string; mode: string; scope: string[]; breaker_behavior: string }> {
        return this.request(
            `${this.baseUrl}/v1/org/settings/policy-backend`,
        );
    }

    async updatePolicyBackendSettings(
        body: Record<string, unknown>,
    ): Promise<{ backend: string; mode: string; scope: string[]; breaker_behavior: string }> {
        return this.request(
            `${this.baseUrl}/v1/org/settings/policy-backend`,
            { method: "PATCH", body: JSON.stringify(body) },
        );
    }

    async getShadowReport(): Promise<{ concordance_rate: number; total_evaluated: number; divergent_count: number; sample_events: unknown[] }> {
        return this.request(
            `${this.baseUrl}/v1/org/policy-shadow-report`,
        );
    }

    async getGuardrailShadowReport(params?: {
        since?: string;
        until?: string;
    }): Promise<{
        org_id: string;
        since: string;
        until: string;
        total_would_deny: number;
        by_reason: Array<{ reason_code: string; would_deny_count: number; enforced_count: number }>;
    }> {
        const query = new URLSearchParams();
        if (params?.since) query.set("since", params.since);
        if (params?.until) query.set("until", params.until);
        const qs = query.toString();
        return this.request(`${this.baseUrl}/v1/org/guardrail-shadow-report${qs ? `?${qs}` : ""}`);
    }

    async listGuardrailRevisions(): Promise<{ revisions: unknown[] }> {
        return this.request(`${this.baseUrl}/v1/org/guardrail-revisions`);
    }

    async replayAgentGuardrails(
        agentId: string,
        body?: {
            days?: number;
            draft_guardrails?: Record<string, unknown>;
            draft_approval_policy?: Record<string, unknown>;
        },
    ): Promise<Record<string, unknown>> {
        return this.request(`${this.baseUrl}/v1/agents/${agentId}/guardrails/replay`, {
            method: "POST",
            body: JSON.stringify(body ?? {}),
        });
    }


    // ── Contract ABI Registry ────────────────────────────────────────────

    async uploadContractAbi(
        body: Record<string, unknown>,
    ): Promise<{ id: string; chain: string; contract_address: string; name?: string }> {
        return this.request(
            `${this.baseUrl}/v1/org/contract-abis`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    async listContractAbis(chain?: string): Promise<{ abis: Array<{ id: string; chain: string; contract_address: string; name?: string; created_at: string }> }> {
        const qs = chain ? `?chain=${encodeURIComponent(chain)}` : "";
        return this.request(
            `${this.baseUrl}/v1/org/contract-abis${qs}`,
        );
    }

}
