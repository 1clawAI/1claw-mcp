---
name: platform-api
description: "Build applications on top of 1Claw. Provision users, vaults, agents, and policies via bootstrap templates. Embedded wallets, spend policies, and OAuth flows included. When a developer is building a product that needs to programmatically provision 1Claw resources for end users, or wants to embed wallet functionality in their app."
license: MIT
---

# Platform API

Build applications on top of 1Claw. Provision users, vaults, agents, and policies via declarative bootstrap templates. Includes embedded wallets, spend policies, and OAuth flows.

## When to Use

Use this skill when you need to:
- Provision 1Claw resources for end users programmatically
- Embed wallet functionality in your application
- Implement "Sign in with 1Claw" OAuth flows
- Manage spend policies for connected users

## MCP Tools

| Tool | Description |
|------|-------------|
| `platform_list_apps` | List platform apps for the organization |
| `platform_create_app` | Register a new platform app |
| `platform_bootstrap_user` | Bootstrap resources for a connected user |

## Links

- [Documentation](https://docs.1claw.co)
- [npm: @1claw/mcp](https://www.npmjs.com/package/@1claw/mcp)
