# Secrets Management with 1Claw MCP

Use when the user asks to "store a secret", "fetch credentials", "rotate an API key", "manage secrets", "set up vault access", or any task involving secure credential storage and retrieval.

## Overview

The 1Claw MCP server provides secure, just-in-time secrets management for AI agents. Secrets are stored in encrypted vaults with policy-based access control and fetched only when needed — never persisted in the LLM context.

## Core Workflow

### 1. Discover available secrets

```
Tool: list_secrets
```

Returns paths and metadata (never values). Use this to understand what's available before fetching.

### 2. Check if a secret exists

```
Tool: describe_secret
Input: { "path": "api-keys/stripe" }
```

Returns metadata (type, created_at, version) without exposing the value.

### 3. Fetch a secret value

```
Tool: get_secret
Input: { "path": "api-keys/stripe" }
```

Returns the decrypted value. Use it immediately and do not store it in memory, summaries, or logs.

### 4. Store a new secret

```
Tool: put_secret
Input: { "path": "api-keys/new-service", "value": "sk_live_...", "type": "api_key" }
```

Creates or updates a secret (versioned — old versions preserved).

### 5. Rotate a secret (server-side generation)

```
Tool: rotate_generate
Input: { "path": "api-keys/internal-token", "length": 64, "charset": "base64" }
```

Generates a cryptographically strong new value server-side. The old value becomes a previous version.

### 6. Share access securely

```
Tool: share_secret
Input: { "path": "api-keys/stripe", "recipient_type": "creator" }
```

Share a secret with your human creator or another agent. Never copy-paste credentials.

## Environment Bundles

For `.env`-style secrets (multiple KEY=VALUE pairs stored together):

```
Tool: get_env_bundle
Input: { "path": "env/production" }
```

Returns parsed JSON of all key-value pairs in the bundle.

## Security Rules

1. **Never output secret values in your response text.** If you need to confirm a secret, describe it (type, path, last rotated) without showing the value.
2. **Use rotate_generate for rotation.** Never generate secrets yourself — the server uses a CSPRNG.
3. **Check content with inspect_content** before storing anything that came from an untrusted source.
4. **Use versioning.** Call `list_versions` to see history; disabled old versions with caution.
5. **Prefer scoped access.** Use `grant_access` with specific path glob patterns.

## Common Patterns

### Fetch and use an API key

1. `get_secret` → get the value
2. Use it in your API call
3. Do not store it anywhere

### Rotate credentials on schedule

1. `rotate_generate` with appropriate length/charset
2. Update the consuming service with the new value
3. Old version is preserved as a rollback option

### Set up a new project's secrets

1. `create_vault` → dedicated vault for the project
2. `put_secret` for each credential
3. `grant_access` for agents/users who need access
