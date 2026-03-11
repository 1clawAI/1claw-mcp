# Changelog

## 0.12.0 (2026-03-11)

### Security

- **Token validation (httpStream):** The `authenticate` callback now validates the Bearer token against the vault API (`GET /v1/vaults/{vaultId}`). Invalid or expired tokens are rejected at session establishment instead of being passed through.
- **Vault ID cross-check:** When using a JWT with a non-empty `vault_ids` claim, the provided `X-Vault-ID` header is validated against the API. If the vault is not in the token's allowed list, the session is rejected with a clear error.
- **Security inspection for all tools:** `rotate_and_store` and `get_env_bundle` now run through the same input/output security inspection pipeline as the other tools (injections, PII, etc.), instead of bypassing it.

## 0.11.0

- Initial public release with list/get/put/delete secrets, vaults, policies, sharing, and transaction simulation/submit.
