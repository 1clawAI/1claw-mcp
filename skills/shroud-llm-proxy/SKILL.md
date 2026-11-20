---
name: shroud-llm-proxy
description: "Route LLM traffic through a TEE-based proxy that redacts secrets, detects prompt injection, and enforces per-agent security policies before requests reach the model provider. When an AI agent's LLM traffic must be inspected for secret leakage, injection attacks, or policy violations before reaching OpenAI, Anthropic, or other providers."
license: MIT
---

# Shroud LLM Proxy

Route LLM traffic through a TEE-based proxy that redacts secrets, detects prompt injection, and enforces per-agent security policies before requests reach the model provider.

## When to Use

Use this skill when you need to:
- Prevent secret leakage in LLM requests and responses
- Detect and block prompt injection attacks in real-time
- Enforce per-agent rate limits, model allowlists, and spending budgets
- Inspect tool call arguments for credential exfiltration

## Supported Providers

OpenAI, Anthropic, Google (Gemini), Mistral, Cohere, OpenRouter, Stripe AI Gateway

## Configuration

Enable Shroud per-agent via the dashboard or API. Set `shroud_enabled: true` and configure `shroud_config` for threat detection policies.

## Links

- [Documentation](https://docs.1claw.co)
