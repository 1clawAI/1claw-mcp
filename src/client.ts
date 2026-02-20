import type {
  SecretMetadata,
  SecretWithValue,
  SecretListResponse,
  VaultResponse,
  VaultListResponse,
  PolicyResponse,
  ShareLinkResponse,
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

function encodePath(path: string): string {
  return path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

export class OneClawClient {
  private baseUrl: string;
  private token: string;
  private vaultId: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
    this.vaultId = config.vaultId;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  private vaultUrl(suffix = ""): string {
    return `${this.baseUrl}/v1/vaults/${this.vaultId}${suffix}`;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers as Record<string, string>) },
    });

    if (!res.ok) {
      if (res.status === 402) {
        throw new OneClawApiError(
          402,
          "Free tier quota exhausted. Upgrade your plan or add payment at https://1claw.xyz/settings/billing",
        );
      }
      let detail = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as ApiErrorBody;
        if (body.detail) detail = body.detail;
      } catch {
        // use default detail
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

  async createVault(name: string, description?: string): Promise<VaultResponse> {
    return this.request<VaultResponse>(
      `${this.baseUrl}/v1/vaults`,
      { method: "POST", body: JSON.stringify({ name, description: description ?? "" }) },
    );
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
}
