# Changelog

## 0.62.1 (2026-09-17)

### Changed

- **Module split (plan Phase 2).** Each toolset is now a module under `src/toolsets/` that owns its tool list and gate description; `toolsets.ts` derives the catalog from them; the five tools that lived inline in `index.ts` moved to `src/tools/{secret_versions,env}.ts`; session state moved to `src/core/`. `import_boundaries.test.ts` enforces that toolset modules import only tools + client (never each other), tools never reach up, and `@1claw/mcp/security` stays dependency-light. `index.ts` is 560 lines, down from ~1170. No tool renamed, no behaviour change (prod stdio probe: 52 tools before and after).

- **Entitlements from the token exchange.** Vault ≥ 0.61.17 returns `entitlements` on `POST /v1/auth/agent-token`; the server uses it and skips the `GET /v1/agents/{id}` round trip. It also carries `treasury_signer` and `has_delegations`, so the `treasury` and `delegation` toolsets now come on by default when the vault says the agent uses them (still opt-in-able otherwise). Older vaults fall back to the profile GET as before.

## 0.62.0 (2026-09-17)

### Changed

- **Entitlement-based toolsets.** Every tool now belongs to a toolset (`src/toolsets.ts`) and a session is only offered the toolsets its agent is entitled to: `inspect`, `vault` and `approvals` always; `intents`, `execute`, `cards`, `memory`, `channels`, `directory` from the agent's flags; `treasury`, `delegation`, `chat`, `automations`, `runtimes`, `notification` by explicit opt-in (`ONECLAW_MCP_TOOLSETS` / `X-1Claw-Toolsets`); `admin` and `platform` never on an agent session. A vault-only agent sees ~24 tools instead of 155. `all` means everything the agent could use — it still excludes `admin`/`platform` and cannot add a flag-gated set.
- **`execution_require_tee` hides secret reads** (`get_secret`, `get_env_bundle`, `resolve_env`) and keeps writes/metadata, matching what the vault will actually allow.
- **One client per session.** Hosted mode used to build a fresh `OneClawClient` — and re-run the API-key exchange, vault probe and now the profile read — on every tool call, because the HTTP layer calls `authenticate` per request. Admissions are memoised by credential (10 min) and the same session object is reused, so the exchange happens once.
- **Entitlements are re-resolved** every 15 minutes and immediately after a `403` from the vault; hosted sessions get `notifications/tools/list_changed` when the visible set changes. Over stdio the set is fixed at startup — restart to pick up flag changes.
- **Degraded lookups are visible.** Each admission logs `toolsets=… lookup=full|jwt_only|failed`; a degraded lookup only ever narrows.
- **`resolve_env` joins the secret-carrying tool list** (its values are registered for redaction and it is exempt from output redaction like `get_secret`), and the hide list / redaction list now derive from one place.
- **Secret redaction cache evicts per agent.** The 1000-entry cap is applied per scope so one agent filling its bucket cannot evict another's entries; the scope is the agent id, with vault id only as a logged fallback.
- `vault://secrets` is gated like `list_secrets`.
- Added the in-process two-session harness (`hosted_sessions.test.ts`) that boots the real server against a fake vault and diffs `tools/list` between two agents.

## 0.43.1 (2026-08-03)

### Fixed

- **`list_automations` formatting:** Output now uses API fields `is_active`, `trigger_type`, and `cron_expr` (was incorrectly reading non-existent `status` / `schedule` / `description`).

### Changed

- Version bump aligned with platform `0.43.1` clients (OpenAPI / SDK / CLI). Automations create remains human/SDK/CLI (`workflow_spec`); MCP exposes list + trigger only.

## 0.40.3 (2026-07-12)

### Fixed

- **Agent id resolution in static-token mode:** When authenticating with a legacy static agent JWT (`ONECLAW_AGENT_TOKEN`), the client now decodes the agent id from the token's `sub: "agent:<uuid>"` claim. Previously `client.agentId` was left unset in this mode, so every agent-scoped tool (transactions, signing, `execute_http`, bindings, bankr leasing) failed with "Agent ID not resolved". Key-exchange mode (`ONECLAW_AGENT_API_KEY`) is unaffected.

## 0.40.2 (2026-07-12)

### Added

- **Execution Intents tools:** `execute_intent` (generic/non-HTTP intents, e.g. GraphQL), `create_binding` (human-only), `test_binding` (connectivity check), and `list_executions` (recent execution events). These join the existing `execute_http` and `list_bindings` tools.
- Client methods `createBinding`, `testBinding`, and `listExecutions` on the lightweight MCP client.

## 0.12.0 (2026-03-11)

### Security

- **Token validation (httpStream):** The `authenticate` callback now validates the Bearer token against the vault API (`GET /v1/vaults/{vaultId}`). Invalid or expired tokens are rejected at session establishment instead of being passed through.
- **Vault ID cross-check:** When using a JWT with a non-empty `vault_ids` claim, the provided `X-Vault-ID` header is validated against the API. If the vault is not in the token's allowed list, the session is rejected with a clear error.
- **Security inspection for all tools:** `rotate_and_store` and `get_env_bundle` now run through the same input/output security inspection pipeline as the other tools (injections, PII, etc.), instead of bypassing it.

## 0.11.0

- Initial public release with list/get/put/delete secrets, vaults, policies, sharing, and transaction simulation/submit.
