import { ClientCore } from "./core.js";
import type {
    PlatformAppCreatedResponse,
    PlatformAppListResponse,
    PlatformRotateKeyResponse,
    BootstrapResponse,
} from "../types.js";

/** platform domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class PlatformApi extends ClientCore {
    // ── Platform API ──────────────────────────────────────

    async platformListApps(): Promise<PlatformAppListResponse> {
        return this.request<PlatformAppListResponse>(
            `${this.baseUrl}/v1/platform/apps`,
        );
    }

    async platformCreateApp(
        data: Record<string, unknown>,
    ): Promise<PlatformAppCreatedResponse> {
        return this.request<PlatformAppCreatedResponse>(
            `${this.baseUrl}/v1/platform/apps`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformBootstrapUser(
        connectionId: string,
        data: {
            template_id?: string;
            return_to?: string;
            parameters?: Record<string, unknown>;
        },
    ): Promise<BootstrapResponse> {
        return this.request<BootstrapResponse>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/bootstrap`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformSiweChallenge(data?: {
        domain?: string;
    }): Promise<{ nonce: string; expires_in: number; domain: string }> {
        return this.request(
            `${this.baseUrl}/v1/platform/siwe/challenge`,
            { method: "POST", body: JSON.stringify(data ?? {}) },
        );
    }

    async platformGetConnection(
        connectionId: string,
    ): Promise<Record<string, unknown>> {
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}`,
        );
    }

    async platformGetConnectionUsage(connectionId: string): Promise<{
        connection_id: string;
        period: string;
        inference_spent_usd: string;
    }> {
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/usage`,
        );
    }

    async platformListEntitlements(
        connectionId: string,
    ): Promise<{ evaluations: unknown[] }> {
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/entitlements`,
        );
    }

    async platformRefreshEntitlements(connectionId: string): Promise<void> {
        await this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/entitlements/refresh`,
            { method: "POST" },
        );
    }

    async platformPreviewTemplate(
        appId: string,
        templateId: string,
        data: {
            parameters?: Record<string, unknown>;
            subject?: Record<string, unknown>;
        },
    ): Promise<{ resolved_spec: Record<string, unknown> }> {
        return this.request(
            `${this.baseUrl}/v1/platform/apps/${appId}/templates/${templateId}/preview`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformTransferOwnership(
        appId: string,
        data: { target_org_id: string; target_user_email?: string },
        confirmToken?: string,
    ): Promise<Record<string, unknown>> {
        const headers: Record<string, string> = {};
        if (confirmToken) headers["X-Auth-Confirm"] = confirmToken;
        return this.request(
            `${this.baseUrl}/v1/platform/apps/${appId}/transfer-ownership`,
            { method: "POST", body: JSON.stringify(data), headers },
        );
    }

    async platformDeleteApp(
        appId: string,
    ): Promise<{ id: string; slug: string; deleted_at: string }> {
        return this.request(
            `${this.baseUrl}/v1/platform/apps/${appId}`,
            { method: "DELETE" },
        );
    }

    async platformGetSpendPolicy(
        appId: string,
        policyId: string,
    ): Promise<Record<string, unknown>> {
        return this.request(
            `${this.baseUrl}/v1/platform/apps/${appId}/spend-policies/${policyId}`,
        );
    }

    async platformGetConnectionSpendPolicy(
        connectionId: string,
    ): Promise<Record<string, unknown>> {
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/spend-policy`,
        );
    }

    async platformListConnectionApprovals(
        connectionId: string,
        params?: { status?: string; limit?: number; offset?: number },
    ): Promise<{ approvals: unknown[]; total: number }> {
        const qs = new URLSearchParams();
        if (params?.status) qs.set("status", params.status);
        if (params?.limit != null) qs.set("limit", String(params.limit));
        if (params?.offset != null) qs.set("offset", String(params.offset));
        const suffix = qs.toString() ? `?${qs}` : "";
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/approvals${suffix}`,
        );
    }

    async platformGetConnectionApproval(
        connectionId: string,
        approvalId: string,
    ): Promise<Record<string, unknown>> {
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/approvals/${approvalId}`,
        );
    }

    async platformListConnectionPendingApprovals(
        connectionId: string,
        params?: { status?: string; limit?: number; offset?: number },
    ): Promise<{ pending_approvals: unknown[]; total: number }> {
        const qs = new URLSearchParams();
        if (params?.status) qs.set("status", params.status);
        if (params?.limit != null) qs.set("limit", String(params.limit));
        if (params?.offset != null) qs.set("offset", String(params.offset));
        const suffix = qs.toString() ? `?${qs}` : "";
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/pending-approvals${suffix}`,
        );
    }

    async platformSetConnectionSpendPolicy(
        connectionId: string,
        data: Record<string, unknown>,
        idempotencyKey?: string,
    ): Promise<Record<string, unknown>> {
        const headers: Record<string, string> = {};
        if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/spend-policy`,
            { method: "PUT", body: JSON.stringify(data), headers },
        );
    }

    async platformRotateKey(
        appId: string,
        data?: { api_key_expires_at?: string },
    ): Promise<PlatformRotateKeyResponse> {
        return this.request<PlatformRotateKeyResponse>(
            `${this.baseUrl}/v1/platform/apps/${appId}/rotate-key`,
            { method: "POST", body: JSON.stringify(data ?? {}) },
        );
    }

    async platformReissueClaim(
        connectionId: string,
        data?: { return_to?: string },
    ): Promise<{ claim_url: string; claim_token: string; expires_in: number; connection_id: string }> {
        return this.request<{ claim_url: string; claim_token: string; expires_in: number; connection_id: string }>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/reissue-claim`,
            { method: "POST", body: JSON.stringify(data ?? {}) },
        );
    }

    async platformListTemplates(
        appId: string,
    ): Promise<{ templates: Array<Record<string, unknown>> }> {
        return this.request<{ templates: Array<Record<string, unknown>> }>(
            `${this.baseUrl}/v1/platform/apps/${appId}/templates`,
        );
    }

    async platformGetTemplate(
        appId: string,
        templateId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/apps/${appId}/templates/${templateId}`,
        );
    }


    // ── Fleets ────────────────────────────────────────────────────────

    async platformGetFleet(
        appId: string,
        templateId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/apps/${appId}/fleets/${templateId}`,
        );
    }

    async platformListFleetAgents(
        appId: string,
        templateId: string,
        limit?: number,
        offset?: number,
    ): Promise<Record<string, unknown>> {
        const q = new URLSearchParams();
        if (limit !== undefined) q.set("limit", String(limit));
        if (offset !== undefined) q.set("offset", String(offset));
        const qs = q.toString();
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/apps/${appId}/fleets/${templateId}/agents${qs ? `?${qs}` : ""}`,
        );
    }

    async platformRolloutFleet(
        appId: string,
        templateId: string,
        data: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/apps/${appId}/fleets/${templateId}/rollout`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformCreateConnectionRuntime(
        connectionId: string,
        data: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/runtimes`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformGetConnectionRuntime(
        connectionId: string,
        runtimeId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/runtimes/${runtimeId}`,
        );
    }

    /** Delete a runtime the app provisioned on this connection (plt_ scoped). */
    async platformDeleteConnectionRuntime(
        connectionId: string,
        runtimeId: string,
    ): Promise<void> {
        await this.request<void>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/runtimes/${runtimeId}`,
            { method: "DELETE" },
        );
    }

    async platformConnectionPasskeyEnrollBegin(
        connectionId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/passkeys/enroll/begin`,
            { method: "POST", body: JSON.stringify({}) },
        );
    }

    async platformConnectionPasskeyEnrollComplete(
        connectionId: string,
        data: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/passkeys/enroll/complete`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformConnectionAgentChat(
        connectionId: string,
        agentId: string,
        data: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/agents/${agentId}/chat`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformGetConnectionPendingApproval(
        connectionId: string,
        approvalId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/pending-approvals/${approvalId}`,
        );
    }

    async platformDecideConnectionPendingApproval(
        connectionId: string,
        approvalId: string,
        data: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/pending-approvals/${approvalId}/decide`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformCreateConnectionPendingApproval(
        connectionId: string,
        data: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/pending-approvals`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformGetConnectionPortfolio(
        connectionId: string,
        query?: Record<string, string>,
    ): Promise<Record<string, unknown>> {
        const qs = query
            ? "?" + new URLSearchParams(query).toString()
            : "";
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/portfolio${qs}`,
        );
    }

    async platformListConnectionAutomations(
        connectionId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/automations`,
        );
    }

    // Control-plane telemetry for one connection's agents (plt_ auth). No
    // stream here: an MCP tool call is a request/response, and a stream that
    // never ends is a tool call that never returns.
    async platformGetConnectionOtelSummary(
        connectionId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/otel/summary`,
        );
    }

    async platformGetConnectionOtelThreats(
        connectionId: string,
        state: "open" | "all" = "open",
    ): Promise<Record<string, unknown>[]> {
        return this.request<Record<string, unknown>[]>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/otel/threats?state=${state}`,
        );
    }

    async platformGetConnectionOtelTopology(
        connectionId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/otel/topology`,
        );
    }

    async inspectContent(
        data: { content: string; context?: string },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/shroud/inspect-content`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformDecideConnectionApproval(
        connectionId: string,
        approvalId: string,
        data: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/approvals/${approvalId}/decide`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformDeactivateConnectionSigningKey(
        connectionId: string,
        chain: string,
        agentId?: string,
    ): Promise<void> {
        const qs = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : "";
        await this.request<void>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/signing-keys/${encodeURIComponent(chain)}${qs}`,
            { method: "DELETE" },
        );
    }

    async platformListConnectionSigningKeys(
        connectionId: string,
        agentId?: string,
    ): Promise<{ agent_id: string; keys: Array<{ chain: string; address: string; public_key: string; curve: string }> }> {
        const qs = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : "";
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/signing-keys${qs}`,
        );
    }

    async platformGetConnectionSigningKey(
        connectionId: string,
        chain: string,
        agentId?: string,
    ): Promise<{ agent_id: string; chain: string; address: string; public_key: string; curve: string }> {
        const qs = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : "";
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/signing-keys/${encodeURIComponent(chain)}${qs}`,
        );
    }

    async platformPatchConnectionAgent(
        connectionId: string,
        agentId: string,
        data: {
            intents_api_enabled?: boolean;
            execution_intents_enabled?: boolean;
            system_prompt?: string | null;
        },
    ): Promise<{
        agent_id: string;
        intents_api_enabled: boolean;
        execution_intents_enabled: boolean;
        system_prompt?: string | null;
    }> {
        return this.request(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/agents/${agentId}`,
            { method: "PATCH", body: JSON.stringify(data) },
        );
    }

    async platformCreateTemplate(
        appId: string,
        data: { name: string; spec: Record<string, unknown>; description?: string },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/apps/${appId}/templates`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformListUsers(
        appId: string,
    ): Promise<{ users: Array<Record<string, unknown>> }> {
        return this.request<{ users: Array<Record<string, unknown>> }>(
            `${this.baseUrl}/v1/platform/apps/${appId}/users`,
        );
    }

    async platformGrantAccess(
        connectionId: string,
        data: {
            vault_ids?: string[];
            agent_ids?: string[];
            allowed_paths?: string[];
            permissions?: string[];
            expires_at?: string;
        },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/grant`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

    async platformListGrants(
        connectionId: string,
    ): Promise<{ grants: Array<Record<string, unknown>> }> {
        return this.request<{ grants: Array<Record<string, unknown>> }>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/grants`,
        );
    }


    // ── Platform Marketplace & Stats ────────────────────────────────────

    async platformMarketplace(params?: {
        category?: string;
        tags?: string;
        q?: string;
        page?: number;
        page_size?: number;
    }): Promise<Record<string, unknown>> {
        const searchParams = new URLSearchParams();
        if (params?.category) searchParams.set("category", params.category);
        if (params?.tags) searchParams.set("tags", params.tags);
        if (params?.q) searchParams.set("q", params.q);
        if (params?.page) searchParams.set("page", String(params.page));
        if (params?.page_size) searchParams.set("page_size", String(params.page_size));
        const qs = searchParams.toString();
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/marketplace${qs ? `?${qs}` : ""}`,
        );
    }

    async platformAppStats(
        appId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/apps/${appId}/stats`,
        );
    }

    async platformRotateWebhookSecret(
        appId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/platform/apps/${appId}/rotate-webhook-secret`,
            { method: "POST" },
        );
    }

}
