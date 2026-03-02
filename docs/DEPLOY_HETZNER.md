# Deploy TierListPlus on Hetzner

This setup runs:
- `app` (Next.js + Prisma) on internal Docker network only
- `db` (PostgreSQL)
- `caddy` (public HTTPS on ports `80/443`)

Deploy flow runs database migrations once per release before starting `app`.

## One-time server setup

1. Create a Hetzner Cloud server (`hel1`, Ubuntu 24.04, `CX23` is enough).
2. Add your SSH key and connect as `root` for the initial bootstrap only.
3. Install Docker:

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl openssl rsync ufw fail2ban unattended-upgrades
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

Lock down the file:

```bash
chmod 600 /opt/tierlistplus/.env.production
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

8. Harden SSH before closing your first root session:

```bash
cat >/etc/ssh/sshd_config.d/60-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PermitTunnel no
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
EOF
sshd -t
systemctl reload ssh
ssh -o PreferredAuthentications=publickey root@<server-ip> 'echo ssh-ok'
```

9. Create a dedicated admin user, copy your SSH key, and disable root SSH after verifying the new login:

```bash
adduser --disabled-password --gecos '' tieradmin
usermod -aG sudo tieradmin
install -d -m 700 -o tieradmin -g tieradmin /home/tieradmin/.ssh
install -m 600 -o tieradmin -g tieradmin /root/.ssh/authorized_keys /home/tieradmin/.ssh/authorized_keys
cat >/etc/sudoers.d/90-tieradmin <<'EOF'
tieradmin ALL=(ALL) NOPASSWD:ALL
EOF
chmod 440 /etc/sudoers.d/90-tieradmin
visudo -cf /etc/sudoers.d/90-tieradmin
ssh -o PreferredAuthentications=publickey tieradmin@<server-ip> 'whoami && sudo -n whoami'
sed -i 's/^PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config.d/60-hardening.conf
sshd -t
systemctl reload ssh
```

This project currently uses passwordless `sudo` for `tieradmin` so the deploy and monitoring scripts can run non-interactively. Treat that as an operational convenience, not a final hardening state.

10. Enable `fail2ban` for SSH:

```bash
cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
fail2ban-client status sshd
```

## Deploy from your local machine

Run this from repo root:

```bash
./scripts/deploy-hetzner.sh
```

Default target host is `tieradmin@46.62.140.254`. You can override:

```bash
./scripts/deploy-hetzner.sh tieradmin@<new-ip> /opt/tierlistplus
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
ssh tieradmin@46.62.140.254 "sudo docker compose --profile with-domain --env-file /opt/tierlistplus/.env.production -f /opt/tierlistplus/docker-compose.prod.yml ps"
```

## Logs

```bash
ssh tieradmin@46.62.140.254 "sudo docker compose --profile with-domain --env-file /opt/tierlistplus/.env.production -f /opt/tierlistplus/docker-compose.prod.yml logs -f app"
ssh tieradmin@46.62.140.254 "sudo docker compose --profile with-domain --env-file /opt/tierlistplus/.env.production -f /opt/tierlistplus/docker-compose.prod.yml logs -f caddy"
```

## Monitoring

Install the built-in healthcheck timer from your local machine:

```bash
./scripts/install-monitoring-hetzner.sh
```

What it checks every 5 minutes:
- public HTTPS response from `https://tierlistplus.com`
- `app`, `db`, and `caddy` container state
- root filesystem usage stays below `85%`

Inspect the latest result:

```bash
ssh tieradmin@46.62.140.254 "sudo systemctl --no-pager --full status tierlistplus-healthcheck.service"
ssh tieradmin@46.62.140.254 "sudo journalctl -u tierlistplus-healthcheck.service -n 50 --no-pager"
ssh tieradmin@46.62.140.254 "sudo journalctl -u tierlistplus-healthcheck.service -f"
ssh tieradmin@46.62.140.254 "sudo systemctl list-timers tierlistplus-healthcheck.timer --all"
```

## Backup database

```bash
ssh tieradmin@46.62.140.254 "sudo sh -lc 'cd /opt/tierlistplus && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db sh -lc '\\''pg_dump -U \"\$POSTGRES_USER\" \"\$POSTGRES_DB\"'\\'' > /root/tierlistplus-\$(date +%F).sql'"
```

## Future Roadmap

Planned follow-up work for the production environment:
- add automated off-box backups to the future Ubuntu mini PC for PostgreSQL dumps and uploaded files
- add scheduled restore drills so backups are verified instead of assumed
- connect the VPS, admin laptop, and mini PC over a private network such as Tailscale or WireGuard
- restrict Hetzner Cloud SSH access to trusted sources after the private admin path is in place
- replace blanket `NOPASSWD:ALL` with command-scoped sudoers entries or a root-owned deploy wrapper
- extend container hardening further where practical (for example, evaluate additional PostgreSQL restrictions and Docker daemon defaults)
- replace the `curl | sh` Docker bootstrap step with a pinned package-repository install path
- expand monitoring with external uptime alerts, disk-pressure alerts, and certificate expiry alerts
