# GitHub Secrets Configuration

Complete list of GitHub Secrets used by the deploy and migration workflows. The deploy workflow renders them into `~/bingoscape/.env` on the server (see [GITHUB-ACTIONS.md](./GITHUB-ACTIONS.md)).

## How to Add Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

---

## Required Secrets

These secrets **must** be configured for the deployment pipeline to work.

### Database Configuration

| Secret Name   | Description                                                   | Example Value         | Default when unset |
| ------------- | ------------------------------------------------------------- | --------------------- | ------------------ |
| `DB_PASSWORD` | PostgreSQL database password (**required**)                   | `secure_password_123` | -                  |
| `DB_NAME`     | PostgreSQL database name                                      | `bingoscapenext`      | `bingoscape`       |
| `DB_USER`     | PostgreSQL database username                                  | `bingoscapenext`      | `postgres`         |
| `DB_HOST`     | PostgreSQL host name inside the compose network               | `bingoscapedb`        | `bingoscapedb`     |
| `DB_PORT`     | Port PostgreSQL is published on, on `127.0.0.1` of the server | `5432`                | `5432`             |

The defaults are those of `docker-compose.yml`. `scripts/backup-db.sh` and `scripts/restore-db.sh` read `DB_NAME` and `DB_USER` from the server's `.env` with the same defaults, so they always use the database the app uses.

**Notes:**

- Values are quoted for docker compose when the `.env` is generated, so characters like `"`, `$`, `#` and `\` survive. Line breaks are not allowed.
- The app connects with `postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME`, built by docker compose without URL-encoding. Use a password without URL-special characters (`@ : / ? # %`), for example `openssl rand -hex 24`.
- Changing `DB_PASSWORD` does not change the password of an already initialized database volume. Change it in PostgreSQL first.

### Authentication Configuration

| Secret Name       | Description                | Example Value            | How to Generate           |
| ----------------- | -------------------------- | ------------------------ | ------------------------- |
| `NEXTAUTH_SECRET` | NextAuth.js encryption key | `base64-encoded-string`  | `openssl rand -base64 32` |
| `NEXTAUTH_URL`    | Application URL            | `https://bingoscape.org` | Your domain               |

### OAuth Providers (Required)

| Secret Name             | Description                 | Where to Get                                                            |
| ----------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `DISCORD_CLIENT_ID`     | Discord OAuth Client ID     | [Discord Developer Portal](https://discord.com/developers/applications) |
| `DISCORD_CLIENT_SECRET` | Discord OAuth Client Secret | [Discord Developer Portal](https://discord.com/developers/applications) |

### Application Configuration

| Secret Name                          | Description                                                                                                                                         | Example Value                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `SUPER_ADMIN_EMAILS`                 | Comma-separated admin emails                                                                                                                        | `admin@example.com,admin2@example.com` |
| `CRON_SECRET`                        | Bearer secret for `/api/cron/unlock` (scheduled bingo unlock). The endpoint answers 401 while it is unset (recommended)                             | `openssl rand -hex 32`                 |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Stable key for Next.js server action IDs/closures (recommended). Without it, every build gets a new key and open browser tabs break after a deploy. | `openssl rand -base64 32`              |

### SSH Access (For Deployments & Migrations)

| Secret Name       | Description                        | Example Value                              | How to Generate         |
| ----------------- | ---------------------------------- | ------------------------------------------ | ----------------------- |
| `SSH_HOST`        | Production server hostname or IP   | `bingoscape.org` or `192.168.1.100`        | Your server             |
| `SSH_USER`        | SSH username                       | `deploy` or `ubuntu`                       | Your server user        |
| `SSH_PORT`        | SSH port                           | `22`                                       | Usually 22              |
| `SSH_PRIVATE_KEY` | Private SSH key for authentication | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` | `ssh-keygen -t ed25519` |

#### Generating SSH Key Pair

```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -C "github-actions-deploy" -f github_actions_deploy

# View private key (add this to GitHub secret SSH_PRIVATE_KEY)
cat github_actions_deploy

# View public key (add this to server ~/.ssh/authorized_keys)
cat github_actions_deploy.pub
```

#### Pinning the server host key (recommended)

`SSH_HOST_FINGERPRINT` is optional. When set, the deploy and migrate workflows verify the server's SSH host key against it and refuse to connect on a mismatch (protection against man-in-the-middle). When it is empty, host key verification is skipped.

```bash
# Run on the server (or use ssh-keyscan from your machine); the value to store is the SHA256:... string
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub -E sha256
```

Store the full `SHA256:...` value as the `SSH_HOST_FINGERPRINT` secret. Update it if the server's host keys are ever regenerated.

---

## Optional Secrets

These secrets are optional but recommended for enhanced functionality.

### Additional OAuth Providers

| Secret Name              | Description                           | Where to Get                                                        |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------- |
| `GH_OAUTH_CLIENT_ID`     | GitHub OAuth Client ID (optional)     | [GitHub Developer Settings](https://github.com/settings/developers) |
| `GH_OAUTH_CLIENT_SECRET` | GitHub OAuth Client Secret (optional) | [GitHub Developer Settings](https://github.com/settings/developers) |
| `GOOGLE_CLIENT_ID`       | Google OAuth Client ID (optional)     | [Google Cloud Console](https://console.cloud.google.com/)           |
| `GOOGLE_CLIENT_SECRET`   | Google OAuth Client Secret (optional) | [Google Cloud Console](https://console.cloud.google.com/)           |

**Why `GH_OAUTH_*`?** GitHub reserves secret names starting with `GITHUB_`, so `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` can never be created as secrets. The deploy workflow reads `GH_OAUTH_CLIENT_ID`/`GH_OAUTH_CLIENT_SECRET` and writes them to the server's `.env` as `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, which are the names the app expects.

**Note:** If you don't configure these, users simply won't see GitHub/Google login options.

---

## Auto-Provided Secrets

These secrets are automatically provided by GitHub - no configuration needed.

| Secret Name         | Description                         | Usage                                                                    |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `GITHUB_TOKEN`      | Automatic token for GitHub API      | Pushing images to GHCR (CI), pulling them on the server (deploy/migrate) |
| `github.actor`      | GitHub username triggering workflow | Login to GHCR                                                            |
| `github.repository` | Repository name (owner/repo)        | Docker image naming                                                      |

---

## Secrets Validation Checklist

Use this checklist to ensure all required secrets are configured:

### ✅ Database Secrets

- [ ] `DB_PASSWORD` - Configured with strong, URL-safe password
- [ ] `DB_NAME` - Matches the existing database (default `bingoscape`)
- [ ] `DB_USER` - Matches the existing database user (default `postgres`)
- [ ] `DB_HOST` / `DB_PORT` - Only if you changed the defaults

### ✅ Authentication Secrets

- [ ] `NEXTAUTH_SECRET` - Generated using `openssl rand -base64 32`
- [ ] `NEXTAUTH_URL` - Set to your production URL (e.g., `https://bingoscape.org`)

### ✅ OAuth Secrets (Required)

- [ ] `DISCORD_CLIENT_ID` - From Discord Developer Portal
- [ ] `DISCORD_CLIENT_SECRET` - From Discord Developer Portal
- [ ] Discord redirect URL configured: `{NEXTAUTH_URL}/api/auth/callback/discord`

### ✅ Application Secrets

- [ ] `SUPER_ADMIN_EMAILS` - At least one admin email configured
- [ ] `CRON_SECRET` - Generated (recommended)
- [ ] `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` - Generated (recommended)

### ✅ SSH Secrets (For Deployments)

- [ ] `SSH_HOST` - Production server hostname/IP
- [ ] `SSH_USER` - SSH username
- [ ] `SSH_PORT` - SSH port (usually `22`)
- [ ] `SSH_PRIVATE_KEY` - Private key content
- [ ] `SSH_HOST_FINGERPRINT` - (Recommended) SHA256 fingerprint of the server host key
- [ ] Public key added to server's `~/.ssh/authorized_keys`

### ⚙️ Optional Secrets

- [ ] `GH_OAUTH_CLIENT_ID` - (Optional) For GitHub OAuth
- [ ] `GH_OAUTH_CLIENT_SECRET` - (Optional) For GitHub OAuth
- [ ] `GOOGLE_CLIENT_ID` - (Optional) For Google OAuth
- [ ] `GOOGLE_CLIENT_SECRET` - (Optional) For Google OAuth

---

## Environment Secrets

The deploy and migration workflows run in the GitHub Environment `production` (there is no staging environment). Secrets can be stored either as repository secrets or as secrets of that environment (**Settings -> Environments -> production -> Add secret**); environment secrets take precedence and let you add protection rules such as required reviewers.

---

## Security Best Practices

### 🔐 Secret Management

1. **Never commit secrets to repository**
   - Always use GitHub Secrets
   - Never hardcode in workflow files

2. **Use strong passwords**
   - Generate with: `openssl rand -base64 32`
   - Minimum 32 characters for production

3. **Rotate secrets regularly**
   - Change every 90 days
   - Rotate immediately if compromised

4. **Use minimal permissions**
   - SSH user should have minimal permissions
   - Use dedicated deployment user

5. **Enable 2FA for GitHub**
   - Protects secrets from unauthorized access
   - Required for organization repositories

### 🔒 SSH Key Security

1. **Use separate keys for different purposes**
   - Don't reuse personal SSH keys
   - One key per deployment environment

2. **Protect private keys**
   - Never share private keys
   - Store only in GitHub Secrets

3. **Monitor SSH access**
   - Review server logs regularly
   - Use fail2ban for brute force protection

4. **Restrict SSH key usage**
   ```bash
   # Add to ~/.ssh/authorized_keys before the key:
   command="/usr/local/bin/deploy-script",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-ed25519 AAAA...
   ```

### 📊 Audit Trail

GitHub automatically logs all secret usage:

- **Settings → Actions → Audit log**
- Shows who accessed which secrets when
- Monitor for suspicious activity

---

## Testing Secrets Configuration

### Test SSH Connection

```bash
# Test SSH connection locally before adding to GitHub
ssh -i github_actions_deploy -p 22 deploy@your-server.com "echo 'SSH connection successful'"
```

### Check which secrets are set

```bash
gh secret list                      # repository secrets
gh secret list --env production     # environment secrets
```

Names that must exist: `DB_PASSWORD`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_PRIVATE_KEY`. The deploy workflow fails with a clear message if one of the required ones is empty.

---

## Troubleshooting

### Secret Not Found Error

**Error:** `Error: Secret DB_PASSWORD not found`

**Solution:**

1. Verify secret name matches exactly (case-sensitive)
2. Check if secret is set at repository or environment (`production`) level
3. Secrets whose names start with `GITHUB_` cannot be created: use `GH_OAUTH_CLIENT_ID` / `GH_OAUTH_CLIENT_SECRET`

### SSH Authentication Failed

**Error:** `Permission denied (publickey)`

**Solutions:**

1. Verify private key is complete (including header/footer)
2. Check public key is in server's `~/.ssh/authorized_keys`
3. Verify SSH_USER has correct permissions
4. Test SSH connection manually first

### Invalid NEXTAUTH_SECRET

**Error:** `Invalid NextAuth secret`

**Solution:**
Generate a new secret:

```bash
openssl rand -base64 32
```

Update the `NEXTAUTH_SECRET` secret in GitHub.

### Database Connection Failed

**Error:** `password authentication failed for user`

**Solution:**

1. Verify `DB_PASSWORD` matches database password
2. Check `DB_USER` and `DB_NAME` are correct
3. Ensure `DB_HOST` matches the compose host name (default `bingoscapedb`) and the password has no URL-special characters
4. Test database connection on server

---

## Quick Reference

### Generate Secrets Commands

```bash
# NextAuth Secret
openssl rand -base64 32

# Database Password
openssl rand -base64 24

# SSH Key Pair
ssh-keygen -t ed25519 -C "github-actions" -f github_actions_key

# Test Database Connection String
# postgresql://user:password@host:port/database
```

### View All Repository Secrets

```bash
# Using GitHub CLI
gh secret list

# View specific secret info (not value)
gh secret view SECRET_NAME
```

### Set Secrets via CLI

```bash
# Set secret from command
gh secret set SECRET_NAME --body "secret-value"

# Set secret from file
gh secret set SSH_PRIVATE_KEY < github_actions_key

# Set secret interactively
gh secret set SECRET_NAME
```

---

## Additional Resources

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Environment Protection Rules](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [GitHub CLI Secret Management](https://cli.github.com/manual/gh_secret)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
- [Discord Developer Portal](https://discord.com/developers/docs)
