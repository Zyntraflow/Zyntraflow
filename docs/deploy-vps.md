# Deploy on VPS (Docker + Caddy HTTPS)

This guide assumes Ubuntu 22.04/24.04 and a fresh server.

## 1) Install Docker + Compose

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

## 2) Clone and configure

```bash
git clone https://github.com/Zyntraflow/Zyntraflow.git
cd Zyntraflow
cp .env.operator.example .env.operator
```

Edit local `.env.operator` and fill required values only.

Set domain for Caddy (shell env or `.env` at repo root):

```bash
export DOMAIN=your.domain.com
```

## 3) Start production stack

```bash
docker compose up -d --build
```

## 4) DNS + automatic HTTPS

- Create DNS `A` record for `your.domain.com` to your VPS public IP.
- Open inbound ports `80` and `443` in your cloud firewall.
- Caddy will automatically provision and renew TLS certificates once DNS resolves.

## 5) Verify endpoints

```bash
curl -fsS https://$DOMAIN/api/health
curl -fsS https://$DOMAIN/api/feed/latest
bash scripts/smoke-test.sh https://$DOMAIN
```

`/api/feed/latest` may return `404` until operator produces the first signed summary.

## 6) Common checks

```bash
docker compose ps
docker compose logs --tail=100 caddy
docker compose logs --tail=100 web
docker compose logs --tail=100 operator
```
