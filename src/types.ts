export const SECRET_TYPES = [
  "api_key",
  "password",
  "private_key",
  "certificate",
  "file",
  "note",
  "ssh_key",
  "env_bundle",
] as const;

export type SecretType = (typeof SECRET_TYPES)[number];

export interface SecretMetadata {
  id: string;
  path: string;
  type: SecretType;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
}

export interface SecretWithValue extends SecretMetadata {
  value: string;
}

export interface SecretListResponse {
  secrets: SecretMetadata[];
}

export interface VaultResponse {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_by_type: string;
  created_at: string;
}

export interface VaultListResponse {
  vaults: VaultResponse[];
}

export interface PolicyResponse {
  id: string;
  vault_id: string;
  secret_path_pattern: string;
  principal_type: string;
  principal_id: string;
  permissions: string[];
  conditions: Record<string, unknown>;
  expires_at: string | null;
  created_by: string;
  created_by_type: string;
  created_at: string;
}

export interface ShareLinkResponse {
  id: string;
  share_url: string;
  recipient_type: string;
  recipient_email?: string;
  expires_at: string;
  max_access_count: number;
}

export interface ApiErrorBody {
  type: string;
  title: string;
  status: number;
  detail: string;
}
