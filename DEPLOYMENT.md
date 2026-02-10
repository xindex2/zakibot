# Zakibot Deployment Guide

Complete guide for deploying, updating, backing up, and migrating the **Zakibot** platform (Express + Vite + SQLite + Python nanobot).

---

## Table of Contents

1. [Fresh Server Install](#1-fresh-server-install)
2. [Updating an Existing Server](#2-updating-an-existing-server)
3. [Database Backup](#3-database-backup)
4. [Database Restore / Server Migration](#4-database-restore--server-migration)
5. [Database Reset](#5-database-reset)
6. [Caddy (SSL / Reverse Proxy)](#6-caddy-ssl--reverse-proxy)
7. [Firewall & Ports](#7-firewall--ports)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Fresh Server Install

### 1.1 System Prerequisites (Ubuntu 22.04+)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential python3-pip python3-venv
```

### 1.2 Install Node.js (v20+)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 1.3 Clone the Repository

```bash
cd ~
git clone https://github.com/xindex2/zakibot.git
cd zakibot
```

### 1.4 Setup Nanobot (Python Backend)

```bash
python3 -m venv venv
source venv/bin/activate

# Install nanobot
pip install -e .

# Install browser automation (optional)
pip install playwright
playwright install-deps
playwright install chromium
```

### 1.5 Setup the Platform (Express + Vite)

```bash
cd ~/zakibot/platform
npm install

# Generate Prisma client & create the database
npx prisma generate
npx prisma db push
```

This creates the SQLite database at `platform/prisma/dev.db`.

### 1.6 Build the Frontend

```bash
npm run build
```

### 1.7 Configure Environment

Create `platform/.env` if needed:

```bash
cat > ~/zakibot/platform/.env << 'EOF'
DATABASE_URL="file:./dev.db"
JWT_SECRET="your_secret_key_change_this"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
EOF
```

> **Note**: The `DATABASE_URL` is already hardcoded in `prisma/schema.prisma`, but Prisma CLI may need the `.env` file.

### 1.8 Start with PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the platform (serves both API + built frontend)
cd ~/zakibot/platform
pm2 start "npx tsx server.ts" --name zakibot-platform

# Save PM2 config so it survives reboots
pm2 save
pm2 startup
```

### 1.9 Verify

```bash
pm2 status
pm2 logs zakibot-platform --lines 20
curl http://localhost:3000
```

---

## 2. Updating an Existing Server

Run this whenever you push new changes to GitHub:

```bash
cd ~/zakibot
git stash                 # stash any local changes
git pull origin main      # pull latest code

cd platform
npm install               # install any new dependencies
npx prisma generate       # regenerate Prisma client
npx prisma db push        # apply schema changes (safe, non-destructive)
npm run build             # rebuild frontend
pm2 restart zakibot-platform
```

### One-liner version:

```bash
cd ~/zakibot && git stash && git pull && cd platform && npm install && npx prisma generate && npx prisma db push && npm run build && pm2 restart zakibot-platform
```

---

## 3. Database Backup

The database is a single SQLite file: `~/zakibot/platform/prisma/dev.db`

### Manual Backup

```bash
# Create a timestamped backup
cp ~/zakibot/platform/prisma/dev.db ~/zakibot-db-backup-$(date +%Y%m%d-%H%M%S).db
```

### Download to Local Machine

From your local machine:

```bash
scp root@YOUR_SERVER_IP:~/zakibot/platform/prisma/dev.db ./zakibot-backup-$(date +%Y%m%d).db
```

### Automated Daily Backup (cron)

```bash
# Open crontab
crontab -e

# Add this line (backs up daily at 3 AM)
0 3 * * * cp ~/zakibot/platform/prisma/dev.db ~/backups/zakibot-$(date +\%Y\%m\%d).db
```

```bash
# Create the backups directory
mkdir -p ~/backups
```

### What's in the Database

The SQLite database contains **everything**:
- Users, passwords, roles
- Subscriptions & plans
- Bot configurations (API keys are encrypted)
- Orders & payment history
- Credit balances & transactions
- Webhook event logs
- System config (Creem API key, payment provider, etc.)

### What's NOT in the Database

- **Bot workspaces** — stored in `~/zakibot/platform/workspaces/`
- **User avatars** — stored in `~/zakibot/platform/uploads/`

To do a **full backup** including workspaces:

```bash
tar -czf ~/zakibot-full-backup-$(date +%Y%m%d).tar.gz \
  ~/zakibot/platform/prisma/dev.db \
  ~/zakibot/platform/workspaces/ \
  ~/zakibot/platform/uploads/
```

---

## 4. Database Restore / Server Migration

### Migrating to a New Server

**On the old server** — create a full backup:

```bash
tar -czf ~/zakibot-migration.tar.gz \
  ~/zakibot/platform/prisma/dev.db \
  ~/zakibot/platform/workspaces/ \
  ~/zakibot/platform/uploads/ \
  ~/zakibot/platform/.env
```

**Transfer to the new server:**

```bash
scp root@OLD_SERVER:~/zakibot-migration.tar.gz ~/
```

**On the new server** — do a fresh install first (steps 1.1–1.6), then restore:

```bash
# Stop the platform
pm2 stop zakibot-platform

# Extract the backup
cd /
tar -xzf ~/zakibot-migration.tar.gz

# Regenerate Prisma client for the restored DB
cd ~/zakibot/platform
npx prisma generate

# Restart
pm2 restart zakibot-platform
```

### Restoring Just the Database (Quickest Method)

If you just need to move the database to a new server (after doing a fresh install):

```bash
# From your local machine — download the DB from old server
scp root@OLD_SERVER_IP:~/zakibot/platform/prisma/dev.db ./backup.db

# Upload the DB to the new server
scp ./backup.db root@NEW_SERVER_IP:~/zakibot/platform/prisma/dev.db

# SSH into new server and restart
ssh root@NEW_SERVER_IP
pm2 restart zakibot-platform
```

Or restore from a local backup file:

```bash
pm2 stop zakibot-platform
cp ~/zakibot-backup-20260211.db ~/zakibot/platform/prisma/dev.db
pm2 restart zakibot-platform
```

---

## 5. Database Reset

> ⚠️ **WARNING**: This deletes ALL data (users, bots, subscriptions, orders, etc.)

### Full Reset (wipe everything)

```bash
pm2 stop zakibot-platform

# Delete the database
rm ~/zakibot/platform/prisma/dev.db

# Recreate from schema
cd ~/zakibot/platform
npx prisma db push

# Restart (seeds default Creem plans on first boot)
pm2 restart zakibot-platform
```

### Reset a Specific Table

Use the Prisma CLI to open the SQLite database:

```bash
cd ~/zakibot/platform
npx prisma studio
```

This opens a web UI at `http://localhost:5555` where you can view, edit, and delete records from any table.

Or use the SQLite CLI directly:

```bash
sqlite3 ~/zakibot/platform/prisma/dev.db

-- Examples:
DELETE FROM "Order";                    -- Clear all orders
DELETE FROM "WhopEvent";                -- Clear webhook logs
DELETE FROM "BotConfig" WHERE userId = 'xxx';  -- Delete a user's bots
UPDATE "Subscription" SET plan = 'Free', maxInstances = 1 WHERE userId = 'xxx';  -- Reset a user's plan

.quit
```

---

## 6. Caddy (SSL / Reverse Proxy)

For production with a domain and SSL:

### Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Configure Caddy

Edit `/etc/caddy/Caddyfile`:

```
yourdomain.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl restart caddy
```

Caddy handles SSL certificates automatically.

> **If using Cloudflare**: Set SSL mode to **Full (strict)** in the Cloudflare dashboard.

---

## 7. Firewall & Ports

```bash
# Allow required ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Direct access (optional, can remove after Caddy)
sudo ufw enable
sudo ufw status
```

---

## 8. Troubleshooting

### Platform won't start

```bash
pm2 logs zakibot-platform --lines 50
```

### Database errors after update

```bash
cd ~/zakibot/platform
npx prisma generate       # Regenerate client
npx prisma db push        # Sync schema
pm2 restart zakibot-platform
```

### "Cannot find module" errors

```bash
cd ~/zakibot/platform
rm -rf node_modules
npm install
npx prisma generate
npm run build
pm2 restart zakibot-platform
```

### Check if the server is running

```bash
pm2 status
curl -s http://localhost:3000 | head -5
```

### View all PM2 processes

```bash
pm2 list
pm2 monit        # Real-time monitoring
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start | `pm2 start "npx tsx server.ts" --name zakibot-platform` |
| Stop | `pm2 stop zakibot-platform` |
| Restart | `pm2 restart zakibot-platform` |
| Logs | `pm2 logs zakibot-platform` |
| Update | `cd ~/zakibot && git pull && cd platform && npm install && npx prisma generate && npx prisma db push && npm run build && pm2 restart zakibot-platform` |
| Backup DB | `cp ~/zakibot/platform/prisma/dev.db ~/backups/zakibot-$(date +%Y%m%d).db` |
| Reset DB | `rm ~/zakibot/platform/prisma/dev.db && cd ~/zakibot/platform && npx prisma db push` |
| Browse DB | `npx prisma studio` |
