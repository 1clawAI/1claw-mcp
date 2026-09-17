import { ClientCore, encodePath } from "./core.js";
import type {
    SecretMetadata,
    SecretWithValue,
    SecretListResponse,
    VaultResponse,
    VaultListResponse,
    PolicyResponse,
    ShareLinkResponse,
} from "../types.js";

/** secrets domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class SecretsApi extends ClientCore {
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
        txConditions?: Record<string, unknown>,
    ): Promise<PolicyResponse> {
        const payload: Record<string, unknown> = {
            secret_path_pattern: secretPathPattern,
            principal_type: principalType,
            principal_id: principalId,
            permissions,
        };
        if (txConditions) payload.tx_conditions = txConditions;
        return this.request<PolicyResponse>(
            `${this.baseUrl}/v1/vaults/${vaultId}/policies`,
            {
                method: "POST",
                body: JSON.stringify(payload),
            },
        );
    }


    // ── Environment Variables ─────────────────────────────────────────────

    async resolveEnvVars(
        environment?: string,
        gitBranch?: string,
    ): Promise<{ vars: Record<string, string>; sources: Record<string, string>; environment: string; git_branch?: string; resolved_at: string }> {
        let url = await this.resolveVaultUrl(`/env-vars/resolve`);
        const params: string[] = [];
        if (environment) {
            params.push(`environment=${encodeURIComponent(environment)}`);
        }
        if (gitBranch) {
            params.push(`git_branch=${encodeURIComponent(gitBranch)}`);
        }
        if (params.length > 0) {
            url += `?${params.join("&")}`;
        }
        return this.request(url);
    }

}
