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
        action: "start" | "stop" | "restart" | "rollback",
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/runtimes/${runtimeId}/${action}`,
            { method: "POST" },
        );
    }

    /** Every env var the container is started with, by source (secrets masked). vault ≥ 0.61.48 */
    async runtimeResolvedEnv(runtimeId: string): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/runtimes/${runtimeId}/env/resolved`,
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
