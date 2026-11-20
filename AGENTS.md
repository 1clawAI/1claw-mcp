# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, Codex, Copilot and others) working in this repository, and for agents that use the 1Claw MCP server.

## What this repo is

The 1Claw MCP server: a Model Context Protocol server that gives AI agents secrets management, multi-chain transaction signing, Execution Intents, agent memory, approvals and more through the 1Claw API (https://api.1claw.co). It ships as the npm package `@1claw/mcp` (stdio) and runs hosted at https://mcp.1claw.co/mcp (Streamable HTTP).

- Product: https://1claw.co
- Docs: https://docs.1claw.co
- API reference: https://docs.1claw.co/docs/reference/api-reference
- Agent authentication: https://1claw.co/auth.md
- Index for agents: https://1claw.co/llms.txt

## Layout

- `src/index.ts`: entry point (stdio and hosted transports)
- `src/core/`: server setup, hosted sessions, rate limiting
- `src/tools/`: one file per tool
- `src/toolsets/` and `src/toolsets.ts`: tools grouped into toolsets and offered per agent entitlement
- `src/client/`: typed API client used by the tools
- `src/security/`: content inspection and output sanitising
- `src/__tests__/`: vitest suites
- `packages/vault`, `packages/guard`: the split packages `@1claw/mcp-vault` and `@1claw/mcp-guard`, versioned in lockstep
- `tool-manifest.json`: generated from the live tool catalog; do not edit by hand
- `skills/`: Agent Skills (one `SKILL.md` per folder); `plugin.json` and `mcp.json` make the repo an Agent Plugin
- `rules/1claw.mdc`: Cursor rules for agents using the server

## Commands

```bash
npm install
npm run build          # tsc
npm test               # vitest run
npm run tools:manifest # rebuild tool-manifest.json after adding or removing a tool
npm run dev            # interactive testing
npm run inspect        # MCP Inspector
```

Node 22 or later.

## Rules for changes

- Never log, return or echo a secret value. Tools that touch secrets return metadata or a reference, and `get_secret` logs only the path.
- A new tool needs: its file in `src/tools/`, a place in a toolset in `src/toolsets/`, a regenerated `tool-manifest.json`, and a test.
- Keep toolset entitlements strict: a selection can narrow or opt in, never grant a toolset the agent is not entitled to.
- Bump the version in `package.json`, `server.json`, `plugin.json` and both split packages together, and add a `CHANGELOG.md` entry.
- Run `npm test` and `npm run build` before proposing a change.

## Using the server as an agent

- Only `ONECLAW_AGENT_API_KEY` (an `ocv_` key) is required; the agent ID and vaults are discovered.
- List before you fetch: `list_secrets` returns paths, never values. Fetch with `get_secret` only at the moment of use.
- Prefer Execution Intents (`execute_http`, `execute_intent`) so a credential is used server side and never enters your context.
- Signing goes through policy: simulate first (`simulate_transaction`), and expect a `202 awaiting_approval` when a human must approve.

## Security

Report vulnerabilities to ops@1claw.co. See https://1claw.co/.well-known/security.txt.
