# Production Deployment Setup Guide

Complete step-by-step guide for deploying Bingoscape Next to a Debian server using GitHub Actions CI/CD.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Server Setup](#server-setup)
4. [GitHub Configuration](#github-configuration)
5. [OAuth Provider Setup](#oauth-provider-setup)
6. [First Deployment](#first-deployment)
7. [SSL Certificate Setup](#ssl-certificate-setup)
8. [Database Management](#database-management)
9. [Maintenance](#maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub Actions                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   CI/CD      │→ │    Build     │→ │     GHCR     │     │
│  │  Pipeline    │  │    & Push    │  │   Registry   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓ Deploy Workflow
┌─────────────────────────────────────────────────────────────┐
│                      Your Debian Server                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                     Docker Host                      │  │
│  │  ┌────────┐    ┌────────┐    ┌──────────┐          │  │
│  │              ┌────────┐    ┌──────────┐          │  │
│  │              │  App   │→   │ Postgres │          │  │
│  │              │ :3000  │    │  :5432   │          │  │
│  │              └────────┘    └──────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
│       ↑ reverse proxy (nginx + certbot on the host)         │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Flow

1. **Code Push** → GitHub automatically builds and pushes the app and migrator images to GHCR (`:main`, `:sha-<short>`)
2. **Manual Deploy** → You run the Deploy workflow with an image tag; GitHub Actions deploys it to your server via SSH
3. **Automatic Setup** → Server pulls the images, generates config, backs up the database, runs migrations, then starts the new app
4. **Health Check** → Verifies `/api/uptime` answers; on failure the previous version is restored automatically

See [GITHUB-ACTIONS.md](./GITHUB-ACTIONS.md) for details.

---

## Prerequisites

### What You'll Need

- **Debian Server** (Ubuntu 20.04+, Debian 11+, or similar)
  - Minimum: 2GB RAM, 2 CPU cores, 20GB disk
  - Recommended: 4GB RAM, 4 CPU cores, 40GB disk
  - Root or sudo access

- **Domain Name** pointing to your server
  - A record for your domain (e.g., `bingoscape.org`)
  - Optional: CNAME for www subdomain

- **GitHub Account** with repository access

- **Discord Application** (for user authentication)
  - Get from [Discord Developer Portal](https://discord.com/developers/applications)

- **Local Machine** with:
  - SSH client
  - Git
  - Text editor

---

## Server Setup

### Step 1: Connect to Your Server

```bash
# SSH into your server
ssh root@your-server-ip
# or
ssh your-user@your-server-ip
```

### Step 2: Update System

```bash
# Update package lists
sudo apt update

# Upgrade installed packages
sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git ufw
```

### Step 3: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group (optional, allows running docker without sudo)
sudo usermod -aG docker $USER

# Apply group changes (or logout/login)
newgrp docker

# Verify Docker installation
docker --version
docker compose version
```

**Expected Output:**

```
Docker version 27.x.x
Docker Compose version v2.x.x
```

### Step 4: Configure Firewall

```bash
# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status
```

**Expected Output:**

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                     ALLOW       Anywhere
```

### Step 5: Create Deployment User (Recommended)

For better security, create a dedicated deployment user.

**Quick Setup:**

```bash
# Create deployment user
sudo adduser deploy
# Follow prompts to set password

# Add to docker group
sudo usermod -aG docker deploy

# Grant sudo privileges (optional)
sudo usermod -aG sudo deploy
```

**For detailed user setup with SSH configuration, permissions, and best practices, see:**
**[DEBIAN-USER-SETUP.md](./DEBIAN-USER-SETUP.md) - Complete Debian User Setup Guide**

### Step 6: Set Up SSH Key Authentication

Generate SSH keys for GitHub Actions to connect to your server:

```bash
# Switch to deployment user (if created)
su - deploy
# or stay as current user

# Generate SSH key pair
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions

# View the public key (you'll add this to authorized_keys)
cat ~/.ssh/github_actions.pub

# Add public key to authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Set proper permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# View the private key (you'll add this to GitHub Secrets)
cat ~/.ssh/github_actions
```

**Important:** Copy the **private key** (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`) for later use in GitHub Secrets.

### Step 7: Verify SSH Access

From your local machine, test SSH access:

```bash
# Test SSH connection (from your local machine)
ssh -i path/to/github_actions deploy@your-server-ip
```

If successful, you should be logged into your server.

---

## GitHub Configuration

### Step 1: Set Up GitHub Container Registry

GHCR is automatically available for all GitHub repositories. No setup needed!

Images will be published to:

```
ghcr.io/YOUR-USERNAME/YOUR-REPO
```

### Step 2: Configure Repository Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add the following secrets:

#### Required Secrets

| Secret Name             | Description              | How to Get                                  |
| ----------------------- | ------------------------ | ------------------------------------------- |
| `SSH_HOST`              | Your server IP or domain | `your-server.com` or `192.168.1.100`        |
| `SSH_USER`              | SSH username             | `deploy` (or your username)                 |
| `SSH_PORT`              | SSH port                 | `22` (default)                              |
| `SSH_PRIVATE_KEY`       | Private SSH key          | Copy from `~/.ssh/github_actions` on server |
| `DB_PASSWORD`           | PostgreSQL password      | Generate: `openssl rand -base64 24`         |
| `DB_NAME`               | Database name            | `bingoscapenext`                            |
| `DB_USER`               | Database username        | `bingoscapenext`                            |
| `DB_HOST`               | Database host (Docker)   | `bingoscapedb`                              |
| `DB_PORT`               | Database port            | `5432`                                      |
| `NEXTAUTH_SECRET`       | NextAuth encryption key  | Generate: `openssl rand -base64 32`         |
| `NEXTAUTH_URL`          | Your production URL      | `https://your-domain.com`                   |
| `DISCORD_CLIENT_ID`     | Discord OAuth Client ID  | [See OAuth Setup](#oauth-provider-setup)    |
| `DISCORD_CLIENT_SECRET` | Discord OAuth Secret     | [See OAuth Setup](#oauth-provider-setup)    |
| `SUPER_ADMIN_EMAILS`    | Admin email addresses    | `admin@example.com,admin2@example.com`      |

#### Optional Secrets

| Secret Name            | Description  | Required For            |
| ---------------------- | ------------ | ----------------------- |
| `GITHUB_CLIENT_ID`     | GitHub OAuth | GitHub login (optional) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth | GitHub login (optional) |
| `GOOGLE_CLIENT_ID`     | Google OAuth | Google login (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Google login (optional) |

### Step 3: Generate Required Secrets

Run these commands on your **local machine** or server:

```bash
# Generate NEXTAUTH_SECRET (32 bytes, base64)
openssl rand -base64 32

# Generate DB_PASSWORD (24 bytes, base64)
openssl rand -base64 24

# Output: Copy these values to GitHub Secrets
```

### Step 4: Enable GitHub Actions Permissions

1. Go to **Settings** → **Actions** → **General**
2. Under "Workflow permissions":
   - Select **Read and write permissions**
   - Check **Allow GitHub Actions to create and approve pull requests**
3. Click **Save**

### Step 5: Verify Secrets Configuration

Use the checklist in [GITHUB-SECRETS.md](./GITHUB-SECRETS.md) to ensure all required secrets are configured.

---

## OAuth Provider Setup

### Discord OAuth (Required)

Discord authentication is required for user login.

#### Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Enter name: `Bingoscape Next`
4. Click **Create**

#### Step 2: Configure OAuth2

1. Go to **OAuth2** → **General**
2. Click **Add Redirect**
3. Enter redirect URL:
   ```
   https://your-domain.com/api/auth/callback/discord
   ```
4. Click **Save Changes**

#### Step 3: Get Client Credentials

1. Copy **Client ID**
2. Click **Reset Secret** → Copy **Client Secret**
3. Add both to GitHub Secrets:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`

### GitHub OAuth (Optional)

#### Step 1: Register OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: `Bingoscape Next`
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-domain.com/api/auth/callback/github`
4. Click **Register application**

#### Step 2: Get Client Credentials

1. Copy **Client ID**
2. Click **Generate a new client secret** → Copy secret
3. Add both to GitHub Secrets:
   - `GH_OAUTH_CLIENT_ID` (GitHub reserves the `GITHUB_` prefix for secret names; the deploy writes it to `.env` as `GITHUB_CLIENT_ID`)
   - `GH_OAUTH_CLIENT_SECRET`

### Google OAuth (Optional)

#### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API** or **Google Identity Services**

#### Step 2: Create OAuth Credentials

1. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
2. Select **Application type**: Web application
3. Add **Authorized redirect URI**:
   ```
   https://your-domain.com/api/auth/callback/google
   ```
4. Click **Create**

#### Step 3: Get Client Credentials

1. Copy **Client ID**
2. Copy **Client Secret**
3. Add both to GitHub Secrets:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

---

## First Deployment

### Step 1: Verify DNS Configuration

Ensure your domain points to your server:

```bash
# From your local machine
dig +short your-domain.com

# Should return your server's IP address
```

Or use online tools:

- [DNS Checker](https://dnschecker.org/)
- [What's My DNS](https://www.whatsmydns.net/)

### Step 2: Trigger Initial Build

Push to the main branch or manually trigger the CI/CD workflow:

#### Option A: Push to Main Branch

```bash
# On your local machine
git add .
git commit -m "Initial production setup"
git push origin main
```

GitHub Actions will automatically:

1. Run linter, type check and tests
2. Build the app and migrator Docker images
3. Push to GHCR as `ghcr.io/YOUR-USERNAME/YOUR-REPO:main` and `...:sha-<short>` (plus `-migrator` for the migration image)

#### Option B: Manual Workflow Trigger

1. Go to **Actions** tab in GitHub
2. Select **CI/CD**
3. Click **Run workflow**
4. Select branch: `main`
5. Click **Run workflow**

**Monitor the build:**

- Go to **Actions** tab
- Click on the running workflow
- Wait for all jobs to complete (green checkmark)

### Step 3: Deploy to Server

Once the image is built and pushed to GHCR:

1. Go to **Actions** tab in GitHub
2. Select **Deploy to Production** workflow
3. Click **Run workflow**
4. Configure deployment:
   - **Image tag**: `main` (or `sha-<short>` / a release tag like `v1.0.0`)
5. Click **Run workflow**

**The deployment will:**

- Create application directory on server
- Copy docker-compose.yml and scripts
- Generate .env file from GitHub Secrets
- Pull the app and migrator images from GHCR
- Back up the database (skipped on the very first deploy)
- Start PostgreSQL and run the database migrations (this initializes the schema on the first deploy)
- Start the new app and check `/api/uptime`
- Roll back to the previous version automatically if the new one does not become healthy

### Step 4: Monitor Deployment

Watch the deployment logs in real-time:

1. Click on the running **Deploy to Production** workflow
2. Click on the **Deploy** job
3. Watch each step complete

**Look for these success indicators:**

- `Pulling images` finishes without errors
- `Running migrations` prints the migrator output
- `Application is healthy`
- `Deploy of <tag> succeeded`

### Step 5: Database Migrations

Migrations run automatically during every deploy, before the new app starts, so the first deploy already initializes the database. The separate **Database Migration** workflow is only needed to run migrations without deploying (type `MIGRATE` to confirm and pick an image tag).

### Step 6: Verify Deployment

#### Check via SSH

```bash
# SSH into your server
ssh deploy@your-server-ip

# Navigate to application directory
cd ~/bingoscape

# Check container status
docker compose ps

# Expected output:
# NAME                   STATUS              PORTS
# bingoscape-app         Up (healthy)        127.0.0.1:3000->3000/tcp
# bingoscape-postgres    Up (healthy)        127.0.0.1:5432->5432/tcp

# Check application logs
docker compose logs app --tail 50
```

#### Check via Browser

```
https://your-domain.com
```

You should see the application login page.

**Note:** If you see "502 Bad Gateway", check that the app container is healthy and listening on `127.0.0.1:3000`.

---

## SSL Certificate Setup

TLS is terminated by nginx running on the host (not in Docker), which proxies to the app on `127.0.0.1:3000`. Certificates are issued and renewed by the host's `certbot`.

```bash
# Install nginx and certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# Issue a certificate and let certbot configure nginx
sudo certbot --nginx -d your-domain.com

# Check that automatic renewal is scheduled
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

In the nginx `server` block, proxy to the app:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    client_max_body_size 25m;
}
```

Then visit `https://your-domain.com` and confirm the certificate is valid.

### Live team draft (Server-Sent Events)

The draft room (`/events/[id]/draft`) receives picks over a Server-Sent Events stream, `GET /api/events/<event-id>/draft/stream`. A proxy that buffers responses or closes idle connections breaks it (the page then falls back to polling every 3 s and shows "Polling"). Add a dedicated location **above** `location /`:

```nginx
location ~ ^/api/events/[^/]+/draft/stream$ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
}
```

The stream route also sends `X-Accel-Buffering: no` and `Cache-Control: no-cache, no-transform`, and the server sends a `:` heartbeat every 15 s. Each stream is closed by the server after about 5 minutes (the browser reconnects and is authorized again) and on `SIGTERM`, so a deploy only costs a reconnect: the client resumes from the last event it saw (`Last-Event-ID`).

**Verify through the proxy** (use a session cookie of an Event member, copied from the browser; `since=0` replays the log first):

```bash
curl -N -H "Cookie: <session cookie>"   "https://your-domain.com/api/events/<event-id>/draft/stream?since=0"
```

You should see `retry: 2000`, the replayed `event: draft` frames immediately and a `: heartbeat` line every 15 s, each as it happens. If everything only appears in a burst after a long wait, something still buffers: check the location above matched (`sudo nginx -T | grep -n draft/stream`). If compression is the culprit, set `compress: false` in `next.config.mjs` (the route sends `no-transform`, which Next's compression honours, so this should not be needed); nginx can compress instead.

**Database connections.** The stream uses one extra, permanent connection per app process for `LISTEN draft_events` (postgres-js `sql.listen()`; it reconnects by itself). Check that `max_connections` and the app's pool leave room for it. `LISTEN` needs a session: it does **not** work through PgBouncer in transaction pooling mode, so point `DATABASE_URL` at Postgres directly (or at a session-mode pooler). The stream and the draft's `pg_notify` need a long-lived Node process, which the Docker deployment is (not serverless).

---

## Database Management

### Backup Database

```bash
# SSH into server
ssh deploy@your-server-ip
cd ~/bingoscape

# Create backup
docker compose exec -T postgres pg_dump -U bingoscapenext bingoscapenext > backup_$(date +%Y%m%d_%H%M%S).sql

# Compress backup
gzip backup_*.sql

# Download backup to local machine (from local machine)
scp deploy@your-server-ip:~/bingoscape/backup_*.sql.gz ./
```

### Restore Database

```bash
# Upload backup to server (from local machine)
scp backup_20250111_120000.sql.gz deploy@your-server-ip:~/bingoscape/

# SSH into server
ssh deploy@your-server-ip
cd ~/bingoscape

# Decompress backup
gunzip backup_20250111_120000.sql.gz

# Restore database
docker compose exec -T postgres psql -U bingoscapenext bingoscapenext < backup_20250111_120000.sql
```

### Run Migrations (After Code Updates)

Deploys run migrations automatically, before the new app starts. To run migrations on their own:

1. Go to GitHub **Actions** tab
2. Select **Database Migration** workflow
3. Click **Run workflow**
4. Enter `MIGRATE` to confirm
5. Monitor logs

**Or manually via SSH:**

```bash
# SSH into server
ssh deploy@your-server-ip
cd ~/bingoscape

# Run migrations (uses the migrator image of the tag in .env)
docker compose run --rm migrate
```

---

## Maintenance

### View Application Logs

```bash
# SSH into server
ssh deploy@your-server-ip
cd ~/bingoscape

# View app logs (live)
docker compose logs -f app

# View host nginx logs
sudo journalctl -u nginx -f

# View last 100 lines
docker compose logs app --tail 100

# View logs from last hour
docker compose logs app --since 1h
```

### Restart Services

```bash
# Restart specific service
docker compose restart app
docker compose restart postgres

# Restart all services
docker compose restart

# Stop all services
docker compose down

# Start all services
docker compose up -d
```

### Update Application

#### Deploy New Version

1. Push changes to main branch (triggers automatic build)
2. Go to **Actions** → **Deploy to Production**
3. Select image tag (e.g., `main` for latest, or `v1.2.3` for specific version)
4. Run workflow

#### Deploy Specific Version

```bash
# In GitHub Actions Deploy workflow
Image tag: v1.2.3  # Or specific commit SHA like: sha-abc1234
```

#### Rollback to Previous Version

A failed deploy rolls back to the previous version automatically (the app only; migrations are not reverted). To go back to an older version later, deploy a previous image tag:

```bash
# In GitHub Actions Deploy workflow
Image tag: v1.2.2  # Previous working version
```

Or use commit SHA:

```bash
Image tag: sha-a1b2c3d  # Specific commit
```

### Monitor System Resources

```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check running containers
docker compose ps

# Check container resource usage
docker stats
```

### Clean Up Docker Resources

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Clean everything (except volumes)
docker system prune -a
```

---

## Troubleshooting

### Deployment Fails

#### Error: SSH Connection Failed

**Problem:** GitHub Actions can't connect to your server.

**Solution:**

1. Verify `SSH_HOST`, `SSH_USER`, `SSH_PORT` in GitHub Secrets
2. Check firewall allows port 22:
   ```bash
   sudo ufw status | grep 22
   ```
3. Test SSH from local machine:
   ```bash
   ssh -i github_actions deploy@your-server-ip
   ```
4. Verify private key in GitHub Secrets is complete (includes header/footer)

#### Error: Docker Login Failed

**Problem:** Can't pull image from GHCR.

**Solution:**

1. Verify `GITHUB_TOKEN` has correct permissions:
   - Go to **Settings** → **Actions** → **General**
   - Select "Read and write permissions"
2. Check if image exists:
   - Go to repository **Packages** tab
   - Verify image is published

#### Error: Health Check Failed

**Problem:** Application doesn't respond after deployment.

**Solution:**

```bash
# SSH into server
ssh deploy@your-server-ip
cd ~/bingoscape

# Check container status
docker compose ps

# Check application logs
docker compose logs app --tail 100

# Common issues:
# 1. Database connection failed → check .env file
# 2. Migration failed → the deploy stops before the app is replaced; check the migrator output
# 3. Port conflict → check if port 3000 is available
```

### Application Not Accessible

#### Error: 502 Bad Gateway

**Problem:** Nginx can't reach the application.

**Solution:**

```bash
# Check if app container is running
docker compose ps app

# Check app logs for errors
docker compose logs app --tail 50

# Restart app
docker compose restart app

# Check host nginx configuration
sudo nginx -t
```

#### Error: Connection Refused

**Problem:** Host nginx isn't running or ports aren't open.

**Solution:**

```bash
# Check nginx status
sudo systemctl status nginx

# Check if ports are open
sudo netstat -tlnp | grep -E '(80|443)'

# Check firewall
sudo ufw status

# Restart nginx
sudo systemctl restart nginx
```

### Database Issues

#### Error: Database Connection Failed

**Problem:** Application can't connect to PostgreSQL.

**Solution:**

```bash
# Check postgres status
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Verify .env file exists
cat ~/bingoscape/.env | grep DB_

# Test database connection
docker compose exec postgres psql -U bingoscapenext -d bingoscapenext -c "SELECT 1;"
```

#### Error: Migration Failed

**Problem:** Database migrations won't run.

**Solution:**

```bash
# Check postgres is running
docker compose ps postgres

# Check migration logs
docker compose logs app | grep -i migration

# Try running migration manually
docker compose run --rm app npm run db:migrate

# If all else fails, restore from backup
```

### SSL Certificate Issues

#### Error: Certificate Expired

**Problem:** The certificate was not renewed.

**Solution:**

```bash
# Check the renewal timer and renew manually
systemctl list-timers | grep certbot
sudo certbot renew
sudo systemctl reload nginx
```

### Getting Help

If you encounter issues not covered here:

1. **Check Logs:**
   - GitHub Actions workflow logs
   - Application logs: `docker compose logs app`
   - Nginx logs: `sudo journalctl -u nginx`

2. **Review Documentation:**
   - [GitHub Actions Documentation](./GITHUB-ACTIONS.md)
   - [GitHub Secrets Configuration](./GITHUB-SECRETS.md)

3. **Common Commands:**

   ```bash
   # View all container logs
   docker compose logs

   # Check container health
   docker compose ps

   # Restart everything
   docker compose restart

   # View system resources
   docker stats
   ```

---

## Quick Reference

### Essential Commands

```bash
# SSH into server
ssh deploy@your-server-ip

# Navigate to app directory
cd ~/bingoscape

# View container status
docker compose ps

# View logs
docker compose logs app -f

# Restart services
docker compose restart

# Pull latest image
docker compose pull

# Update and restart
docker compose pull && docker compose up -d

# Backup database
docker compose exec -T postgres pg_dump -U bingoscapenext bingoscapenext > backup_$(date +%Y%m%d).sql
```

### GitHub Actions Workflows

```bash
# CI/CD (lint, typecheck, tests, build and push images)
# Trigger: Automatic on pull requests, pushes to main and v*.*.* tags
# Manual: Actions → CI/CD → Run workflow

# Deploy to Production
# Trigger: Manual only
# Actions → Deploy to Production → Run workflow → Enter image tag (main, sha-<short>, v1.2.3)

# Database Migration
# Trigger: Manual only
# Actions → Database Migration → Run workflow → Type "MIGRATE" to confirm
```

### File Locations on Server

```
~/bingoscape/                       # Application directory
├── docker-compose.yml             # Container orchestration
├── .env                           # Environment variables
└── uploads/                       # User uploaded files
```

### Useful URLs

- **Application:** `https://your-domain.com`
- **Health Check:** `https://your-domain.com/api/uptime`
- **GitHub Packages:** `https://github.com/YOUR-USERNAME/YOUR-REPO/packages`
- **Discord Developer:** `https://discord.com/developers/applications`

---

## Next Steps

After completing this setup:

1. **Test Authentication:**
   - Visit your site
   - Click "Sign in with Discord"
   - Verify login works

2. **Create First Admin:**
   - Login with email matching `SUPER_ADMIN_EMAILS`
   - Verify admin access

3. **Configure Application:**
   - Create bingo events
   - Set up teams
   - Configure RuneLite integration

4. **Set Up Monitoring:**
   - Set up uptime monitoring
   - Configure backup schedule

5. **Review Security:**
   - Rotate SSH keys regularly
   - Keep secrets updated
   - Monitor access logs
   - Keep Docker images updated

---

## Additional Resources

- [Debian User Setup Guide](./DEBIAN-USER-SETUP.md) - Complete Linux user configuration for hosting
- [GitHub Actions Documentation](./GITHUB-ACTIONS.md) - Detailed CI/CD workflow reference
- [GitHub Secrets Configuration](./GITHUB-SECRETS.md) - Complete secrets setup guide
- [Docker Documentation](https://docs.docker.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

**Congratulations! Your Bingoscape Next application is now deployed and running in production.**

For ongoing maintenance, refer to the [Maintenance](#maintenance) section and keep your GitHub Secrets up to date.
