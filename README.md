# @1claw/mcp

An MCP (Model Context Protocol) server that gives AI agents secure, just-in-time access to secrets stored in the [1claw](https://1claw.xyz) vault. Secrets are fetched at runtime via the 1claw Agent API and never persisted in the LLM context window beyond the moment they are used.

## Transport Modes

The server supports two transport modes:

| Mode                | Use case                       | Auth                                                                 |
| ------------------- | ------------------------------ | -------------------------------------------------------------------- |
| **stdio** (default) | Local — Claude Desktop, Cursor | Env: `ONECLAW_AGENT_ID` + `ONECLAW_AGENT_API_KEY` (recommended) or `ONECLAW_AGENT_TOKEN`; plus `ONECLAW_VAULT_ID` |
| **httpStream**      | Hosted at `mcp.1claw.xyz`      | Per-request headers: `Authorization: Bearer <token>`, `X-Vault-ID`   |

Set `MCP_TRANSPORT=httpStream` and `PORT=8080` to run in hosted mode.

## Installation (local / stdio)

```bash
cd packages/mcp
pnpm install
pnpm run build
```

## Environment Variables

| Variable                  | Required   | Default                 | Description                                                                 |
| ------------------------- | ---------- | ----------------------- | --------------------------------------------------------------------------- |
| `ONECLAW_AGENT_ID`        | stdio*     | —                       | Agent UUID (from dashboard). Use with `ONECLAW_AGENT_API_KEY` (recommended). |
| `ONECLAW_AGENT_API_KEY`   | stdio*     | —                       | Agent API key (`ocv_...`). Server exchanges this for a JWT and auto-refreshes. |
| `ONECLAW_AGENT_TOKEN`     | stdio*     | —                       | Static Bearer JWT (alternative to ID+key; expires in ~1 h).                |
| `ONECLAW_VAULT_ID`        | stdio only | —                       | UUID of the vault to operate on.                                           |
| `ONECLAW_BASE_URL`        | No         | `https://api.1claw.xyz` | API base URL (override for self-hosted).                                    |
| `MCP_TRANSPORT`           | No         | `stdio`                 | Transport mode: `stdio` or `httpStream`.                                   |
| `PORT`                    | No         | `8080`                  | HTTP port (httpStream mode only).                                          |

\* For stdio, set either **`ONECLAW_AGENT_ID` + `ONECLAW_AGENT_API_KEY`** (recommended for `api_key` auth method agents) or **`ONECLAW_AGENT_TOKEN`** (required for `mtls` / `oidc_client_credentials` agents, or as a static JWT alternative).

## Tools

| Tool                   | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `list_secrets`         | List all secrets (metadata only — never values)                              |
| `get_secret`           | Fetch the decrypted value of a secret by path                                |
| `put_secret`           | Create or update a secret (creates a new version)                            |
| `delete_secret`        | Soft-delete a secret at a path                                               |
| `describe_secret`      | Get metadata without fetching the value                                      |
| `rotate_and_store`     | Store a new value for an existing secret and return the version              |
| `get_env_bundle`       | Fetch an env_bundle secret and parse it as KEY=VALUE JSON                    |
| `create_vault`         | Create a new vault (auto-shared with the agent's human creator)              |
| `list_vaults`          | List all vaults the agent can access (own + shared)                          |
| `grant_access`         | Share a vault with a user or agent (own vaults only)                         |
| `share_secret`         | Share a secret with your creator, a user/agent by ID, or create an open link |
| `simulate_transaction` | Simulate a transaction via Tenderly without signing or broadcasting          |
| `submit_transaction`   | Submit a transaction intent to be signed and optionally broadcast            |

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

## Example Workflow

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
