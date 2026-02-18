# Security Model

## Scope

This repository is currently read-only + simulation only.

No live trading/execution in this branch yet.

## Secret Handling

- Real secrets live only in local `.env`.
- `.env` and `.env.*` are ignored by git.
- `.env.example` contains placeholders only.
- Secrets must never be hardcoded in TypeScript files.

## Automated Protection

### Preflight Scan

`npm run preflight` scans the repository for high-risk secret patterns and fails fast when detected.

### Pre-commit Hook

The Husky hook blocks commits when:
- `.env` is tracked or staged
- staged text files contain 64-hex private-key-like patterns
- sensitive key markers appear outside allowlisted config files

## Logging Rules

- Logging is redacted and sanitized.
- Wallet secrets and RPC key fragments are censored.
- Dry-run reports are structured and contain no execution payloads.

## Operational Safety

- Provider layer is read-only and signer-free.
- Market primitives are dry-run only.
- Opportunity detector does not sign, send, or broadcast transactions.
