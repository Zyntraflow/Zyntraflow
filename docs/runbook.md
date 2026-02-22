# Zyntraflow Execution Runbook

## 1) Start In Dry-Run
- Set `EXECUTION_ENABLED=false` in local `.env.execution`.
- Run operator and confirm scan/report/alerts are stable.
- Verify `/api/health` shows no execution errors.

## 2) Hot Wallet Funding
- Use a dedicated hot wallet only for execution.
- Keep balance minimal and capped to expected gas + small trade amount.
- Never reuse treasury or long-term custody wallets.

## 3) Manual Token Approvals
- Keep `APPROVALS_ENABLED=false` until needed.
- Set `APPROVALS_ALLOWLIST_JSON` to approved token/spender addresses.
- Run approval command only with explicit confirmation:

```bash
npm run approve -- --token 0xToken --spender 0xSpender --amount 0.01 --decimals 18 --i-understand
```

- Confirm only tx hash is logged.

## 4) Enable Live Execution Safely
- Set strict caps in `.env.execution`:
- `EXECUTION_MAX_TRADE_ETH`
- `EXECUTION_MAX_GAS_GWEI`
- `EXECUTION_MAX_SLIPPAGE_BPS`
- `EXECUTION_DAILY_LOSS_LIMIT_ETH`
- `EXECUTION_MAX_CONSECUTIVE_SEND_FAILS`
- Enable with `EXECUTION_ENABLED=true` only after dry-run review.

## 5) Kill Switch Operations
- Immediate stop: create `KILL_SWITCH_FILE` (default `./reports/KILL_SWITCH`).
- Execution will stop on next policy check.
- Clear only after root cause is fixed.

## 6) Stuck/Pending Transaction Handling
- Pending tx guard watches `reports/execution/pending.json`.
- If tx age exceeds `EXECUTION_PENDING_TIMEOUT_SECONDS`, kill switch is activated.
- Alert channels (Discord/Telegram) are used if enabled.

## 7) Rollback
- Set `EXECUTION_ENABLED=false`.
- Keep operator running in read-only mode.
- If needed, redeploy previous git tag/commit with:
- `git checkout <safe-commit>`
- `docker compose up -d --build`
