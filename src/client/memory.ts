import { ClientCore } from "./core.js";

/** memory domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class MemoryApi extends ClientCore {
    // ── Agent Memory ──────────────────────────────────────────────────

    async putMemory(
        agentId: string,
        namespace: string,
        key: string,
        body: { value: unknown; ttl_seconds?: number },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/memory/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
            { method: "PUT", body: JSON.stringify(body) },
        );
    }

    async getMemory(
        agentId: string,
        namespace: string,
        key: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/memory/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
        );
    }

    async listMemory(
        agentId: string,
        namespace: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/memory/${encodeURIComponent(namespace)}`,
        );
    }

    async deleteMemory(
        agentId: string,
        namespace: string,
        key: string,
    ): Promise<void> {
        await this.request<void>(
            `${this.baseUrl}/v1/agents/${agentId}/memory/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
            { method: "DELETE" },
        );
    }

    async searchMemory(
        agentId: string,
        body: { namespace: string; query: string; top_k?: number },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/memory/search`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    async listMemoryNamespaces(
        agentId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/memory`,
        );
    }

}
