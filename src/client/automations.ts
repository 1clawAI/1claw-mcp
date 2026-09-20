import { ClientCore } from "./core.js";

/** automations domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class AutomationsApi extends ClientCore {
    // ── Automations ─────────────────────────────────────────────────

    async listAutomations(): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/automations`,
        );
    }

    async listAutomationPresets(): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/automations/presets`,
        );
    }

    async triggerAutomation(
        automationId: string,
        input?: Record<string, unknown>,
        idempotencyKey?: string,
    ): Promise<Record<string, unknown>> {
        // vault ≥ 0.61.45 reads `{input, idempotency_key}`; a bare object
        // used to be ignored entirely.
        const body: Record<string, unknown> = {};
        if (input) body.input = input;
        if (idempotencyKey) body.idempotency_key = idempotencyKey;
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/automations/${automationId}/trigger`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    async createAgentAutomation(
        agentId: string,
        body: {
            name: string;
            trigger_type?: "manual" | "webhook";
            workflow_spec: unknown;
            auto_trigger?: boolean;
        },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/automations`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    async cancelAutomationRun(
        automationId: string,
        runId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/automations/${automationId}/runs/${runId}/cancel`,
            { method: "POST" },
        );
    }

}
