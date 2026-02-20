# Build Troubleshooting

Use this checklist when `my-smart-wallets-app` build stalls during `Creating an optimized production build ...`.

## Baseline

1. Ensure telemetry is disabled and memory is increased:
```bash
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=4096 npm run build
```
If memory errors persist, raise to:
```bash
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--max-old-space-size=8192 --max-semi-space-size=256" npm run build
```
2. Run from the web app directory:
```bash
cd my-smart-wallets-app
npm run build
```

## Debug Mode

Run a debug build to surface stuck phases:
```bash
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=4096 npx next build --debug
```

## Watchdog Checks

1. Verify no browser-only APIs are imported in server routes (`app/api/**`).
2. Keep heavy data fetching runtime-only for dashboard-style pages.
3. Avoid embedding large JSON blobs directly in page modules.
4. If a build appears stuck, capture only the last non-sensitive build log line and stop the process cleanly.

## Security Note

Never include `.env` or `.env.operator` values in build logs or issue reports.
