# @1claw/mcp-vault

The vault-only build of the [1claw MCP server](https://www.npmjs.com/package/@1claw/mcp): secrets, versions, rotation, env bundles, vaults, sharing, connected accounts, and human approvals — **24 tools**, plus the `vault://secrets` resource.

**What is not in this package:** signing, transaction submission, execution bindings, cards, memory, channels, chat, automations, runtimes, directory, platform and admin tools — not hidden, *not in the tree*. The build keeps only the runtime import closure of the entrypoint (`scripts/prune-dist.mjs`), and `src/__tests__/split_packages.test.ts` fails if any of that code becomes reachable. Use `@1claw/mcp` when you need those.

Same configuration as the umbrella package:

```json
{
  "mcpServers": {
    "1claw": {
      "command": "npx",
      "args": ["-y", "@1claw/mcp-vault"],
      "env": { "ONECLAW_AGENT_API_KEY": "ocv_..." }
    }
  }
}
```

Entitlement gating, `execution_require_tee` (hides `get_secret`, `get_env_bundle`, `resolve_env`), `ONECLAW_MCP_TOOLSETS`, the local daemon mode and the security inspection pipeline all behave exactly as in `@1claw/mcp` — this is the same server with fewer toolset modules installed. Hosted at `https://mcp.1claw.co` you always get the umbrella; this package exists for stdio deployments where "the agent's MCP server cannot sign" must be true of the code on disk.

Versioned in lockstep with `@1claw/mcp`.
