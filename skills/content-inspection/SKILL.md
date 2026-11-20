---
name: content-inspection
description: "Scan text for prompt injection, PII, command injection, social engineering, and encoding obfuscation. Works offline with no API key required. When an AI agent needs to validate user input or LLM output for security threats before processing."
license: MIT
---

# Content Inspection

Scan text for prompt injection, PII, command injection, social engineering, and encoding obfuscation. Works entirely offline with no API key or network calls.

## When to Use

Use this skill when you need to:
- Validate user input before processing
- Check LLM output for security threats
- Detect PII (SSN, credit cards, API keys) in text
- Identify prompt injection or social engineering attempts

## MCP Tools

| Tool | Description |
|------|-------------|
| `inspect_content` | Analyze text and return threat verdicts with severity |

## Quick Start (No Auth Required)

```json
{
  "mcpServers": {
    "1claw": {
      "command": "npx",
      "args": ["-y", "@1claw/mcp"],
      "env": { "ONECLAW_LOCAL_ONLY": "true" }
    }
  }
}
```

## Links

- [Documentation](https://docs.1claw.co)
- [npm: @1claw/mcp](https://www.npmjs.com/package/@1claw/mcp)
