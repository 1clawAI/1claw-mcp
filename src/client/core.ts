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
    CardResponse,
} from "../types.js";
import { DPoPManager } from "../auth/dpop.js";

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
    /** Runtime-bound agent JWTs require this on every Vault API call. */
    runtimeId?: string;
}

export interface AgentCredentials {
    baseUrl: string;
    agentId?: string;
    apiKey: string;
    vaultId?: string;
    runtimeId?: string;
}

/** `entitlements` on the agent token exchange (vault ≥ 0.61.17). */
export interface AgentEntitlementsResponse {
    intents_api: boolean;
    execution_intents: boolean;
    execution_require_tee: boolean;
    intents_require_tee: boolean;
    cards: boolean;
    memory: boolean;
    shroud: boolean;
    discoverable: boolean;
    treasury_signer: boolean;
    has_delegations: boolean;
}

interface AgentTokenResponse {
    access_token: string;
    expires_in: number;
    agent_id?: string;
    vault_ids?: string[];
    entitlements?: AgentEntitlementsResponse;
}

/** Subset of `AgentResponse` the MCP server reads for toolset gating. */
export interface AgentProfileResponse {
    id: string;
    is_active?: boolean;
    intents_api_enabled?: boolean;
    execution_intents_enabled?: boolean;
    execution_require_tee?: boolean;
    intents_require_tee?: boolean;
    cards_enabled?: boolean;
    memory_enabled?: boolean;
    shroud_enabled?: boolean;
    discoverable?: boolean;
    platform_app_id?: string | null;
}

export function encodePath(path: string): string {
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
function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return undefined;
        const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = payload.padEnd(
            payload.length + ((4 - (payload.length % 4)) % 4),
            "=",
        );
        const json = Buffer.from(padded, "base64").toString("utf8");
        const parsed = JSON.parse(json);
        return typeof parsed === "object" && parsed !== null
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

function agentIdFromJwt(token: string): string | undefined {
    const payload = decodeJwtPayload(token);
    const sub = payload?.sub;
    if (typeof sub === "string" && sub.startsWith("agent:")) {
        return sub.slice("agent:".length);
    }
    return undefined;
}

function runtimeIdFromJwt(token: string): string | undefined {
    const payload = decodeJwtPayload(token);
    const runtimeId = payload?.runtime_id;
    return typeof runtimeId === "string" && runtimeId.length > 0
        ? runtimeId
        : undefined;
}

const REFRESH_BUFFER_MS = 60_000;

/**
 * Auth, token exchange and the request primitive. Every domain API class
 * extends this and is mixed into `OneClawClient` (see ./index.ts).
 */
export class ClientCore {
    protected baseUrl: string;
    protected token: string;
    protected _vaultId: string;
    protected _resolvedAgentId?: string;
    protected _runtimeId?: string;

    protected agentCredentials?: { agentId?: string; apiKey: string };
    protected tokenExpiresAt = 0;
    protected _entitlements?: AgentEntitlementsResponse;
    protected dpopManager?: DPoPManager;
    protected dpopReady: Promise<void> | null = null;

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
            this._runtimeId =
                config.runtimeId || process.env.ONECLAW_RUNTIME_ID || undefined;
        } else {
            this.token = (config as ClientConfig).token;
            // Static-token (legacy ONECLAW_AGENT_TOKEN) mode: resolve the agent
            // id from the JWT sub claim so agent-scoped tools work without a key
            // exchange.
            this._resolvedAgentId = agentIdFromJwt(this.token);
            this._runtimeId =
                (config as ClientConfig).runtimeId ||
                runtimeIdFromJwt(this.token) ||
                process.env.ONECLAW_RUNTIME_ID ||
                undefined;
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

    protected async ensureDPoP(): Promise<void> {
        if (!this.dpopManager) return;
        if (!this.dpopReady) {
            this.dpopReady = this.dpopManager.init();
        }
        await this.dpopReady;
    }

    protected async ensureToken(): Promise<void> {
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
        this._entitlements = data.entitlements;

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

    protected async autoDiscoverVault(): Promise<void> {
        // Inline rather than the listVaults method: that method lives in the
        // secrets domain, and core must not depend on a domain.
        const vaults = await this.request<VaultListResponse>(`${this.baseUrl}/v1/vaults`);
        if (!vaults.vaults || vaults.vaults.length === 0) {
            return;
        }
        const preferred = vaults.vaults.find((v) => v.name === "default");
        this._vaultId = preferred?.id ?? vaults.vaults[0].id;
    }

    protected async headers(method: string = "GET", url?: string): Promise<Record<string, string>> {
        await this.ensureToken();
        const hdrs: Record<string, string> = {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
        };
        const runtimeId = this._runtimeId || process.env.ONECLAW_RUNTIME_ID;
        if (runtimeId) {
            hdrs["X-1Claw-Runtime-Id"] = runtimeId;
        }
        if (this.dpopManager && url) {
            hdrs["DPoP"] = await this.dpopManager.generateProof(method, url);
        }
        return hdrs;
    }

    protected async resolveVaultUrl(suffix = ""): Promise<string> {
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
    protected shouldReexchangeAgentToken(status: number, detail: string): boolean {
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

    protected async request<T>(
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
                    "Quota exhausted. Ask your human to upgrade the plan, add prepaid credits, or enable x402 micropayments at https://1claw.co/settings/billing",
                );
            }

            if (
                res.status === 403 &&
                errorType === "resource_limit_exceeded"
            ) {
                throw new OneClawApiError(
                    403,
                    `Resource limit reached: ${detail}. Ask your human to upgrade the plan at https://1claw.co/settings/billing`,
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


    get agentId(): string | undefined {
        return this._resolvedAgentId ?? this.agentCredentials?.agentId;
    }

    /**
     * Decoded (not verified — the vault verifies) claims of the JWT this
     * client is presenting. Performs the API-key exchange first if needed,
     * so a fresh client can answer. Used to derive session entitlements.
     */
    async tokenClaims(): Promise<Record<string, unknown> | undefined> {
        await this.ensureToken();
        return decodeJwtPayload(this.token);
    }

    /**
     * Entitlements the vault returned with the last key exchange, if it is
     * new enough to send them. Undefined on the static-token path and
     * against older vaults — callers then fall back to the profile GET.
     */
    async tokenEntitlements(): Promise<AgentEntitlementsResponse | undefined> {
        await this.ensureToken();
        return this._entitlements;
    }

    /** `GET /v1/agents/{id}` — the agent's own profile, including its feature flags. */
    async getAgent(agentId: string): Promise<AgentProfileResponse> {
        return this.request<AgentProfileResponse>(
            `${this.baseUrl}/v1/agents/${agentId}`,
        );
    }

    get vaultId(): string {
        return this._vaultId;
    }

}
