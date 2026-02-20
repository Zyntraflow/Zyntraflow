# Zyntraflow

![Zyntraflow Logo](./logo.svg)
[![Health Endpoint](https://img.shields.io/badge/health-%2Fapi%2Fhealth-2ea44f)](https://YOUR_DOMAIN/api/health)

Security-first TypeScript foundation for read-only market scanning and dry-run opportunity detection.

## Status

No live trading/execution in this branch yet.

This branch only supports:
- RPC health checks and failover
- read-only block/market primitives
- deterministic dry-run opportunity reports
- read-only quote sourcing and multi-pair scan simulation
- on-chain Access Pass ownership gating for premium read-only features

This branch does not include:
- transaction signing
- transaction broadcasting
- private relay logic
- arbitrage execution

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment template:
```bash
cp .env.example .env
```

3. Bootstrap local development defaults:
```bash
npm run bootstrap:env
```

4. Fill local `.env` values:
- `ALCHEMY_URL`
- wallet private key variable (see `.env.example`)
- `TARGET_NETWORK`
- `MIN_PROFIT_GAP`
- `RPC_FALLBACK_URLS` (optional, comma-separated URLs)
- `ENABLE_REPORT_PERSISTENCE` (`true`/`false`, default `false`)
- `ACCESS_PASS_CHAIN_ID`
- `ACCESS_PASS_CONTRACT_ADDRESS`
- `ACCESS_PASS_TOKEN_ID` (default `1`)
- `ACCESS_PASS_MIN_BALANCE` (default `1`)
- `ACCESS_PASS_ACCEPTED_CHAINS` (CSV, e.g. `1,42161,8453`)
- `ACCESS_PASS_CONTRACTS_JSON` (JSON map of `chainId -> contract`)
- `ENABLE_PREMIUM_MODE` (`true`/`false`, default `false`)
- `USER_WALLET_ADDRESS` (optional for premium ownership checks)
- `USER_LOGIN_SIGNATURE` (optional CLI alternative: `--signature`)
- premium signer key variable from `.env.example` (local only)
- `PREMIUM_PACKAGE_TTL_SECONDS` (default `60`)
- `PREMIUM_PACKAGE_VERSION` (default `1`)
- `PREMIUM_MAX_PACKAGES_PER_HOUR` (default `30`)
- `PREMIUM_RATE_LIMIT_WINDOW_SECONDS` (default `3600`)
- `IPFS_UPLOAD_URL` (optional)
- `IPFS_AUTH_TOKEN` (optional)
- `ENABLE_PUBLIC_SUMMARY_PUBLISH` (`true`/`false`, default `false`)
- `ENABLE_PUBLIC_METRICS` (`true`/`false`, default `false`)
- `ACCESS_PASS_MINT_PRICE_WEI` (optional, used in mint instructions only)
- `OPERATOR_MAX_TICKS` (`0` = unlimited, default `0`)
- `OPERATOR_JITTER_MS` (tick jitter in ms, default `500`)
- `RPC_MAX_CONCURRENCY` (scan request cap, default `2`)
- `RPC_RETRY_MAX` (RPC retries per call, default `2`)
- `RPC_RETRY_BACKOFF_MS` (retry backoff base, default `250`)
- `RPC_TIMEOUT_MS` (RPC timeout in ms, default `8000`)

Never commit `.env`.

Base recommended: set `TARGET_NETWORK=base` and `ACCESS_PASS_CHAIN_ID=8453` for Base-first launch.

## Global Users Quickstart

Free mode:
1. `npm run dev`
2. Read signed summary from `/api/feed/latest`

Mint instructions:
1. `npm run dev -- --mint-calldata`
2. Use `to`, `value`, and `data` in any wallet transaction UI (no tx sending in this repo)

Premium mode:
1. `npm run dev -- --address 0xYourAddress --print-login-message`
2. Sign message in wallet
3. `npm run dev -- --premium true --address 0xYourAddress --signature 0xYourSignature`

Premium package decrypt:
1. Fetch package from `/api/premium/<reportHash>/<address>`
2. Decrypt locally with your signature-derived key

One-command operator start:
1. `cp .env.operator.example .env.operator`
2. Fill local values in `.env.operator`
3. `npm run operator`

VPS checklist:
1. Use a dedicated non-root user.
2. Keep `.env` and `.env.operator` on disk only, never in git.
3. Enable restart policy (`docker compose up -d` + `restart: unless-stopped`).
4. Monitor `/api/health` and disk space for `reports/`.
5. Rotate operator signer and API tokens periodically.

### Operator Environment

For scheduled global feed runs, use an isolated operator env file:

```bash
cp .env.operator.example .env.operator
```

`src/config.ts` loads `.env.operator` first, then `.env`, so operator-specific values can be isolated safely.

Operator loop controls:
- `OPERATOR_ENABLE=true|false`
- `OPERATOR_INTERVAL_SECONDS`
- `OPERATOR_MAX_TICKS`
- `OPERATOR_JITTER_MS`

## Commands

- `npm run preflight`: secret leak scan
- `npm run lint`: static lint checks
- `npm test`: unit tests
- `npm run bootstrap:env`: generate local non-empty dev defaults in `.env`
- `npm run dev`: run connectivity + dry-run scan
- `npm run operator`: run scheduled operator scan loop
- `npm run build`: compile TypeScript
- `docker compose build`: build operator + web images
- `docker compose up`: run operator + web services
- `bash scripts/smoke-test.sh https://YOUR_DOMAIN`: production smoke check
- `powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test-windows.ps1 -Domain zyntraflow.org -OriginIp <VPS_IP>`: Windows connectivity smoke check

## Build Reliability

- Web build uses increased Node memory and telemetry disabled by default.
- Runtime-driven pages use dynamic rendering to avoid heavy static optimization stalls.
- Build watchdog guide: `docs/build-troubleshooting.md`

## Security Controls

- `.env` and `.env.*` are git-ignored.
- preflight scanner blocks hardcoded 64-hex key patterns in tracked files.
- Husky `pre-commit` blocks:
  - tracked/staged `.env`
  - staged 64-hex key patterns
  - sensitive key markers in disallowed files

See `SECURITY.md` for full hardening details.

## Simulation

- Dry-run opportunities are evaluated with gas + slippage models.
- No transaction execution paths exist in this branch.
- When `ENABLE_REPORT_PERSISTENCE=true`, scan outputs are written to:
  - `reports/YYYY-MM-DD/free-summary-<timestamp>.json`
  - `reports/YYYY-MM-DD/premium-package-<timestamp>.json` (premium unlocked only)

## Signed Public Feed

- Every scan creates `FreeSummary`, then signs it into `SignedFreeSummary` for public authenticity.
- Signature is generated by the app signer key (same key source used for premium package signing).
- Anyone can verify summary authenticity off-chain by recomputing canonical hash and checking the signature.
- Feed artifacts are written to:
  - `public-feed/latest.json`
  - `public-feed/history/YYYY-MM-DD.jsonl`
- Signed feed artifacts are written to:
  - `public-feed/latest.signed.json`
  - `public-feed/history/YYYY-MM-DD.jsonl`
- Generated feed artifacts are git-ignored by default.

## Free Summary + Report Hash

- Every scan computes a deterministic `reportHash` from canonicalized scan JSON.
- A safe public `FreeSummary` is always built from scan results and includes the same `reportHash`.
- If premium is unlocked, the encrypted premium package header also carries this `reportHash`.
- This creates an integrity link between the public summary and the premium package without exposing premium contents.
- If enabled, public publishing sends `SignedFreeSummary` (not raw summary).

## Read-Only Quote Sources

- `mock`: deterministic quotes for local and test-safe runs.
- `onchain_univ2`: read-only `getAmountsOut` on Uniswap V2 router (provider only, no signer).
- Scan pipeline compares sources and feeds opportunities into simulation only.

## Pair and Token Configuration

- Chains: `src/chains/chains.ts`
- Tokens: `src/tokens/tokens.ts`
- Pairs: `src/pairs/pairs.ts`

To add a new market:
1. Add token metadata to the target chain registry.
2. Add an enabled pair entry with trade size and liquidity depth hint.
3. Re-run `npm test` and `npm run dev` to validate dry-run scan behavior.

## Access Pass (Crypto-Native Premium Gate)

- Access Pass is an ERC-1155 token gate for premium scanner features.
- Ownership is verified read-only on-chain via `balanceOf`.
- Users keep full custody in their own wallet; this repo stores no private keys.

### Free mode

- Single-pair scan
- lower concurrency
- report persistence disabled

### Premium mode (read-only only)

- Multi-pair scan
- higher concurrency
- richer report fields
- optional report persistence

If premium is requested but pass ownership is missing, scanner logs:
`Premium locked: mint Access Pass to unlock`

### Scanner CLI flags

- `--address 0x...` wallet address to verify
- `--premium true|false` premium request override
- `--mint-info` print Access Pass mint details/instructions
- `--mint-calldata` print wallet-ready calldata + EIP-681 deep link for `mint()`
- `--print-login-message` print the wallet login message + nonce
- `--signature 0x...` wallet-produced login signature used for premium package encryption key derivation

### Premium Report Protection (Encrypted + Signed)

When premium is active and Access Pass ownership is verified, the scanner can package reports as:
- encrypted payload (AES-256-GCM)
- signed package (authenticity via operator signer key)
- replay-resistant header (`nonce`, `issuedAt`, `expiresAt`, versioned metadata)

Flow:
1. Print login message:
```bash
npm run dev -- --address 0xYourAddress --print-login-message
```
2. Sign that message in your wallet (off-chain).
3. Run premium scan with signature:
```bash
npm run dev -- --premium true --address 0xYourAddress --signature 0xYourSignature
```

Never publish reusable login signatures in public channels.

### Optional Public Summary Publishing (IPFS)

If `ENABLE_PUBLIC_SUMMARY_PUBLISH=true`, the app attempts to publish the free summary JSON via `IPFS_UPLOAD_URL`.

Notes:
- Works with generic JSON upload APIs (provider selected by env).
- If publish fails, scan continues and only logs the publish error.
- Premium package data is never published by this flow.

## Public API (Web App)

When running `my-smart-wallets-app`, public feed data is available via:
- `/api/feed/latest`
- `/api/feed/history?date=YYYY-MM-DD`
- `/api/health`
- `/api/public-config`
- `/api/metrics` (only when `ENABLE_PUBLIC_METRICS=true`)

Encrypted premium packages can be fetched by:
- `/api/premium/<reportHash>/<address>`
- `/api/alerts/latest`
- `POST /api/subscriptions`
- `GET /api/subscriptions/<address>`

Premium payloads are encrypted and user-bound. Users fetch package JSON then decrypt locally with their signature-derived key.

Troubleshooting:
- If `/api/health` shows `lastTickOk: false`, check operator logs and verify RPC env values in `.env.operator`.
- If `/api/feed/latest` is empty, run a bounded operator tick and recheck:
  - `OPERATOR_MAX_TICKS=1 npm run operator -- --operator true --interval 5`

Security reminders:
- Never share wallet signatures publicly.
- Never commit `.env` or `.env.operator`.
- Keep all scanner behavior read-only in this branch.

## Alerts + Wallet-Signed Subscriptions

- Alert subscriptions are authenticated by wallet signature only (SIWE-lite style), no account/password flow.
- Subscriptions are stored locally at `reports/subscriptions/<address>.json`.
- Alert artifacts are stored at:
  - `reports/alerts/YYYY-MM-DD.jsonl`
  - `reports/alerts/latest.json`
- Webhook delivery is HTTPS-only and best effort with retry/backoff.
- Email delivery is intentionally disabled unless operator SMTP credentials are configured in a future integration.
- In-app alert feed is available at `/api/alerts/latest` and `/alerts`.
- Operator can send Discord alerts (rate-limited, one top alert per tick):
  - `ENABLE_DISCORD_ALERTS`
  - `DISCORD_BOT_TOKEN`
  - `DISCORD_CHANNEL_ID`
  - `DISCORD_ALERTS_MIN_INTERVAL_SECONDS`
- Operator can send Telegram alerts (rate-limited, one top alert per tick):
  - `ENABLE_TELEGRAM_ALERTS`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
  - `TELEGRAM_ALERTS_MIN_INTERVAL_SECONDS`

Telegram setup:
1. Create a bot with BotFather and get bot token.
2. Add bot to your target chat/channel.
3. Use the target chat ID in `.env.operator`.
4. Keep token/chat values only in `.env.operator` and never commit them.

## Production Deployment (Docker)

Services:
- `operator`: scheduled read-only scanner loop
- `web`: Next.js app + public feed APIs

Shared volumes:
- `./reports:/app/reports`
- `./public-feed:/app/public-feed` (operator)
- `./public-feed:/app/public/public-feed` (web)

Run:
```bash
docker compose build
docker compose up
```

Production HTTPS reverse proxy:
- Caddy is included in `docker-compose.yml`
- set `DOMAIN=your.domain.com` before `docker compose up -d --build`
- deployment walkthrough: `docs/deploy-vps.md`
- If you see Cloudflare `522`, use the Windows-first runbook: `docs/windows-vps-deploy.md`

### Premium Rate Limit

- Premium package creation is rate-limited per wallet.
- State is persisted under `reports/rate-limit/<wallet>.json`.
- When limit is hit, scanner continues in free-summary mode and logs: `Premium rate limit reached`.

### Wallet-Native Mint Instructions (No TX Sending)

Generate mint calldata and a deep link for any wallet:

```bash
npm run dev -- --mint-calldata
```

Output includes:
- `chainId`
- `to` (contract)
- `value` (wei)
- `data` (encoded `mint()`)
- `eip681` deep link: `ethereum:<contract>@<chainId>?value=<wei>&data=<calldata>`

### Access Pass contract deployment (optional)

Hardhat project lives under `contracts/`.

Example deployment command:
```bash
npx hardhat run contracts/scripts/deploy.ts --network alchemy --config contracts/hardhat.config.ts
```

Minting is done directly by users calling `mint()` on the deployed contract.
No execution/trading logic is introduced by this flow.

## License

Apache License 2.0. See `LICENSE`.

## Community

- Discord: https://discord.gg/p7Ty4ERH
- X: https://x.com/zyntraflow
- GitHub: https://github.com/Zyntraflow
