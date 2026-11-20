---
name: oidc-federation
description: "Exchange 1Claw agent tokens for RS256 OIDC JWTs accepted by Anthropic Workload Identity Federation, GCP STS, and AWS STS. No static credentials on the relying party. When an AI agent needs to authenticate to external cloud services or Anthropic's API without static API keys, using federated identity instead."
license: MIT
---

# OIDC Federation

Exchange 1Claw agent tokens for RS256 OIDC JWTs accepted by external relying parties. Supports Anthropic Workload Identity Federation, GCP STS, and AWS STS. No static credentials on the relying party.

## When to Use

Use this skill when you need to:
- Authenticate to Anthropic's API without static API keys
- Federate identity to GCP or AWS via STS token exchange
- Issue short-lived OIDC tokens with caller-specified audiences
- Eliminate static credentials on external services

## How It Works

1. Agent authenticates with 1Claw (ocv_ key → JWT)
2. Agent calls `POST /v1/auth/federated-token` with target audience
3. 1Claw issues an RS256 OIDC JWT signed by the published JWKS
4. Relying party validates the JWT against `https://api.1claw.co/.well-known/jwks.json`

## Links

- [OIDC Federation Guide](https://docs.1claw.co)
- [JWKS Endpoint](https://api.1claw.co/.well-known/jwks.json)
- [OpenID Configuration](https://api.1claw.co/.well-known/openid-configuration)
