import { ClientCore } from "./core.js";
import type {
    SimulationResponse,
    BundleSimulationResponse,
    TransactionResponse,
    SignTransactionResponse,
    SigningKeyResponse,
    SigningKeyListResponse,
    SignIntentResponse,
} from "../types.js";

/** intents domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class IntentsApi extends ClientCore {
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


    // ── Passkey-owned Safe: spend under an Allowance Module grant ──────

    async spendFromPasskeySafe(
        agentId: string,
        safeId: string,
        spend: { to: string; amount: string; token?: string },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/passkey-safes/${encodeURIComponent(safeId)}/spend`,
            { method: "POST", body: JSON.stringify(spend) },
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


    // ── Import Signing Key ──────────────────────────────────────────────

    async importSigningKey(
        agentId: string,
        chain: string,
        privateKey: string,
        format: string,
        password: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/signing-keys/${encodeURIComponent(chain)}/import`,
            {
                method: "POST",
                body: JSON.stringify({ private_key: privateKey, format }),
                headers: { "X-Auth-Confirm": password },
            },
        );
    }


    // ── Portfolio ────────────────────────────────────────────────────────

    async getPortfolio(
        chains?: string,
        includeTokens?: boolean,
    ): Promise<{ wallets: unknown[]; total_usd_estimate?: string }> {
        const params = new URLSearchParams();
        if (chains) params.set("chains", chains);
        if (includeTokens) params.set("include_tokens", "true");
        const qs = params.toString();
        return this.request(
            `${this.baseUrl}/v1/portfolio${qs ? `?${qs}` : ""}`,
        );
    }


    // ── Import Smart Account ────────────────────────────────────────────

    async importSmartAccount(
        agentId: string,
        chain: string,
        chainId: number,
        safeAddress: string,
        verify?: boolean,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/smart-accounts/import`,
            {
                method: "POST",
                body: JSON.stringify({
                    chain,
                    chain_id: chainId,
                    safe_address: safeAddress,
                    verify: verify ?? true,
                }),
            },
        );
    }


    // ── Agent Safe accounts (Phase 5) ────────────────────────────────────

    async listAgentAccounts(
        agentId: string,
    ): Promise<{
        accounts: Array<{
            id: string;
            chain: string;
            account_type: string;
            address?: string | null;
            safe_version?: string | null;
            modules_enabled?: string[];
            deploy_status: string;
            cosign_enabled?: boolean;
            metadata?: Record<string, unknown>;
        }>;
    }> {
        return this.request(`${this.baseUrl}/v1/agents/${agentId}/accounts`);
    }

    async migrateAgentToSafe(
        agentId: string,
        body: { chain: string; deprecate_eoa?: boolean },
    ): Promise<{
        agent_id: string;
        chain: string;
        safe_address: string;
        safe_version: string;
        modules: string[];
        eoa_address?: string | null;
        deploy_status: string;
        roles_config_hash: string;
        allowance_config_hash: string;
        warnings: string[];
    }> {
        return this.request(`${this.baseUrl}/v1/agents/${agentId}/accounts/migrate`, {
            method: "POST",
            body: JSON.stringify(body),
        });
    }

    async deprecateAgentEoa(
        agentId: string,
        chain: string,
    ): Promise<{
        id: string;
        chain: string;
        account_type: string;
        address?: string | null;
        deploy_status: string;
    }> {
        return this.request(
            `${this.baseUrl}/v1/agents/${agentId}/accounts/${encodeURIComponent(chain)}/deprecate-eoa`,
            { method: "POST" },
        );
    }

    async getSafeModuleRegistry(chain: string): Promise<{
        chain: string;
        modules: Array<{ name: string; address: string; version: string }>;
    }> {
        return this.request(
            `${this.baseUrl}/v1/safe/module-registry/${encodeURIComponent(chain)}`,
        );
    }

    async syncOrgSafeAllowances(): Promise<{
        org_id: string;
        agents_checked: number;
        compiled: unknown[];
        drift_detected: Array<{ agent_id: string; chain: string; reason: string }>;
        onchain_sync: string;
    }> {
        return this.request(`${this.baseUrl}/v1/org/safe/sync-allowances`, {
            method: "POST",
        });
    }
}
