/**
 * Tools that carry secret values. Dependency-free so `@1claw/mcp/security`
 * can import it without pulling the tool tree in.
 */

/** Return secret values. Hidden under `execution_require_tee`; never redacted. */
export const SECRET_READ_TOOLS: readonly string[] = ["get_secret", "get_env_bundle", "resolve_env"];
/** Accept secret values as input. Kept under `execution_require_tee`; never redacted. */
export const SECRET_WRITE_TOOLS: readonly string[] = ["put_secret", "rotate_and_store"];
