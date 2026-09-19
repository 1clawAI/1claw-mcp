import { ClientCore } from "./core.js";

/** execute domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class ExecuteApi extends ClientCore {
    // ── Execution Intents ─────────────────────────────────────────

    async executeIntent(
        agentId: string,
        body: {
            binding: string;
            intent_type: string;
            execution_mode?: string;
            params: Record<string, unknown>;
            dry_run?: boolean;
            resume_after_approval_id?: string;
        },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/execute`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    async listBindings(
        agentId: string,
    ): Promise<{ bindings: Array<Record<string, unknown>> }> {
        return this.request<{ bindings: Array<Record<string, unknown>> }>(
            `${this.baseUrl}/v1/agents/${agentId}/bindings`,
        );
    }

    async createBinding(
        agentId: string,
        body: {
            name: string;
            binding_type: string;
            config?: Record<string, unknown>;
            guardrails?: Record<string, unknown>;
            credential?: Record<string, unknown>;
            credential_source?: Record<string, unknown>;
        } | Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/bindings`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    async testBinding(
        agentId: string,
        bindingId: string,
        timeoutMs?: number,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/bindings/${bindingId}/test`,
            {
                method: "POST",
                body: JSON.stringify(timeoutMs ? { timeout_ms: timeoutMs } : {}),
            },
        );
    }

    async listExecutions(
        agentId: string,
        limit?: number,
        offset?: number,
    ): Promise<Record<string, unknown>> {
        const qs = new URLSearchParams();
        if (limit) qs.set("limit", String(limit));
        if (offset) qs.set("offset", String(offset));
        const query = qs.toString();
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/executions${query ? `?${query}` : ""}`,
        );
    }


    // ── OAuth Connect ───────────────────────────────────────────────────

    async getAgentPeerContext(
        agentId: string,
        budget?: number,
    ): Promise<Record<string, unknown>> {
        const qs = budget ? `?budget=${budget}` : "";
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/peer-context${qs}`,
        );
    }

    async listNotificationTargets(): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/notification-targets`,
        );
    }

    async listConnectorPresets(): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/connectors/presets`,
        );
    }

    async listInstalledConnectors(
        agentId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/connectors`,
        );
    }

    /** Polled connector event sources the agent is subscribed to (vault ≥ 0.61.32). */
    async listEventSubscriptions(
        agentId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/event-subscriptions`,
        );
    }

    async listOAuthProviders(): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/oauth/providers`,
        );
    }

    async listOAuthConnections(
        agentId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/oauth/connections`,
        );
    }


    // ── OAuth Token/Consent Revocation ───────────────────────────────────

    async oauthRevokeToken(
        body: { token: string; token_type_hint?: string },
    ): Promise<void> {
        await this.request<void>(
            `${this.baseUrl}/v1/oauth/revoke`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    async oauthRevokeConsent(
        appId: string,
    ): Promise<void> {
        await this.request<void>(
            `${this.baseUrl}/v1/oauth/consents/${appId}`,
            { method: "DELETE" },
        );
    }

}
