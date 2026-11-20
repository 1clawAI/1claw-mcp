---
name: transaction-signing
description: "Sign and broadcast transactions on 29 EVM chains plus Bitcoin, Solana, XRP, Cardano, and Tron. dRPC managed RPC. Private keys stay in the vault. When an AI agent needs to send cryptocurrency, interact with smart contracts, or sign messages without direct access to private keys."
license: MIT
---

# Multi-Chain Transaction Signing

Sign and broadcast transactions on 29 EVM chains (with dRPC managed RPC) plus 5 non-EVM chains (Bitcoin, Solana, XRP, Cardano, Tron) without exposing private keys. Supports EIP-191 personal_sign, EIP-712 typed data, and raw digest signing.

## When to Use

Use this skill when you need to:
- Send cryptocurrency or interact with smart contracts on any supported chain
- Sign messages (EIP-191, EIP-712) for on-chain verification
- Broadcast transactions via dRPC managed endpoints without managing RPC infrastructure
- Simulate transactions before signing (Tenderly integration, EVM only)
- Sign XRP transactions (30+ types including Payment, TrustSet, OfferCreate, NFTokenMint, etc.)

## MCP Tools

| Tool | Description |
|------|-------------|
| `submit_transaction` | Sign and broadcast a transaction |
| `sign_transaction` | Sign without broadcasting (returns signed_tx hex) |
| `simulate_transaction` | Simulate via Tenderly before signing |
| `simulate_bundle` | Simulate a bundle of sequential transactions |
| `list_signing_keys` | List provisioned per-chain signing keys |
| `provision_signing_key` | Provision a new signing key for a chain |
| `sign_message` | EIP-191 personal_sign |
| `sign_typed_data` | EIP-712 structured data signing |
| `sign_digest` | Raw 32-byte digest signing (ERC-1271/Polymarket) |
| `get_signing_key_balance` | Query native + token balances for a signing key |

## Supported Chains

**EVM mainnets (29)**: Ethereum, Base, Optimism, Arbitrum One, Polygon, Avalanche, BSC, zkSync Era, Linea, Scroll, Mantle, Blast, Gnosis, Fantom, Celo, Aurora, Metis, Moonbeam, Cronos, Sonic, World Chain, Polygon zkEVM, Sei, Kaia, Mode, Arbitrum Nova, Berachain, Taiko, Zora, Robinhood Chain

**EVM testnets**: Sepolia, Base Sepolia, Holesky, Optimism Sepolia, Arbitrum Sepolia, Polygon Amoy, Arc Testnet, Robinhood Testnet

**Non-EVM (signing keys)**: Ethereum (secp256k1), Bitcoin (secp256k1), Solana (Ed25519), XRP (Ed25519), Cardano (Ed25519), Tron (secp256k1)

## Self-custody wallets (human owners)

These are owner wallets, not agent signing keys. The vault cannot spend them alone.

- `client_tss`: 2-of-3 FROST. The vault holds share 1; the owner's device holds share 2 (wrapped under a passkey) and the offline recovery kit holds shares 2 and 3. Solana is on by default; XRP, Cardano and Bitcoin Taproot are enabled per org. `GET /v1/keys/tss/chains` lists what the caller's org can create.
- `client_multisig` (beta): Tron 2-of-3 native multisig, and EVM 2-of-3 Safes (native transfers only).
- Every owner prepare route (`POST /v1/treasury/wallets/{chain}/tss/prepare`, the Tron multisig prepare, the Safe prepare) runs wallet access, sanctions screening, spend policy and `treasury_send` consensus first, and accepts an optional `approval_id`.
- Sanctions screening applies to bare 40-hex EVM addresses the same as to `0x` addresses.

## Links

- [Intents API Guide](https://docs.1claw.co/docs/guides/intents-api)
- [npm: @1claw/mcp](https://www.npmjs.com/package/@1claw/mcp)
