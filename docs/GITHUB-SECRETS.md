# GitHub Secrets Configuration

Complete list of GitHub Secrets required for CI/CD pipelines, deployments, and migrations.

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

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `DB_PASSWORD` | PostgreSQL database password | `secure_password_123` |
| `DB_NAME` | PostgreSQL database name | `bingoscapenext` |
| `DB_USER` | PostgreSQL database username | `bingoscapenext` |
| `DB_HOST` | PostgreSQL database host (Docker service name) | `bingoscapedb` |
| `DB_PORT` | PostgreSQL database port | `5432` |

**Note:** If your password contains `$`, it will be escaped automatically in the generated .env file.

### Authentication Configuration

| Secret Name | Description | Example Value | How to Generate |
|-------------|-------------|---------------|-----------------|
| `NEXTAUTH_SECRET` | NextAuth.js encryption key | `base64-encoded-string` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Application URL | `https://bingoscape.org` | Your domain |

### OAuth Providers (Required)

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `DISCORD_CLIENT_ID` | Discord OAuth Client ID | [Discord Developer Portal](https://discord.com/developers/applications) |
| `DISCORD_CLIENT_SECRET` | Discord OAuth Client Secret | [Discord Developer Portal](https://discord.com/developers/applications) |

### Application Configuration

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `SUPER_ADMIN_EMAILS` | Comma-separated admin emails | `admin@example.com,admin2@example.com` |

### SSH Access (For Deployments & Migrations)

| Secret Name | Description | Example Value | How to Generate |
|-------------|-------------|---------------|-----------------|
| `SSH_HOST` | Production server hostname or IP | `bingoscape.org` or `192.168.1.100` | Your server |
| `SSH_USER` | SSH username | `deploy` or `ubuntu` | Your server user |
| `SSH_PORT` | SSH port | `22` | Usually 22 |
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

---

## Optional Secrets

These secrets are optional but recommended for enhanced functionality.

### Additional OAuth Providers

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID (optional) | [GitHub Developer Settings](https://github.com/settings/developers) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret (optional) | [GitHub Developer Settings](https://github.com/settings/developers) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (optional) | [Google Cloud Console](https://console.cloud.google.com/) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret (optional) | [Google Cloud Console](https://console.cloud.google.com/) |

**Note:** If you don't configure these, users simply won't see GitHub/Google login options.

### Monitoring & Error Tracking

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `SENTRY_AUTH_TOKEN` | Sentry authentication token for source maps | [Sentry Settings](https://sentry.io/settings/account/api/auth-tokens/) |
| `SENTRY_DSN` | Sentry Data Source Name for error tracking | [Sentry Project Settings](https://sentry.io/settings/projects/) |

**Note:** Without these, error tracking won't work, but the app will function normally.

### SSL Certificate Configuration

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `CERTBOT_EMAIL` | Email for Let's Encrypt certificate notifications | `admin@bingoscape.org` |

**Note:** Only needed if you're using the containerized nginx with Let's Encrypt.

---

## Auto-Provided Secrets

These secrets are automatically provided by GitHub - no configuration needed.

| Secret Name | Description | Usage |
|-------------|-------------|-------|
| `GITHUB_TOKEN` | Automatic token for GitHub API | Pushing Docker images to GHCR |
| `github.actor` | GitHub username triggering workflow | Login to GHCR |
| `github.repository` | Repository name (owner/repo) | Docker image naming |
| `github.sha` | Commit SHA | Image tagging |

---

## Secrets Validation Checklist

Use this checklist to ensure all required secrets are configured:

### ✅ Database Secrets
- [ ] `DB_PASSWORD` - Configured with strong password
- [ ] `DB_NAME` - Set to your database name
- [ ] `DB_USER` - Set to your database username
- [ ] `DB_HOST` - Set to Docker service name (`bingoscapedb`)
- [ ] `DB_PORT` - Set to `5432`

### ✅ Authentication Secrets
- [ ] `NEXTAUTH_SECRET` - Generated using `openssl rand -base64 32`
- [ ] `NEXTAUTH_URL` - Set to your production URL (e.g., `https://bingoscape.org`)

### ✅ OAuth Secrets (Required)
- [ ] `DISCORD_CLIENT_ID` - From Discord Developer Portal
- [ ] `DISCORD_CLIENT_SECRET` - From Discord Developer Portal
- [ ] Discord redirect URL configured: `{NEXTAUTH_URL}/api/auth/callback/discord`

### ✅ Application Secrets
- [ ] `SUPER_ADMIN_EMAILS` - At least one admin email configured

### ✅ SSH Secrets (For Deployments)
- [ ] `SSH_HOST` - Production server hostname/IP
- [ ] `SSH_USER` - SSH username
- [ ] `SSH_PORT` - SSH port (usually `22`)
- [ ] `SSH_PRIVATE_KEY` - Private key content
- [ ] Public key added to server's `~/.ssh/authorized_keys`

### ⚙️ Optional Secrets
- [ ] `GITHUB_CLIENT_ID` - (Optional) For GitHub OAuth
- [ ] `GITHUB_CLIENT_SECRET` - (Optional) For GitHub OAuth
- [ ] `GOOGLE_CLIENT_ID` - (Optional) For Google OAuth
- [ ] `GOOGLE_CLIENT_SECRET` - (Optional) For Google OAuth
- [ ] `SENTRY_AUTH_TOKEN` - (Optional) For error tracking
- [ ] `SENTRY_DSN` - (Optional) For error monitoring
- [ ] `CERTBOT_EMAIL` - (Optional) For SSL certificates

---

## Environment-Specific Secrets

If you're using GitHub Environments (production/staging), you can configure environment-specific secrets:

**Settings → Environments → [Environment Name] → Add secret**

This allows different values for production vs staging:

| Secret | Production Value | Staging Value |
|--------|-----------------|---------------|
| `NEXTAUTH_URL` | `https://bingoscape.org` | `https://staging.bingoscape.org` |
| `DB_NAME` | `bingoscape_prod` | `bingoscape_staging` |
| `SSH_HOST` | `prod.bingoscape.org` | `staging.bingoscape.org` |

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

### Test Deployment (Dry Run)

Create a test workflow to validate secrets without deploying:

```yaml
name: Test Secrets
on: workflow_dispatch

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Validate secrets are set
        run: |
          echo "Testing required secrets..."
          [ -n "${{ secrets.DB_PASSWORD }}" ] && echo "✅ DB_PASSWORD" || echo "❌ DB_PASSWORD missing"
          [ -n "${{ secrets.DB_NAME }}" ] && echo "✅ DB_NAME" || echo "❌ DB_NAME missing"
          [ -n "${{ secrets.NEXTAUTH_SECRET }}" ] && echo "✅ NEXTAUTH_SECRET" || echo "❌ NEXTAUTH_SECRET missing"
          # Add more checks...
```

---

## Troubleshooting

### Secret Not Found Error

**Error:** `Error: Secret DB_PASSWORD not found`

**Solution:**
1. Verify secret name matches exactly (case-sensitive)
2. Check if secret is set at repository or environment level
3. Ensure you're accessing the correct environment

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
3. Ensure `DB_HOST` matches docker-compose service name
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
