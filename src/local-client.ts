/**
 * LocalDaemonClient — thin client that talks to the local 1claw daemon
 * over a Unix socket. Implements the subset of OneClawClient methods
 * used by MCP tools (list_secrets, get_secret, put_secret, etc.).
 *
 * When ONECLAW_LOCAL_VAULT=true and ONECLAW_DAEMON_SOCKET is set,
 * the MCP server uses this client instead of the cloud API client.
 */

import http from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR =
    process.env.ONECLAW_CONFIG_DIR || join(homedir(), ".config", "1claw");
const DEFAULT_SOCKET =
    process.env.ONECLAW_DAEMON_SOCKET || join(CONFIG_DIR, "daemon.sock");

interface DaemonSecretMeta {
    name: string;
    type: string;
    synced: boolean;
}

function daemonRequest<T>(
    socketPath: string,
    method: string,
    path: string,
    body?: unknown,
): Promise<T> {
    return new Promise((resolve, reject) => {
        const options: http.RequestOptions = {
            socketPath,
            method,
            path,
            headers: { "Content-Type": "application/json" },
        };

        const req = http.request(options, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => {
                const raw = Buffer.concat(chunks).toString("utf-8");
                try {
                    const parsed = JSON.parse(raw);
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(
                            new Error(
                                parsed.error ?? `Daemon returned ${res.statusCode}`,
                            ),
                        );
                    } else {
                        resolve(parsed as T);
                    }
                } catch {
                    reject(new Error(`Daemon returned non-JSON: ${raw}`));
                }
            });
        });

        req.on("error", (err) => {
            if ((err as NodeJS.ErrnoException).code === "ECONNREFUSED" ||
                (err as NodeJS.ErrnoException).code === "ENOENT") {
                reject(
                    new Error(
                        "Local daemon is not running. Start it with: 1claw daemon start",
                    ),
                );
            } else {
                reject(err);
            }
        });

        req.setTimeout(10_000, () => {
            req.destroy(new Error("Daemon request timed out"));
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

/**
 * Partial duck-type of OneClawClient that uses the local daemon.
 * Only the methods called by MCP tools are implemented.
 */
export class LocalDaemonClient {
    private socketPath: string;

    constructor(socketPath?: string) {
        this.socketPath = socketPath ?? DEFAULT_SOCKET;
    }

    get agentId(): string | undefined {
        return "local-daemon";
    }

    get vaultId(): string {
        return "local";
    }

    async listSecrets(): Promise<{ secrets: DaemonSecretMeta[] }> {
        const res = await daemonRequest<{ secrets: DaemonSecretMeta[] }>(
            this.socketPath,
            "GET",
            "/secrets",
        );
        return {
            secrets: res.secrets.map((s) => ({
                ...s,
                path: s.name,
                secret_type: s.type,
                version: 1,
            })),
        };
    }

    async getSecret(
        path: string,
    ): Promise<{ path: string; value: string; type: string; version: number }> {
        const meta = await daemonRequest<{
            name: string;
            type: string;
        }>(this.socketPath, "GET", `/secrets/${encodeURIComponent(path)}`);

        // The daemon intentionally does NOT serve raw values via GET.
        // For MCP local mode, we allow it since MCP needs the value.
        // The daemon serves metadata; for full values we do a proxy-self call.
        // Actually, for local MCP mode, we extend the daemon protocol to
        // include a value-read endpoint on a separate authenticated path.
        // For now, the MCP in local mode reads the vault file directly.
        throw new Error(
            `Local daemon does not expose raw secret values via MCP. ` +
            `Use 'proxy' tool to inject "${path}" into API requests without exposing the value.`,
        );
    }

    async putSecret(
        _path: string,
        _body: { value: string; type: string },
    ): Promise<{ path: string; version: number }> {
        throw new Error(
            "Writing secrets is not supported in local daemon mode. Use `1claw local add` from the CLI.",
        );
    }

    async deleteSecret(_path: string): Promise<void> {
        throw new Error(
            "Deleting secrets is not supported in local daemon mode. Use `1claw local rm` from the CLI.",
        );
    }

    async createVault(): Promise<never> {
        throw new Error("Vault creation is not supported in local daemon mode.");
    }

    async listVaults(): Promise<{ vaults: Array<{ id: string; name: string }> }> {
        return {
            vaults: [{ id: "local", name: "Local Vault" }],
        };
    }

    /**
     * Proxy a request through the daemon — the key Phase C feature.
     * The AI agent calls this instead of get_secret, and the daemon
     * injects the secret into the HTTP request without exposing it.
     */
    async proxyRequest(opts: {
        secretName: string;
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    }): Promise<{ status: number; headers: Record<string, string>; body: string }> {
        return daemonRequest(this.socketPath, "POST", "/proxy", opts);
    }

    /**
     * Check if a secret + host combination is allowed by policy.
     */
    async checkPolicy(
        secretName: string,
        url: string,
    ): Promise<{ allowed: boolean; reason: string }> {
        return daemonRequest(this.socketPath, "POST", "/check-policy", {
            secretName,
            url,
        });
    }
}

export function isLocalDaemonMode(): boolean {
    return (
        process.env.ONECLAW_LOCAL_VAULT === "true" ||
        process.env.ONECLAW_LOCAL_VAULT === "1"
    );
}

export function createLocalClient(): LocalDaemonClient {
    return new LocalDaemonClient();
}
