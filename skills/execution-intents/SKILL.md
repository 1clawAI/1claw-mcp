---
name: execution-intents
description: "Make HTTP and GraphQL calls through pre-configured bindings with credentials injected server-side. API keys never exposed to agents. When an AI agent needs to call external APIs with stored credentials that should not appear in agent context or logs."
license: MIT
---

# Execution Intents

Make HTTP, GraphQL, database, and cloud API calls through pre-configured bindings with credentials injected server-side. API keys, tokens, and database passwords never appear in agent context.

## When to Use

Use this skill when you need to:
- Call external APIs with stored credentials (e.g. Stripe, Twilio, SendGrid)
- Query databases without exposing connection strings
- Make authenticated GraphQL requests to third-party services
- Execute outbound HTTP, gRPC, SMTP, or S3 operations with credential injection and audit logging

## MCP Tools

| Tool | Description |
|------|-------------|
| `execute_http` | Execute an HTTP request through a configured binding |
| `execute_intent` | Execute any binding type through a configured binding |
| `list_bindings` | List available execution bindings for the agent |

## Binding Types

All binding types are available on **Pro+**:

| Type | Description |
|------|-------------|
| HTTP | REST API calls with header/bearer/query auth injection |
| GraphQL | GraphQL queries and mutations with auth injection |
| Postgres | Database queries with connection string injection |
| MySQL | Database queries with connection string injection |
| Redis | Redis commands with auth injection |
| gRPC | gRPC calls with metadata auth injection |
| SMTP | Send emails with SMTP credential injection |
| Cloud SDK | Cloud provider API calls (AWS/GCP/Azure) |
| S3 | Object storage operations with credential injection |
| Custom | Custom binding type with arbitrary credential format |

## Security

- Credentials are stored in the `__agent-keys` vault and never exposed to agents
- Per-binding host allowlists restrict which domains the agent can reach
- Per-agent ownership enforced: agents can only access their own bindings
- Response bodies truncated and sanitized before audit logging
- TEE execution mode available on Business+ tier for additional isolation

## Links

- [Execution Intents Guide](https://docs.1claw.co/docs/guides/execution-intents)
- [Intents API Reference](https://docs.1claw.co/docs/guides/intents-api)
