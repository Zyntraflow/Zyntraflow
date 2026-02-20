# Windows-First VPS Deploy and Cloudflare 522 Recovery

This runbook is for Windows operators using PowerShell. It helps you diagnose and fix `522 Origin Connection Timed Out` for:

- `https://zyntraflow.org`
- `https://www.zyntraflow.org`

## 1) Find VPS IPv4

Use your provider dashboard (DigitalOcean, Hetzner, AWS, Azure, etc.) and copy the VM public IPv4 address.

## 2) Verify DNS from Windows PowerShell

```powershell
nslookup zyntraflow.org
nslookup www.zyntraflow.org
```

Both records should resolve to your VPS IPv4.

## 3) Check network reachability from Windows

```powershell
Test-NetConnection <VPS_IP> -Port 22
Test-NetConnection <VPS_IP> -Port 80
Test-NetConnection <VPS_IP> -Port 443
```

Interpretation:
- If `22/80/443` time out or fail, the problem is provider firewall, host firewall, or server state (not Cloudflare).
- If `80/443` are reachable but domain still fails, check Caddy and DNS/SSL mode.

## 4) If SSH is blocked, use provider Web Console

Open your provider serial/web console and run:

```bash
cd /path/to/Zyntraflow
git pull origin main
printf "DOMAIN=zyntraflow.org\n" > .env
cp -n .env.operator.example .env.operator
# Fill .env.operator locally with real values (never commit it)
```

Open host firewall ports (Ubuntu UFW):

```bash
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw status
```

Stop conflicting web servers if needed:

```bash
sudo systemctl stop nginx || true
sudo systemctl stop apache2 || true
sudo ss -ltnp | grep -E ':80|:443' || true
```

Start stack:

```bash
docker compose down || true
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 caddy
docker compose logs --tail 100 web
docker compose logs --tail 100 operator
```

Origin checks on VPS:

```bash
curl -I http://localhost/api/health
curl -I http://localhost/api/feed/latest
curl -I http://localhost/api/readiness
```

Expected:
- `/api/health` should be `200`.
- `/api/feed/latest` can be `200` or `404` before first operator artifact.

## 5) Provider Firewall Checklist

Ensure your cloud firewall/security group allows inbound:
- TCP `22` (SSH)
- TCP `80` (HTTP)
- TCP `443` (HTTPS)

Also confirm:
- VM is running.
- Public IPv4 is attached to this VM.
- No upstream network ACL blocks traffic.

## 6) Cloudflare mode reminder

Set Cloudflare SSL/TLS mode to `Full (strict)`.  
`Flexible` can cause TLS/redirect problems when origin is HTTPS-enabled.

## 7) Optional PowerShell smoke script

Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test-windows.ps1 -Domain zyntraflow.org -OriginIp <VPS_IP>
```

