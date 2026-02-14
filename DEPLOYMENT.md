# Zakibot Deployment Guide

Complete guide for deploying, updating, backing up, and migrating the **Zakibot** platform (Express + Vite + SQLite + Python nanobot).

---

## Table of Contents

1. [Fresh Server Install](#1-fresh-server-install)
2. [Updating an Existing Server](#2-updating-an-existing-server)
3. [Database Backup](#3-database-backup)
4. [Database Restore / Server Migration](#4-database-restore--server-migration)
5. [Database Reset](#5-database-reset)
6. [Nginx (Reverse Proxy)](#6-nginx-reverse-proxy)
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
curl http://localhost:3001
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

> **Scenario:** You have Zakibot running on `OLD SERVER (1.2.3.4)` and you want to move everything to `NEW SERVER (5.6.7.8)`. Both are cloud VPS machines.

### Step 1: Set up Zakibot on the NEW server first

SSH into your **new server** and do a fresh install (follow Sections 1.1 → 1.8 above). At this point the new server has Zakibot running but with an **empty database** — no users, no bots, no data.

```bash
ssh root@5.6.7.8
# ... follow the fresh install steps ...
```

### Step 2: Stop the app on BOTH servers

**On the OLD server:**
```bash
ssh root@1.2.3.4
pm2 stop zakibot-platform
```

**On the NEW server:**
```bash
ssh root@5.6.7.8
pm2 stop zakibot-platform
```

### Step 3: Copy the database from OLD → NEW

You do this **from the OLD server**. This one command sends the database file directly to the new server:

```bash
# Run this ON THE OLD SERVER
scp ~/zakibot/platform/prisma/dev.db root@5.6.7.8:~/zakibot/platform/prisma/dev.db
```

> **What this does:** It copies the file `dev.db` (which contains all your users, bots, subscriptions, orders, credits, settings) from the old server and overwrites the empty one on the new server.

### Step 4: (Optional) Copy workspaces and uploads too

If your bots have workspace files (documents, screenshots, etc.) and user avatars:

```bash
# Run this ON THE OLD SERVER
scp -r ~/zakibot/platform/workspaces/ root@5.6.7.8:~/zakibot/platform/workspaces/
scp -r ~/zakibot/platform/uploads/ root@5.6.7.8:~/zakibot/platform/uploads/
```

### Step 5: Start the app on the NEW server

```bash
ssh root@5.6.7.8
cd ~/zakibot/platform
npx prisma generate    # make sure Prisma knows about the database
pm2 restart zakibot-platform
```

### Step 6: Verify it works

```bash
pm2 logs zakibot-platform --lines 10
curl http://localhost:3001
```

Open `http://5.6.7.8:3001` in your browser — you should see all your old users, bots, and data.

### Step 7: Point your domain to the new server

If you have a domain (e.g. `openclaw-host.com`), update the DNS A record to point to `5.6.7.8` instead of `1.2.3.4`.

---

### Quick: Just restoring a backup file

If you already have a backup `.db` file and just want to restore it:

```bash
pm2 stop zakibot-platform
cp /path/to/your/backup.db ~/zakibot/platform/prisma/dev.db
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

## 6. Nginx (Reverse Proxy)

For production with a domain behind Cloudflare:

### Install Nginx

```bash
sudo apt install -y nginx
```

### Configure Nginx

Create `/etc/nginx/sites-enabled/default`:

```bash
cat > /etc/nginx/sites-enabled/default << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

Replace `yourdomain.com` with your actual domain.

```bash
nginx -t && sudo systemctl restart nginx
```

> **If using Cloudflare**: Set SSL mode to **Full** in the Cloudflare dashboard. Cloudflare handles SSL termination.

---

## 7. Firewall & Ports

```bash
# Allow required ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3001/tcp  # Direct access (optional, can remove after Nginx)
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
curl -s http://localhost:3001 | head -5
```

### Nginx won't start

```bash
# Check config validity
nginx -t

# If sites-enabled/default is missing:
mkdir -p /etc/nginx/sites-enabled
# Then recreate the config (see Section 6)

# Restart
systemctl restart nginx
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
| Start | `cd ~/zakibot/platform && pm2 start "npx tsx server.ts" --name zakibot-platform` |
| Stop | `pm2 stop zakibot-platform` |
| Restart | `pm2 restart zakibot-platform` |
| Logs | `pm2 logs zakibot-platform` |
| Update | `cd ~/zakibot && git pull && cd platform && npm install && npx prisma generate && npx prisma db push && npm run build && pm2 restart zakibot-platform` |
| Backup DB | `cp ~/zakibot/platform/prisma/dev.db ~/backups/zakibot-$(date +%Y%m%d).db` |
| Reset DB | `rm ~/zakibot/platform/prisma/dev.db && cd ~/zakibot/platform && npx prisma db push` |
| Browse DB | `npx prisma studio` |
