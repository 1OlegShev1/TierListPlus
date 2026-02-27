# Deploy TierListPlus on Hetzner

This setup runs:
- `app` (Next.js + Prisma) on internal Docker network only
- `db` (PostgreSQL)
- `caddy` (public HTTPS on ports `80/443`)

Deploy flow runs database migrations once per release before starting `app`.

## One-time server setup

1. Create a Hetzner Cloud server (`hel1`, Ubuntu 24.04, `CX23` is enough).
2. Add your SSH key and connect as root.
3. Install Docker:

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl git openssl rsync
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

4. Copy repo to server:

```bash
mkdir -p /opt/tierlistplus
```

5. Create `/opt/tierlistplus/.env.production`:

```dotenv
APP_DOMAIN=tierlistplus.com
POSTGRES_DB=tierlistplus
POSTGRES_USER=tierlistplus
POSTGRES_PASSWORD=<32-char-random>
SESSION_SECRET=<64-char-random>
```

Generate secrets:

```bash
openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32; echo
openssl rand -base64 96 | tr -dc 'A-Za-z0-9' | head -c 64; echo
```

6. Cloudflare DNS:
- `A` record `@` -> server IPv4
- Proxy status: `DNS only` for initial certificate issuance

7. Firewall on server:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status numbered
```

## Deploy from your local machine

Run this from repo root:

```bash
./scripts/deploy-hetzner.sh
```

Default target host is `root@46.62.140.254`. You can override:

```bash
./scripts/deploy-hetzner.sh root@<new-ip> /opt/tierlistplus
```

What script does:
1. `rsync` project to server (keeps remote `.env.production`)
2. builds `app` + `migrate` images
3. starts `db` and waits for healthcheck
4. runs one-off Prisma migrations (`migrate` service)
5. starts `app` and `caddy`
6. prints service status

## Verify

```bash
curl -I https://tierlistplus.com
ssh root@46.62.140.254 "docker compose --profile with-domain --env-file /opt/tierlistplus/.env.production -f /opt/tierlistplus/docker-compose.prod.yml ps"
```

## Logs

```bash
ssh root@46.62.140.254 "docker compose --profile with-domain --env-file /opt/tierlistplus/.env.production -f /opt/tierlistplus/docker-compose.prod.yml logs -f app"
ssh root@46.62.140.254 "docker compose --profile with-domain --env-file /opt/tierlistplus/.env.production -f /opt/tierlistplus/docker-compose.prod.yml logs -f caddy"
```

## Backup database

```bash
ssh root@46.62.140.254 "cd /opt/tierlistplus && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db sh -lc 'pg_dump -U \"\$POSTGRES_USER\" \"\$POSTGRES_DB\"' > /root/tierlistplus-\$(date +%F).sql"
```
