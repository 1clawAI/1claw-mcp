# Changelog

## 0.40.2 (2026-07-12)

### Added

- **Execution Intents tools:** `execute_intent` (generic/non-HTTP intents, e.g. GraphQL), `create_binding` (human-only), `test_binding` (connectivity check), and `list_executions` (recent execution events). These join the existing `execute_http` and `list_bindings` tools.
- Client methods `createBinding`, `testBinding`, and `listExecutions` on the lightweight MCP client.

### Fixed

- **Agent id resolution in static-token mode:** When authenticating with a legacy static agent JWT (`ONECLAW_AGENT_TOKEN`), the client now decodes the agent id from the token's `sub: "agent:<uuid>"` claim. Previously `client.agentId` was left unset in this mode, so every agent-scoped tool (transactions, signing, `execute_http`, bindings, bankr leasing) failed with "Agent ID not resolved". Key-exchange mode (`ONECLAW_AGENT_API_KEY`) is unaffected.

## 0.12.0 (2026-03-11)

### Security

- **Token validation (httpStream):** The `authenticate` callback now validates the Bearer token against the vault API (`GET /v1/vaults/{vaultId}`). Invalid or expired tokens are rejected at session establishment instead of being passed through.
- **Vault ID cross-check:** When using a JWT with a non-empty `vault_ids` claim, the provided `X-Vault-ID` header is validated against the API. If the vault is not in the token's allowed list, the session is rejected with a clear error.
- **Security inspection for all tools:** `rotate_and_store` and `get_env_bundle` now run through the same input/output security inspection pipeline as the other tools (injections, PII, etc.), instead of bypassing it.

## 0.11.0

- Initial public release with list/get/put/delete secrets, vaults, policies, sharing, and transaction simulation/submit.
