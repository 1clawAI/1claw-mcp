# @1claw/mcp-guard

The security-inspection-only build of the [1claw MCP server](https://www.npmjs.com/package/@1claw/mcp): one tool, **`inspect_content`**, which scores text for prompt injection, command injection, encoded and unicode-obfuscated payloads, PII, and leaked secrets.

**No account, no credentials, no network.** There is no vault client in this package — the build keeps only the runtime import closure of the entrypoint, and `src/__tests__/split_packages.test.ts` fails if `src/client/*` or any vault tool becomes reachable. Useful with Ollama, LM Studio, or any local model where you want injection detection without a 1claw account.

```json
{
  "mcpServers": {
    "1claw-guard": {
      "command": "npx",
      "args": ["-y", "@1claw/mcp-guard"]
    }
  }
}
```

This is `@1claw/mcp` with `ONECLAW_LOCAL_ONLY=true` baked in and the rest of the code left out. Versioned in lockstep.
