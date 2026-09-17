import { ClientCore } from "./core.js";

/** runtimes domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class RuntimesApi extends ClientCore {
    // ── Runtimes ────────────────────────────────────────────────────

    async listRuntimes(): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/runtimes`,
        );
    }

    async manageRuntime(
        runtimeId: string,
        action: "start" | "stop",
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/runtimes/${runtimeId}/${action}`,
            { method: "POST" },
        );
    }

    async getRuntimesForAgent(
        agentId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/runtimes?agent_id=${encodeURIComponent(agentId)}`,
        );
    }

    async getRuntimeLogs(
        runtimeId: string,
        tail?: number,
    ): Promise<{ entries: Array<{ timestamp?: string; message: string; level?: string }> }> {
        const qs = tail ? `?tail=${tail}` : "";
        return this.request(
            `${this.baseUrl}/v1/runtimes/${runtimeId}/logs${qs}`,
        );
    }

}
