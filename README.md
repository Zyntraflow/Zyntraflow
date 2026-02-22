# Zyntraflow

![Zyntraflow Logo](./logo.svg)
[![Health Endpoint](https://img.shields.io/badge/health-%2Fapi%2Fhealth-2ea44f)](https://zyntraflow.org/api/health)

Zyntraflow is a security-first crypto scanner platform:
- read-only multi-chain scan + simulation + signed public feed
- premium encrypted packages + access-pass gating
- optional isolated execution module with strict policy controls

## Core Modes

1. Read-only scanner (default)
- no transaction execution
- signed public summaries
- premium encrypted package generation

2. Optional execution module (isolated)
- disabled by default
- policy-gated and simulation-required
- instant file-based kill switch

## Quick Start (Operator)

```bash
npm install
cp .env.example .env
cp .env.operator.example .env.operator
npm run bootstrap:env
npm run operator
```

For Docker deployment:

```bash
docker compose up -d --build
```

## Environment Files

- `.env`: base runtime settings (local only, never commit)
- `.env.operator`: operator/runtime secrets (local only, never commit)
- `.env.execution`: execution-module secrets and limits (local only, never commit)
- `.env.example`, `.env.operator.example`, `.env.execution.example`: placeholders only

## Public Endpoints

- `/api/health`
- `/api/feed/latest`
- `/api/feed/history?date=YYYY-MM-DD`
- `/api/public-config`
- `/api/readiness`
- `/api/alerts/latest`

Premium package pull:
- `/api/premium/<reportHash>/<address>`

## Premium Access Pass

- on-chain ownership check (read-only)
- free mode stays available if pass is missing
- premium package is encrypted and user-bound

Mint helper:

```bash
npm run dev -- --mint-calldata
```

## Alerts

- in-app feed (`/api/alerts/latest`)
- webhook delivery (HTTPS only)
- optional Discord/Telegram delivery from operator env

Never commit any bot tokens.

## Execution Module (Dangerous, Optional)

Execution is isolated in `src/execution/` and defaults to off.

Execution env template:

```bash
cp .env.execution.example .env.execution
```

Key controls:
- `EXECUTION_ENABLED=false` by default
- manual approvals gate (`APPROVALS_ENABLED`)
- chain allowlist (`EXECUTION_CHAIN_ID`)
- max trade, gas cap, slippage cap
- min net profit threshold
- daily loss limit
- cooldown between sends
- replay protection window (`EXECUTION_REPLAY_WINDOW_SECONDS`)
- stuck-tx timeout (`EXECUTION_PENDING_TIMEOUT_MINUTES`)
- to-address allowlist
- kill switch file (`KILL_SWITCH_FILE`)

Kill switch:
- create file at `reports/KILL_SWITCH` to stop execution immediately

Execution safety policy:
- scanner/feeds remain read-only regardless
- execution path requires policy pass + simulation pass before send
- nonce manager prevents tx nonce collisions
- pending tx guard can trigger kill switch + channel alerts
- no private keys or auth tokens logged

Manual approval tool (explicit CLI args required):

```bash
npm run approve:execution -- --chain-id 8453 --token 0xToken --spender 0xSpender --amount 0.01 --decimals 18
```

## Security Gates

Run before commits:

```bash
npm run preflight
npm test
npm run lint
```

Web build check:

```bash
cd my-smart-wallets-app
npm run build
```

## Community

- Discord: https://discord.gg/p7Ty4ERH
- X: https://x.com/zyntraflow
- GitHub: https://github.com/Zyntraflow

## License

Apache License 2.0 (`LICENSE`)
