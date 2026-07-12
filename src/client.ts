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
    SignTransactionResponse,
    SigningKeyResponse,
    SigningKeyListResponse,
    SignIntentResponse,
    ApiErrorBody,
    PlatformAppCreatedResponse,
    PlatformAppListResponse,
    PlatformRotateKeyResponse,
    BootstrapResponse,
    ApprovalResponse,
} from "./types.js";
import { DPoPManager } from "./auth/dpop.js";

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
    agentId?: string;
    apiKey: string;
    vaultId?: string;
}

interface AgentTokenResponse {
    access_token: string;
    expires_in: number;
    agent_id?: string;
    vault_ids?: string[];
}

function encodePath(path: string): string {
    return path
        .split("/")
        .map((s) => encodeURIComponent(s))
        .join("/");
}

/**
 * Best-effort extraction of the agent UUID from a 1Claw agent JWT's `sub`
 * claim (`"agent:<uuid>"`). Used in static-token mode (legacy
 * `ONECLAW_AGENT_TOKEN`) so agent-scoped tools (transactions, signing,
 * bindings/execute) can resolve their agent id without a key exchange.
 * The signature is NOT verified here — the server validates every JWT; we
 * only read the claim to know which `/v1/agents/{id}` path to call. Returns
 * `undefined` for non-agent tokens (e.g. user JWTs) or unparseable input.
 */
function agentIdFromJwt(token: string): string | undefined {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return undefined;
        const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = payload.padEnd(
            payload.length + ((4 - (payload.length % 4)) % 4),
            "=",
        );
        const json = Buffer.from(padded, "base64").toString("utf8");
        const sub = (JSON.parse(json) as { sub?: string }).sub;
        if (typeof sub === "string" && sub.startsWith("agent:")) {
            return sub.slice("agent:".length);
        }
    } catch {
        /* not a decodable JWT — leave agentId unresolved */
    }
    return undefined;
}

const REFRESH_BUFFER_MS = 60_000;

export class OneClawClient {
    private baseUrl: string;
    private token: string;
    private _vaultId: string;
    private _resolvedAgentId?: string;

    private agentCredentials?: { agentId?: string; apiKey: string };
    private tokenExpiresAt = 0;
    private dpopManager?: DPoPManager;
    private dpopReady: Promise<void> | null = null;

    constructor(config: ClientConfig | AgentCredentials) {
        this.baseUrl = config.baseUrl.replace(/\/$/, "");
        this._vaultId = config.vaultId ?? "";

        if (process.env.ONECLAW_DPOP === "true") {
            this.dpopManager = new DPoPManager();
        }

        if ("apiKey" in config && !("token" in config)) {
            this.agentCredentials = {
                agentId: config.agentId,
                apiKey: config.apiKey,
            };
            this.token = "";
        } else {
            this.token = (config as ClientConfig).token;
            // Static-token (legacy ONECLAW_AGENT_TOKEN) mode: resolve the agent
            // id from the JWT sub claim so agent-scoped tools work without a key
            // exchange.
            this._resolvedAgentId = agentIdFromJwt(this.token);
        }
    }

    /**
     * Drops the in-memory JWT so the next request re-exchanges the API key.
     * Used after 401 (revoked) or 403 stale scopes; also safe to call after
     * dashboard policy changes if you need a fresh token immediately.
     */
    invalidateCachedAgentToken(): void {
        if (!this.agentCredentials) return;
        this.token = "";
        this.tokenExpiresAt = 0;
    }

    private async ensureDPoP(): Promise<void> {
        if (!this.dpopManager) return;
        if (!this.dpopReady) {
            this.dpopReady = this.dpopManager.init();
        }
        await this.dpopReady;
    }

    private async ensureToken(): Promise<void> {
        if (!this.agentCredentials) return;
        if (this.token && Date.now() < this.tokenExpiresAt - REFRESH_BUFFER_MS)
            return;

        await this.ensureDPoP();

        const body: Record<string, unknown> = {
            api_key: this.agentCredentials.apiKey,
        };
        if (this.agentCredentials.agentId) {
            body.agent_id = this.agentCredentials.agentId;
        }
        if (this.dpopManager) {
            body.dpop_jwk = this.dpopManager.getPublicJwk();
        }

        const tokenUrl = `${this.baseUrl}/v1/auth/agent-token`;
        const tokenHeaders: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.dpopManager) {
            tokenHeaders["DPoP"] = await this.dpopManager.generateProof(
                "POST",
                tokenUrl,
            );
        }

        const res = await fetch(tokenUrl, {
            method: "POST",
            headers: tokenHeaders,
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try {
                const errBody = (await res.json()) as ApiErrorBody;
                if (errBody.detail) detail = errBody.detail;
            } catch {
                /* use default */
            }
            throw new OneClawApiError(
                res.status,
                `Agent auth failed: ${detail}`,
            );
        }

        const data = (await res.json()) as AgentTokenResponse;
        this.token = data.access_token;
        this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

        if (data.agent_id) {
            this._resolvedAgentId = data.agent_id;
            if (this.agentCredentials && !this.agentCredentials.agentId) {
                this.agentCredentials.agentId = data.agent_id;
            }
        }

        if (!this._vaultId && data.vault_ids && data.vault_ids.length === 1) {
            this._vaultId = data.vault_ids[0];
        }
    }

    private async autoDiscoverVault(): Promise<void> {
        const vaults = await this.listVaults();
        if (vaults.vaults && vaults.vaults.length > 0) {
            this._vaultId = vaults.vaults[0].id;
        }
    }

    private async headers(method: string = "GET", url?: string): Promise<Record<string, string>> {
        await this.ensureToken();
        const hdrs: Record<string, string> = {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
        };
        if (this.dpopManager && url) {
            hdrs["DPoP"] = await this.dpopManager.generateProof(method, url);
        }
        return hdrs;
    }

    private async resolveVaultUrl(suffix = ""): Promise<string> {
        if (!this._vaultId) {
            await this.autoDiscoverVault();
        }
        if (!this._vaultId) {
            throw new OneClawApiError(
                400,
                "No vault configured. Set ONECLAW_VAULT_ID, bind the agent to a vault, or create a vault first.",
            );
        }
        return `${this.baseUrl}/v1/vaults/${this._vaultId}${suffix}`;
    }

    /** True when a fresh JWT from /v1/auth/agent-token should fix the error (stale cache). */
    private shouldReexchangeAgentToken(status: number, detail: string): boolean {
        if (!this.agentCredentials) return false;
        if (status === 401) return true;
        if (status !== 403) return false;
        const d = detail.toLowerCase();
        return (
            d.includes("no scopes") ||
            d.includes("scopes do not cover") ||
            d.includes("token has been revoked")
        );
    }

    private async request<T>(
        url: string,
        init?: RequestInit,
        isRetry = false,
    ): Promise<T> {
        const method = init?.method ?? "GET";
        const hdrs = await this.headers(method, url);
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

            if (
                !isRetry &&
                this.shouldReexchangeAgentToken(res.status, detail)
            ) {
                this.invalidateCachedAgentToken();
                return this.request<T>(url, init, true);
            }

            throw new OneClawApiError(res.status, detail);
        }

        if (res.status === 204) return undefined as T;
        return res.json() as Promise<T>;
    }

    async listSecrets(): Promise<SecretListResponse> {
        return this.request<SecretListResponse>(await this.resolveVaultUrl("/secrets"));
    }

    async getSecret(path: string, clientShare?: string): Promise<SecretWithValue> {
        const extraHeaders: Record<string, string> = {};
        if (clientShare) {
            extraHeaders["x-client-share"] = clientShare;
        }
        return this.request<SecretWithValue>(
            await this.resolveVaultUrl(`/secrets/${encodePath(path)}`),
            Object.keys(extraHeaders).length > 0 ? { headers: extraHeaders } : undefined,
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
            await this.resolveVaultUrl(`/secrets/${encodePath(path)}`),
            { method: "PUT", body: JSON.stringify(body) },
        );
    }

    async listVersions(path: string): Promise<{ versions: SecretMetadata[] }> {
        return this.request<{ versions: SecretMetadata[] }>(
            await this.resolveVaultUrl(`/secret-versions/${encodePath(path)}`),
        );
    }

    async rotateGenerate(
        path: string,
        opts?: { length?: number; charset?: string; type?: string },
    ): Promise<SecretMetadata> {
        return this.request<SecretMetadata>(
            await this.resolveVaultUrl(`/secret-rotate/${encodePath(path)}`),
            { method: "POST", body: JSON.stringify(opts ?? {}) },
        );
    }

    async deleteSecret(path: string): Promise<void> {
        await this.request<void>(
            await this.resolveVaultUrl(`/secrets/${encodePath(path)}`),
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
        return this._resolvedAgentId ?? this.agentCredentials?.agentId;
    }

    get vaultId(): string {
        return this._vaultId;
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
        idempotencyKey?: string,
    ): Promise<TransactionResponse> {
        const key = idempotencyKey ?? crypto.randomUUID();
        return this.request<TransactionResponse>(
            `${this.baseUrl}/v1/agents/${agentId}/transactions`,
            {
                method: "POST",
                body: JSON.stringify(tx),
                headers: { "Idempotency-Key": key },
            },
        );
    }

    async signTransaction(
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
    ): Promise<SignTransactionResponse> {
        return this.request<SignTransactionResponse>(
            `${this.baseUrl}/v1/agents/${agentId}/transactions/sign`,
            { method: "POST", body: JSON.stringify(tx) },
        );
    }

    async listTransactions(
        agentId: string,
        opts?: { include_signed_tx?: boolean },
    ): Promise<{ transactions: TransactionResponse[] }> {
        const qs = opts?.include_signed_tx ? "?include_signed_tx=true" : "";
        return this.request<{ transactions: TransactionResponse[] }>(
            `${this.baseUrl}/v1/agents/${agentId}/transactions${qs}`,
        );
    }

    async getTransaction(
        agentId: string,
        txId: string,
        opts?: { include_signed_tx?: boolean },
    ): Promise<TransactionResponse> {
        const qs = opts?.include_signed_tx ? "?include_signed_tx=true" : "";
        return this.request<TransactionResponse>(
            `${this.baseUrl}/v1/agents/${agentId}/transactions/${txId}${qs}`,
        );
    }

    // ── Signing Keys & Sign Intent ──────────────────────

    async provisionSigningKey(
        agentId: string,
        chain: string,
    ): Promise<SigningKeyResponse> {
        return this.request<SigningKeyResponse>(
            `${this.baseUrl}/v1/agents/${agentId}/signing-keys`,
            { method: "POST", body: JSON.stringify({ chain }) },
        );
    }

    async listSigningKeys(
        agentId: string,
    ): Promise<SigningKeyListResponse> {
        return this.request<SigningKeyListResponse>(
            `${this.baseUrl}/v1/agents/${agentId}/signing-keys`,
        );
    }

    async signIntent(
        agentId: string,
        body: Record<string, unknown>,
    ): Promise<SignIntentResponse> {
        return this.request<SignIntentResponse>(
            `${this.baseUrl}/v1/agents/${agentId}/sign`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    // ── Bankr Dynamic Key Vending ────────────────────────────

    async leaseBankrKey(
        agentId: string,
        opts?: {
            wallet_id?: string;
            ttl_seconds?: number;
            permissions?: {
                llm_gateway_enabled?: boolean;
                agent_api_enabled?: boolean;
                read_only?: boolean;
            };
        },
    ): Promise<{ lease_id: string; api_key: string; wallet_id: string; expires_at: string }> {
        return this.request(
            `${this.baseUrl}/v1/agents/${agentId}/bankr-keys/lease`,
            { method: "POST", body: JSON.stringify(opts ?? {}) },
        );
    }

    async listBankrKeys(
        agentId: string,
    ): Promise<{ leases: Array<{ id: string; wallet_id: string; bankr_key_id: string; expires_at: string }> }> {
        return this.request(
            `${this.baseUrl}/v1/agents/${agentId}/bankr-keys`,
        );
    }

    async revokeBankrKey(
        agentId: string,
        leaseId: string,
    ): Promise<void> {
        await this.request(
            `${this.baseUrl}/v1/agents/${agentId}/bankr-keys/${leaseId}`,
            { method: "DELETE" },
        );
    }

    // ── Approvals ─────────────────────────────────────────

    async listApprovals(
        opts?: { status?: string; limit?: number },
    ): Promise<{ approvals: ApprovalResponse[] }> {
        const params = new URLSearchParams();
        if (opts?.status) params.set("status", opts.status);
        if (opts?.limit != null) params.set("limit", String(opts.limit));
        const qs = params.toString() ? `?${params.toString()}` : "";
        return this.request<{ approvals: ApprovalResponse[] }>(
            `${this.baseUrl}/v1/approvals${qs}`,
        );
    }

    async getApproval(approvalId: string): Promise<ApprovalResponse> {
        return this.request<ApprovalResponse>(
            `${this.baseUrl}/v1/approvals/${approvalId}`,
        );
    }

    async requestApproval(data: {
        action: string;
        target_type: string;
        target_id: string;
        summary: Record<string, unknown>;
        reason?: string;
        risk_tier?: number;
    }): Promise<ApprovalResponse> {
        return this.request<ApprovalResponse>(
            `${this.baseUrl}/v1/approvals/request`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }

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
        data: { template_id?: string; return_to?: string },
    ): Promise<BootstrapResponse> {
        return this.request<BootstrapResponse>(
            `${this.baseUrl}/v1/platform/connections/${connectionId}/bootstrap`,
            { method: "POST", body: JSON.stringify(data) },
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

    // ── Execution Intents ─────────────────────────────────────────

    async executeIntent(
        agentId: string,
        body: {
            binding: string;
            intent_type: string;
            execution_mode?: string;
            params: Record<string, unknown>;
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
        },
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

    // ── Signing Key Balance ──────────────────────────────────────────

    async getSigningKeyBalance(
        agentId: string,
        chain: string,
        tokens?: string,
    ): Promise<Record<string, unknown>> {
        const params = tokens ? `?tokens=${encodeURIComponent(tokens)}` : "";
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/signing-keys/${encodeURIComponent(chain)}/balance${params}`,
        );
    }
}
