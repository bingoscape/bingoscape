# GitHub Actions - CI/CD Documentation

This document describes the GitHub Actions workflows for automated testing, building, and deploying the Bingoscape Next application.

## Table of Contents
- [Overview](#overview)
- [Workflows](#workflows)
  - [CI/CD Pipeline](#cicd-pipeline)
  - [Database Migrations](#database-migrations)
  - [Deploy to Production](#deploy-to-production)
- [Setup Requirements](#setup-requirements)
- [Usage Guide](#usage-guide)
- [Troubleshooting](#troubleshooting)

## Overview

The project uses GitHub Actions for continuous integration and deployment. All workflows are stored in `.github/workflows/`.

### Architecture

```
Push to main → CI/CD Workflow → Build & Push to GHCR → Manual Deploy
                     ↓
                Lint & Test
                     ↓
              Build Docker Image
                     ↓
           Push to GitHub Container Registry
```

## Workflows

### CI/CD Pipeline

**File:** `.github/workflows/ci-cd.yml`

Automatically builds and pushes Docker images to GitHub Container Registry (GHCR).

#### Triggers

- **Push to `main` branch**: Automatically builds and pushes image
- **Tags matching `v*.*.*`**: Builds release versions with semantic versioning
- **Pull Requests to `main` or `develop`**: Runs lint/test only (no push)
- **Manual trigger**: Can be run manually via GitHub Actions UI

#### Jobs

##### 1. Lint and Test (`lint-and-test`)
- Runs ESLint on codebase
- Performs TypeScript type checking
- Optional: Runs unit tests (uncomment when available)

##### 2. Build and Push (`build-and-push`)
- Sets up Docker Buildx for multi-platform builds
- Logs into GHCR using `GITHUB_TOKEN`
- Extracts metadata for Docker tags and labels
- Builds Docker image with layer caching
- Pushes image to GHCR (skipped for PRs)
- Generates build attestation for security

##### 3. Build Summary (`build-summary`)
- Posts summary to GitHub Actions run page
- Shows image details and pull command

#### Image Tags

Images are automatically tagged based on the trigger:

| Trigger | Tags Generated |
|---------|---------------|
| Push to `main` | `main`, `latest`, `main-<sha>` |
| Push to branch | `<branch>`, `<branch>-<sha>` |
| Tag `v1.2.3` | `v1.2.3`, `1.2`, `1`, `latest` |
| PR #42 | `pr-42` |

#### Environment Variables

- `REGISTRY`: GitHub Container Registry (`ghcr.io`)
- `IMAGE_NAME`: Repository name (`owner/repo`)

#### Permissions Required

- `contents: read` - Read repository
- `packages: write` - Push to GHCR
- `attestations: write` - Generate provenance
- `id-token: write` - OIDC token for attestation

---

### Database Migrations

**File:** `.github/workflows/migrate.yml`

Runs database migrations on production or staging environments.

#### Triggers

- **Manual only** (`workflow_dispatch`)
- Requires confirmation input

#### Inputs

| Input | Description | Required | Type |
|-------|-------------|----------|------|
| `environment` | Target environment (production/staging) | Yes | Choice |
| `confirm` | Type "MIGRATE" to confirm | Yes | String |

#### Jobs

##### 1. Validate (`validate`)
- Ensures user typed "MIGRATE" correctly
- Prevents accidental migrations

##### 2. Migrate (`migrate`)
- Connects to server via SSH
- Navigates to application directory
- Pulls latest Docker images
- Runs `docker compose run --rm migrate`
- Verifies migration success
- Lists database tables

##### 3. Notify (`notify`)
- Reports migration status
- Posts summary to GitHub Actions

#### Safety Features

- ✅ Requires manual confirmation ("MIGRATE")
- ✅ Uses GitHub Environments for protection rules
- ✅ Validates files exist before running
- ✅ Checks exit codes for success/failure
- ✅ Posts detailed summary

---

### Deploy to Production

**File:** `.github/workflows/deploy.yml`

Deploys the application to production or staging environments with automatic .env file generation.

#### Triggers

- **Manual only** (`workflow_dispatch`)
- Requires environment and image tag selection

#### Inputs

| Input | Description | Required | Type |
|-------|-------------|----------|------|
| `environment` | Target environment (production/staging) | Yes | Choice |
| `image_tag` | Docker image tag to deploy (e.g., main, v1.2.3) | Yes | String |

#### Jobs

##### 1. Deploy (`deploy`)
- Copies docker-compose.yml and production nginx config to server
  - `nginx.conf` - Main nginx configuration
  - `default-ssl.conf.example` → `default.conf` - SSL configuration (automatically activated)
- Creates application directory if it doesn't exist
- Creates uploads directory with proper permissions
- Backs up existing .env file with timestamp
- **Generates new .env file from GitHub Secrets**:
  - Database configuration (DB_*)
  - NextAuth configuration
  - OAuth providers (Discord, GitHub, Google)
  - Admin emails
  - Monitoring (Sentry)
  - SSL configuration
- Logs into GitHub Container Registry
- Pulls specified Docker image tag
- Stops existing containers
- Starts new containers with updated config
- Performs health checks with retries
- Shows application logs
- Cleans up temporary files

##### 2. Notify (`notify`)
- Reports deployment status
- Posts deployment summary

#### Features

- ✅ **Automatic directory setup** - Creates app and uploads directories if missing
- ✅ **Automatic file deployment** - Copies docker-compose.yml and production nginx SSL config
- ✅ **Automatic .env generation** from GitHub Secrets
- ✅ **Backup** of existing .env before deployment
- ✅ **Health checks** to verify successful deployment
- ✅ **Rollback capability** by deploying previous image tag
- ✅ **Environment-specific** configuration support
- ✅ **Deployment summary** with image details
- ✅ **Automatic cleanup** of temporary files

#### .env File Generation

The deployment workflow automatically generates the `.env` file from the following GitHub Secrets:

**Database Configuration:**
- `DB_PASSWORD`, `DB_NAME`, `DB_USER`, `DB_HOST`, `DB_PORT`

**Authentication:**
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

**OAuth Providers:**
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (optional)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional)

**Application:**
- `SUPER_ADMIN_EMAILS`

**Monitoring:**
- `SENTRY_AUTH_TOKEN`, `SENTRY_DSN` (optional)

**SSL:**
- `CERTBOT_EMAIL` (optional)

See [GITHUB-SECRETS.md](./GITHUB-SECRETS.md) for complete secret configuration guide.

---

## Setup Requirements

### 1. GitHub Secrets

Configure the following secrets in your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

#### Required for CI/CD:
- `GITHUB_TOKEN` - Automatically provided by GitHub (no setup needed)

#### Required for Migrations:
- `SSH_HOST` - Production server hostname/IP
- `SSH_USER` - SSH username
- `SSH_PORT` - SSH port (usually 22)
- `SSH_PRIVATE_KEY` - Private SSH key for authentication
- `DB_USER` - Database username (for verification)
- `DB_NAME` - Database name (for verification)

### 2. GitHub Container Registry (GHCR)

GHCR is automatically available for all GitHub repositories. Images are published to:
```
ghcr.io/OWNER/REPOSITORY
```

#### Make Package Public (Optional)

1. Go to: `https://github.com/orgs/OWNER/packages/container/REPOSITORY/settings`
2. Scroll to "Danger Zone"
3. Click "Change visibility" → "Public"

### 3. GitHub Environments (Optional but Recommended)

Create environments for deployment protection:

**Settings → Environments → New environment**

Create environments:
- `production`
- `staging`

Configure protection rules:
- Required reviewers (recommended for production)
- Wait timer
- Deployment branches (restrict to main)

### 4. SSH Access Setup

On your production server:

```bash
# Add GitHub Actions SSH key
mkdir -p ~/.ssh
echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Generate SSH key pair for GitHub Actions:
```bash
ssh-keygen -t ed25519 -C "github-actions" -f github_actions_key
```

- Add public key (`github_actions_key.pub`) to server
- Add private key (`github_actions_key`) to GitHub secret `SSH_PRIVATE_KEY`

---

## Usage Guide

### Building and Pushing Images

#### Automatic Build (Main Branch)

1. Make changes to your code
2. Commit and push to `main` branch
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin main
   ```
3. GitHub Actions automatically builds and pushes image
4. Image is available at: `ghcr.io/OWNER/REPO:main`

#### Manual Build

1. Go to **Actions** tab in GitHub
2. Select **CI/CD - Build and Push to GHCR**
3. Click **Run workflow**
4. Select branch
5. Click **Run workflow**

#### Release Build (Tagged Version)

```bash
# Create and push a semantic version tag
git tag v1.2.3
git push origin v1.2.3
```

This creates multiple tags:
- `v1.2.3`
- `1.2`
- `1`
- `latest`

### Running Database Migrations

⚠️ **IMPORTANT**: Always backup your database before running migrations!

#### Production Migration

1. Go to **Actions** tab in GitHub
2. Select **Database Migration** workflow
3. Click **Run workflow**
4. Select `production` environment
5. Type **`MIGRATE`** in the confirmation field
6. Click **Run workflow**
7. Monitor the logs for success/failure

#### Staging Migration

Same as production, but select `staging` environment.

### Deploying to Production

⚠️ **IMPORTANT**: Ensure all GitHub Secrets are configured before deploying! See [GITHUB-SECRETS.md](./GITHUB-SECRETS.md).

#### Complete Deployment Workflow

1. **Build and push image** (automatic on push to main, or manual)
2. **Deploy to server** (manual via Deploy workflow)
3. **Run migrations** (manual via Migration workflow, if needed)

#### Deploy Latest Build

1. Go to **Actions** tab in GitHub
2. Select **Deploy to Production** workflow
3. Click **Run workflow**
4. Select `production` environment
5. Enter image tag (e.g., `main`, `v1.2.3`, or `latest`)
6. Click **Run workflow**
7. Monitor the deployment logs

**The workflow will:**
- Create application directory (if it doesn't exist)
- Copy docker-compose.yml and nginx configuration
- Create uploads directory with proper permissions
- Generate `.env` file from GitHub Secrets
- Pull specified Docker image
- Stop old containers
- Start new containers
- Perform health checks
- Display recent logs
- Clean up temporary files

#### Deploy Specific Version

To deploy a specific version:

```
Image tag: v1.2.3
```

#### Rollback to Previous Version

To rollback, deploy a previous image tag:

```
Image tag: main-abc1234
```

Or use a previous release version:

```
Image tag: v1.2.2
```

#### Verify Deployment

After deployment, verify:

1. Check workflow logs for "✅ Application is healthy"
2. Visit your application URL
3. Test login and key features
4. Check application logs: `docker compose logs -f app`

### Pulling Images Locally

```bash
# Pull latest main branch image
docker pull ghcr.io/OWNER/REPO:main

# Pull specific version
docker pull ghcr.io/OWNER/REPO:v1.2.3

# Pull by commit SHA
docker pull ghcr.io/OWNER/REPO:main-abc1234
```

### Using Images in Production

Update your `docker-compose.yml`:

```yaml
services:
  app:
    image: ghcr.io/OWNER/REPO:main
    # or specific version:
    # image: ghcr.io/OWNER/REPO:v1.2.3
```

Then pull and restart:
```bash
docker compose pull app
docker compose up -d app
```

---

## Troubleshooting

### Image Push Fails - Permission Denied

**Error:**
```
Error: denied: permission_denied: write_package
```

**Solution:**
1. Go to repository **Settings** → **Actions** → **General**
2. Scroll to "Workflow permissions"
3. Select "Read and write permissions"
4. Save

### SSH Connection Fails

**Error:**
```
Error: ssh: connect to host X.X.X.X port 22: Connection refused
```

**Solutions:**
1. Verify `SSH_HOST` secret is correct
2. Verify `SSH_PORT` secret (default: 22)
3. Check firewall allows connections from GitHub IPs
4. Verify SSH service is running: `sudo systemctl status sshd`

### Migration Fails - Database Connection

**Error:**
```
PostgresError: password authentication failed
```

**Solutions:**
1. Verify `.env` file exists on server
2. Check `DATABASE_URL` is correct
3. Verify PostgreSQL container is running:
   ```bash
   docker compose ps postgres
   ```
4. Test database connection:
   ```bash
   docker compose exec postgres psql -U user -d dbname
   ```

### Build Fails - Lint Errors

**Error:**
```
Error: ESLint found 5 errors
```

**Solution:**
Fix linting errors locally before pushing:
```bash
npm run lint
npm run lint -- --fix  # Auto-fix if possible
```

### Build Fails - Type Errors

**Error:**
```
Error: TypeScript compilation failed
```

**Solution:**
Fix type errors locally:
```bash
npx tsc --noEmit
```

### Docker Build Timeout

**Error:**
```
Error: buildx build failed: context deadline exceeded
```

**Solutions:**
1. Check if dependencies are downloading slowly
2. Optimize Dockerfile layer caching
3. Use multi-stage builds efficiently
4. Check GitHub Actions status page for outages

### Image Too Large

**Warning:**
```
Warning: Image size is 2.5GB
```

**Solutions:**
1. Use `.dockerignore` to exclude unnecessary files
2. Use multi-stage builds
3. Remove unnecessary dependencies
4. Use Alpine-based images where possible

---

## Best Practices

### 1. Semantic Versioning

Use semantic versioning for releases:
- `v1.0.0` - Major version (breaking changes)
- `v1.1.0` - Minor version (new features)
- `v1.1.1` - Patch version (bug fixes)

### 2. Branch Protection

Enable branch protection for `main`:
- Require pull request reviews
- Require status checks (lint/test) to pass
- Require branches to be up to date

### 3. Image Tagging Strategy

- Use `latest` for production deployments
- Use `main` for latest stable build
- Use semantic versions for specific releases
- Use SHA tags for rollback capability

### 4. Migration Safety

- Always backup database before migrations
- Test migrations on staging first
- Run migrations during low-traffic periods
- Keep migration logs for audit trail

### 5. Secret Management

- Rotate SSH keys periodically
- Use GitHub Environments for sensitive deployments
- Never commit secrets to repository
- Use minimal permissions for service accounts

---

## Monitoring and Logs

### View Workflow Runs

**GitHub Repository → Actions tab**

- See all workflow runs
- Filter by workflow, branch, or status
- Download logs for debugging

### View Build Logs

1. Click on workflow run
2. Click on job name
3. Expand steps to see detailed logs

### View Images

**GitHub Repository → Packages**

- See all published images
- View tags and sizes
- See download statistics

### Check Image Attestation

```bash
# Install gh CLI
gh attestation verify oci://ghcr.io/OWNER/REPO:main
```

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Container Registry Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Docker Metadata Action](https://github.com/docker/metadata-action)
- [SSH Action Documentation](https://github.com/appleboy/ssh-action)

---

## Quick Reference

```bash
# View published images
gh api /user/packages/container/REPO/versions

# Delete old image versions
gh api --method DELETE /user/packages/container/REPO/versions/VERSION_ID

# Trigger workflow manually
gh workflow run ci-cd.yml --ref main

# View workflow status
gh run list --workflow=ci-cd.yml

# Download workflow logs
gh run download RUN_ID
```
