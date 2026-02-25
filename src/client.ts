import type {
    SecretMetadata,
    SecretWithValue,
    SecretListResponse,
    VaultResponse,
    VaultListResponse,
    PolicyResponse,
    ShareLinkResponse,
    SimulationResponse,
    BundleSimulationResponse,
    TransactionResponse,
    ApiErrorBody,
} from "./types.js";

export class OneClawApiError extends Error {
    constructor(
        public status: number,
        public detail: string,
    ) {
        super(detail);
        this.name = "OneClawApiError";
    }
}

export interface ClientConfig {
    baseUrl: string;
    token: string;
    vaultId: string;
}

export interface AgentCredentials {
    baseUrl: string;
    agentId: string;
    apiKey: string;
    vaultId: string;
}

function encodePath(path: string): string {
    return path
        .split("/")
        .map((s) => encodeURIComponent(s))
        .join("/");
}

const REFRESH_BUFFER_MS = 60_000;

export class OneClawClient {
    private baseUrl: string;
    private token: string;
    private vaultId: string;

    private agentCredentials?: { agentId: string; apiKey: string };
    private tokenExpiresAt = 0;

    constructor(config: ClientConfig | AgentCredentials) {
        this.baseUrl = config.baseUrl.replace(/\/$/, "");
        this.vaultId = config.vaultId;

        if ("agentId" in config) {
            this.agentCredentials = {
                agentId: config.agentId,
                apiKey: config.apiKey,
            };
            this.token = "";
        } else {
            this.token = config.token;
        }
    }

    private async ensureToken(): Promise<void> {
        if (!this.agentCredentials) return;
        if (this.token && Date.now() < this.tokenExpiresAt - REFRESH_BUFFER_MS)
            return;

        const res = await fetch(`${this.baseUrl}/v1/auth/agent-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                agent_id: this.agentCredentials.agentId,
                api_key: this.agentCredentials.apiKey,
            }),
        });

        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try {
                const body = (await res.json()) as ApiErrorBody;
                if (body.detail) detail = body.detail;
            } catch {
                /* use default */
            }
            throw new OneClawApiError(
                res.status,
                `Agent auth failed: ${detail}`,
            );
        }

        const data = (await res.json()) as {
            access_token: string;
            expires_in: number;
        };
        this.token = data.access_token;
        this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    }

    private async headers(): Promise<Record<string, string>> {
        await this.ensureToken();
        return {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
        };
    }

    private vaultUrl(suffix = ""): string {
        return `${this.baseUrl}/v1/vaults/${this.vaultId}${suffix}`;
    }

    private async request<T>(url: string, init?: RequestInit): Promise<T> {
        const hdrs = await this.headers();
        const res = await fetch(url, {
            ...init,
            headers: { ...hdrs, ...(init?.headers as Record<string, string>) },
        });

        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            let errorType = "";
            try {
                const body = (await res.json()) as ApiErrorBody;
                if (body.detail) detail = body.detail;
                if (body.type) errorType = body.type;
            } catch {
                // use default detail
            }

            if (res.status === 402) {
                throw new OneClawApiError(
                    402,
                    "Quota exhausted. Ask your human to upgrade the plan, add prepaid credits, or enable x402 micropayments at https://1claw.xyz/settings/billing",
                );
            }

            if (
                res.status === 403 &&
                errorType === "resource_limit_exceeded"
            ) {
                throw new OneClawApiError(
                    403,
                    `Resource limit reached: ${detail}. Ask your human to upgrade the plan at https://1claw.xyz/settings/billing`,
                );
            }

            throw new OneClawApiError(res.status, detail);
        }

        if (res.status === 204) return undefined as T;
        return res.json() as Promise<T>;
    }

    async listSecrets(): Promise<SecretListResponse> {
        return this.request<SecretListResponse>(this.vaultUrl("/secrets"));
    }

    async getSecret(path: string): Promise<SecretWithValue> {
        return this.request<SecretWithValue>(
            this.vaultUrl(`/secrets/${encodePath(path)}`),
        );
    }

    async putSecret(
        path: string,
        body: {
            value: string;
            type: string;
            metadata?: Record<string, unknown>;
            expires_at?: string;
            max_access_count?: number;
        },
    ): Promise<SecretMetadata> {
        return this.request<SecretMetadata>(
            this.vaultUrl(`/secrets/${encodePath(path)}`),
            { method: "PUT", body: JSON.stringify(body) },
        );
    }

    async deleteSecret(path: string): Promise<void> {
        await this.request<void>(
            this.vaultUrl(`/secrets/${encodePath(path)}`),
            { method: "DELETE" },
        );
    }

    async createVault(
        name: string,
        description?: string,
    ): Promise<VaultResponse> {
        return this.request<VaultResponse>(`${this.baseUrl}/v1/vaults`, {
            method: "POST",
            body: JSON.stringify({ name, description: description ?? "" }),
        });
    }

    async listVaults(): Promise<VaultListResponse> {
        return this.request<VaultListResponse>(`${this.baseUrl}/v1/vaults`);
    }

    async shareSecret(
        secretId: string,
        options: {
            recipient_type: string;
            email?: string;
            recipient_id?: string;
            expires_at: string;
            max_access_count?: number;
        },
    ): Promise<ShareLinkResponse> {
        return this.request<ShareLinkResponse>(
            `${this.baseUrl}/v1/secrets/${secretId}/share`,
            { method: "POST", body: JSON.stringify(options) },
        );
    }

    async createPolicy(
        vaultId: string,
        principalType: string,
        principalId: string,
        permissions: string[],
        secretPathPattern = "**",
    ): Promise<PolicyResponse> {
        return this.request<PolicyResponse>(
            `${this.baseUrl}/v1/vaults/${vaultId}/policies`,
            {
                method: "POST",
                body: JSON.stringify({
                    secret_path_pattern: secretPathPattern,
                    principal_type: principalType,
                    principal_id: principalId,
                    permissions,
                }),
            },
        );
    }

    // ── Transaction Simulation & Submission ──────────────

    get agentId(): string | undefined {
        return this.agentCredentials?.agentId;
    }

    async simulateTransaction(
        agentId: string,
        tx: {
            to: string;
            value: string;
            chain: string;
            data?: string;
            signing_key_path?: string;
            gas_limit?: number;
        },
    ): Promise<SimulationResponse> {
        return this.request<SimulationResponse>(
            `${this.baseUrl}/v1/agents/${agentId}/transactions/simulate`,
            { method: "POST", body: JSON.stringify(tx) },
        );
    }

    async simulateBundle(
        agentId: string,
        transactions: Array<{
            to: string;
            value: string;
            chain: string;
            data?: string;
            signing_key_path?: string;
            gas_limit?: number;
        }>,
    ): Promise<BundleSimulationResponse> {
        return this.request<BundleSimulationResponse>(
            `${this.baseUrl}/v1/agents/${agentId}/transactions/simulate-bundle`,
            { method: "POST", body: JSON.stringify({ transactions }) },
        );
    }

    async submitTransaction(
        agentId: string,
        tx: {
            to: string;
            value: string;
            chain: string;
            data?: string;
            signing_key_path?: string;
            nonce?: number;
            gas_price?: string;
            gas_limit?: number;
            max_fee_per_gas?: string;
            max_priority_fee_per_gas?: string;
            simulate_first?: boolean;
        },
    ): Promise<TransactionResponse> {
        return this.request<TransactionResponse>(
            `${this.baseUrl}/v1/agents/${agentId}/transactions`,
            { method: "POST", body: JSON.stringify(tx) },
        );
    }
}
