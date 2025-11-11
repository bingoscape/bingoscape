# Debian User Setup Guide

Complete guide for creating and configuring a Debian/Ubuntu system user to host the Bingoscape Next application.

## Table of Contents

1. [Overview](#overview)
2. [Why Use a Dedicated User](#why-use-a-dedicated-user)
3. [Creating the Deployment User](#creating-the-deployment-user)
4. [SSH Configuration](#ssh-configuration)
5. [Docker Permissions](#docker-permissions)
6. [Directory Structure](#directory-structure)
7. [Security Best Practices](#security-best-practices)
8. [User Management](#user-management)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers creating a dedicated Linux system user on your Debian/Ubuntu server specifically for hosting the Bingoscape Next application. This user will:

- Own the application files and directories
- Run Docker containers
- Be used by GitHub Actions for deployments via SSH
- Have minimal necessary permissions for security

**Recommended User Names:**
- `deploy` - Most common for deployment users
- `bingoscape` - Application-specific naming
- `app` - Generic application user

Throughout this guide, we'll use `deploy` as the username, but you can substitute your preferred name.

---

## Why Use a Dedicated User

### Security Benefits

1. **Principle of Least Privilege**
   - User only has permissions needed for the application
   - Limits damage if credentials are compromised
   - Separates application from system administration

2. **Isolation**
   - Application files isolated from other services
   - Easy to audit what the application can access
   - Clear ownership and permissions boundaries

3. **Access Control**
   - Separate SSH keys for deployment vs administration
   - Can restrict user to specific commands (optional)
   - Easy to revoke access without affecting other services

### Operational Benefits

1. **Organization**
   - All application files in one user's home directory
   - Clear separation of concerns
   - Easy backup and migration

2. **Logging**
   - All application actions logged under one user
   - Easier to track deployment activities
   - Clear audit trail

3. **Multiple Administrators**
   - Multiple people can have SSH keys for the deploy user
   - Doesn't require sharing root credentials
   - Can use sudo for elevated permissions when needed

---

## Creating the Deployment User

### Step 1: Connect as Root or Sudo User

```bash
# SSH into your server as root
ssh root@your-server-ip

# Or as a user with sudo privileges
ssh your-user@your-server-ip
```

### Step 2: Create the User

```bash
# Create user with home directory
sudo adduser deploy

# You'll be prompted for:
# - Password (set a strong password)
# - Full Name (optional, can press Enter)
# - Room Number (optional, press Enter)
# - Work Phone (optional, press Enter)
# - Home Phone (optional, press Enter)
# - Other (optional, press Enter)
# - Is the information correct? [Y/n] (press Y)
```

**Example Session:**
```
Adding user `deploy' ...
Adding new group `deploy' (1001) ...
Adding new user `deploy' (1001) with group `deploy' ...
Creating home directory `/home/deploy' ...
Copying files from `/etc/skel' ...
New password: ********
Retype new password: ********
passwd: password updated successfully
Changing the user information for deploy
Enter the new value, or press ENTER for the default
    Full Name []: Deploy User
    Room Number []:
    Work Phone []:
    Home Phone []:
    Other []:
Is the information correct? [Y/n] Y
```

### Step 3: Verify User Creation

```bash
# Check if user exists
id deploy

# Expected output:
# uid=1001(deploy) gid=1001(deploy) groups=1001(deploy)

# Check home directory
ls -la /home/deploy

# Expected output:
# total 20
# drwxr-xr-x 2 deploy deploy 4096 Jan 11 10:00 .
# drwxr-xr-x 4 root   root   4096 Jan 11 10:00 ..
# -rw-r--r-- 1 deploy deploy  220 Jan 11 10:00 .bash_logout
# -rw-r--r-- 1 deploy deploy 3526 Jan 11 10:00 .bashrc
# -rw-r--r-- 1 deploy deploy  807 Jan 11 10:00 .profile
```

### Step 4: (Optional) Grant Sudo Privileges

If you want the deploy user to run commands with sudo:

```bash
# Add user to sudo group
sudo usermod -aG sudo deploy

# Verify
groups deploy
# Expected: deploy sudo

# Test sudo access
sudo -u deploy sudo whoami
# Should output: root (after entering deploy user's password)
```

**Note:** For production security, consider NOT granting sudo access and instead having a separate admin user.

### Alternative: Passwordless Sudo (Advanced)

For automated scripts that need sudo without password prompts:

```bash
# Create sudoers file for deploy user
sudo visudo -f /etc/sudoers.d/deploy

# Add this line:
deploy ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/systemctl restart nginx

# Save and exit (Ctrl+X, Y, Enter)

# Set proper permissions
sudo chmod 0440 /etc/sudoers.d/deploy
```

**Warning:** Only grant specific commands, never `NOPASSWD: ALL` in production!

---

## SSH Configuration

### Step 1: Create SSH Directory

```bash
# Switch to deploy user
sudo su - deploy

# Create SSH directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh
```

### Step 2: Generate SSH Key Pair

```bash
# Generate SSH key for GitHub Actions
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions

# When prompted:
# - Enter passphrase: (leave empty for automation)
# - Enter same passphrase again: (leave empty)

# Expected output:
# Your identification has been saved in /home/deploy/.ssh/github_actions
# Your public key has been saved in /home/deploy/.ssh/github_actions.pub
```

### Step 3: Configure Authorized Keys

```bash
# Add public key to authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Set proper permissions
chmod 600 ~/.ssh/authorized_keys

# Verify
ls -la ~/.ssh/
# Expected:
# -rw------- 1 deploy deploy  411 Jan 11 10:05 authorized_keys
# -rw------- 1 deploy deploy  464 Jan 11 10:04 github_actions
# -rw-r--r-- 1 deploy deploy  102 Jan 11 10:04 github_actions.pub
```

### Step 4: Copy Private Key for GitHub

```bash
# Display private key
cat ~/.ssh/github_actions

# Copy the entire output (including headers)
# -----BEGIN OPENSSH PRIVATE KEY-----
# ...key contents...
# -----END OPENSSH PRIVATE KEY-----
```

**Important:** Save this private key securely. You'll add it to GitHub Secrets as `SSH_PRIVATE_KEY`.

### Step 5: Test SSH Access

From your **local machine**, test SSH access:

```bash
# Save the private key locally
nano github_actions_key
# Paste the private key, save and exit

# Set proper permissions
chmod 600 github_actions_key

# Test SSH connection
ssh -i github_actions_key deploy@your-server-ip

# If successful, you should see:
# Welcome to Ubuntu 22.04.3 LTS ...
# deploy@your-server:~$
```

### SSH Configuration for Multiple Keys (Optional)

If you want to add your personal SSH key as well:

```bash
# On your local machine, copy your public key
cat ~/.ssh/id_ed25519.pub
# Or: cat ~/.ssh/id_rsa.pub

# On the server (as deploy user)
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys

# Now you can SSH without specifying key file
ssh deploy@your-server-ip
```

---

## Docker Permissions

The deploy user needs permission to run Docker commands.

### Step 1: Add User to Docker Group

```bash
# As root or sudo user
sudo usermod -aG docker deploy

# Verify group membership
groups deploy
# Expected: deploy docker

# Or check in more detail
id deploy
# Expected: uid=1001(deploy) gid=1001(deploy) groups=1001(deploy),999(docker)
```

### Step 2: Apply Group Changes

```bash
# For the change to take effect, the user needs to log out and back in
# If you're currently as deploy user:
exit

# SSH back in as deploy
sudo su - deploy

# Or start a new login shell
newgrp docker
```

### Step 3: Test Docker Access

```bash
# As deploy user
docker --version
# Expected: Docker version 27.x.x

docker compose version
# Expected: Docker Compose version v2.x.x

# Test running a container
docker run --rm hello-world
# Should download and run successfully without sudo
```

### Troubleshooting Docker Permissions

If you get "permission denied" errors:

```bash
# Check Docker socket permissions
ls -la /var/run/docker.sock
# Expected: srw-rw---- 1 root docker 0 Jan 11 09:00 /var/run/docker.sock

# Verify deploy is in docker group
groups deploy | grep docker

# If docker group is missing, repeat the usermod command
sudo usermod -aG docker deploy

# Restart Docker daemon
sudo systemctl restart docker

# Log out and back in as deploy user
```

---

## Directory Structure

### Step 1: Create Application Directory

```bash
# As deploy user
cd ~

# Create application directory
mkdir -p bingoscape
cd bingoscape

# Verify
pwd
# Expected: /home/deploy/bingoscape
```

### Step 2: Create Subdirectories

```bash
# Create all necessary subdirectories
mkdir -p nginx/conf.d
mkdir -p nginx/ssl
mkdir -p uploads
mkdir -p certbot

# Set proper permissions for uploads
chmod 755 uploads

# Verify structure
tree -L 2
# Or use ls if tree is not installed:
ls -la
```

**Expected Structure:**
```
/home/deploy/bingoscape/
├── nginx/
│   ├── conf.d/          # Nginx site configuration
│   └── ssl/             # SSL certificates
├── uploads/             # User uploaded files
├── certbot/             # Let's Encrypt webroot
├── docker-compose.yml   # (created during deployment)
└── .env                 # (created during deployment)
```

### Step 3: Set Ownership and Permissions

```bash
# Ensure deploy user owns everything
sudo chown -R deploy:deploy /home/deploy/bingoscape

# Set directory permissions
find /home/deploy/bingoscape -type d -exec chmod 755 {} \;

# Set file permissions (after files are created)
find /home/deploy/bingoscape -type f -exec chmod 644 {} \;

# Special permissions for uploads directory
chmod 755 /home/deploy/bingoscape/uploads

# Verify
ls -la /home/deploy/bingoscape
```

### Step 4: Create Backup Directory (Optional)

```bash
# Create directory for database backups
mkdir -p ~/backups
chmod 700 ~/backups

# Create backup subdirectories
mkdir -p ~/backups/database
mkdir -p ~/backups/uploads
mkdir -p ~/backups/config
```

---

## Security Best Practices

### 1. Strong Password

```bash
# Set/change user password
sudo passwd deploy

# Enter strong password (at least 16 characters, mix of letters/numbers/symbols)
```

### 2. Disable Password Authentication (SSH Key Only)

After setting up SSH keys, disable password login for better security:

```bash
# As root or sudo user
sudo nano /etc/ssh/sshd_config

# Find and modify these lines:
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no

# Save and exit (Ctrl+X, Y, Enter)

# Restart SSH service
sudo systemctl restart sshd
```

**Warning:** Test SSH key login first! Don't lock yourself out.

### 3. Restrict User to Specific Commands (Advanced)

Limit what the deploy user can do via SSH:

```bash
# Edit authorized_keys
nano ~/.ssh/authorized_keys

# Add restrictions before the key:
command="/home/deploy/bin/deploy-script",no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-ed25519 AAAA...
```

This forces all SSH connections to run a specific script.

### 4. File Permission Audit

```bash
# Check for files with wrong permissions
find /home/deploy/bingoscape -type f -perm /o+w

# Should return nothing (no world-writable files)

# Check for directories with wrong permissions
find /home/deploy/bingoscape -type d -perm /o+w

# Should only show uploads directory if needed
```

### 5. Regularly Rotate SSH Keys

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "github-actions-$(date +%Y%m)" -f ~/.ssh/github_actions_new

# Add new key to authorized_keys
cat ~/.ssh/github_actions_new.pub >> ~/.ssh/authorized_keys

# Update GitHub Secret with new private key
# Test deployment with new key
# Remove old key from authorized_keys after confirming
```

### 6. Monitor User Activity

```bash
# Check recent logins
last deploy | head -20

# Check failed login attempts
sudo grep "Failed password for deploy" /var/log/auth.log

# Check current sessions
who

# Check what deploy user is running
ps aux | grep deploy
```

---

## User Management

### View User Information

```bash
# As root or sudo user

# Show user details
id deploy
getent passwd deploy

# Show user groups
groups deploy

# Show home directory contents
sudo ls -la /home/deploy

# Show disk usage
sudo du -sh /home/deploy/*
```

### Modify User

```bash
# Change user's shell
sudo chsh -s /bin/bash deploy

# Change user's home directory
sudo usermod -d /home/newpath deploy

# Lock user account (disable login)
sudo passwd -l deploy

# Unlock user account
sudo passwd -u deploy

# Set account expiration
sudo chage -E 2025-12-31 deploy

# Remove expiration
sudo chage -E -1 deploy
```

### Add Additional Users

If you need multiple deployment users:

```bash
# Create additional user
sudo adduser deploy2

# Add to docker group
sudo usermod -aG docker deploy2

# Set up SSH keys
sudo su - deploy2
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Generate keys and configure...
```

### Delete User

**Warning:** This permanently deletes the user and optionally their files!

```bash
# Delete user but keep home directory
sudo userdel deploy

# Delete user and home directory
sudo userdel -r deploy

# Verify deletion
id deploy
# Expected: id: 'deploy': no such user
```

---

## Troubleshooting

### User Can't Login via SSH

**Problem:** SSH connection refused or permission denied.

**Solutions:**

1. **Check SSH service is running:**
   ```bash
   sudo systemctl status sshd
   ```

2. **Verify user exists:**
   ```bash
   id deploy
   getent passwd deploy
   ```

3. **Check authorized_keys permissions:**
   ```bash
   ls -la /home/deploy/.ssh/authorized_keys
   # Should be: -rw------- 1 deploy deploy
   ```

4. **Fix permissions if needed:**
   ```bash
   sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
   sudo chmod 600 /home/deploy/.ssh/authorized_keys
   sudo chmod 700 /home/deploy/.ssh
   ```

5. **Check SSH logs:**
   ```bash
   sudo tail -f /var/log/auth.log
   # Try to connect and watch for errors
   ```

6. **Verify public key is in authorized_keys:**
   ```bash
   cat /home/deploy/.ssh/authorized_keys
   ```

### Docker Permission Denied

**Problem:** User gets "permission denied" when running docker commands.

**Solutions:**

1. **Verify docker group:**
   ```bash
   groups deploy | grep docker
   ```

2. **Add to docker group:**
   ```bash
   sudo usermod -aG docker deploy
   ```

3. **Log out and back in:**
   ```bash
   exit
   sudo su - deploy
   ```

4. **Check Docker socket:**
   ```bash
   ls -la /var/run/docker.sock
   # Should show: srw-rw---- 1 root docker
   ```

5. **Restart Docker:**
   ```bash
   sudo systemctl restart docker
   ```

### Can't Write to Application Directory

**Problem:** Permission denied when writing files to /home/deploy/bingoscape.

**Solutions:**

1. **Check ownership:**
   ```bash
   ls -la /home/deploy/
   # bingoscape should be owned by deploy:deploy
   ```

2. **Fix ownership:**
   ```bash
   sudo chown -R deploy:deploy /home/deploy/bingoscape
   ```

3. **Check permissions:**
   ```bash
   ls -la /home/deploy/bingoscape
   # Directories should be drwxr-xr-x (755)
   # Files should be -rw-r--r-- (644)
   ```

4. **Fix permissions:**
   ```bash
   sudo chmod 755 /home/deploy/bingoscape
   find /home/deploy/bingoscape -type d -exec sudo chmod 755 {} \;
   ```

### Uploads Directory Permission Issues

**Problem:** Application can't write to uploads directory.

**Solutions:**

The Docker container runs as UID 1001 (nextjs user), so uploads directory needs specific permissions:

```bash
# Set ownership to UID 1001
sudo chown -R 1001:1001 /home/deploy/bingoscape/uploads

# Or allow deploy user to write (if UID matches)
sudo chown -R deploy:deploy /home/deploy/bingoscape/uploads
chmod 755 /home/deploy/bingoscape/uploads

# Verify container can write
docker compose exec app touch /app/public/uploads/test.txt
ls -la /home/deploy/bingoscape/uploads/test.txt
```

### SSH Key Authentication Fails

**Problem:** SSH with private key fails with "Permission denied (publickey)".

**Solutions:**

1. **Verify private key format:**
   ```bash
   cat github_actions_key | head -1
   # Should be: -----BEGIN OPENSSH PRIVATE KEY-----
   ```

2. **Check private key permissions (on local machine):**
   ```bash
   chmod 600 github_actions_key
   ```

3. **Test with verbose output:**
   ```bash
   ssh -vvv -i github_actions_key deploy@your-server-ip
   # Look for authentication attempts and failures
   ```

4. **Verify public key on server:**
   ```bash
   cat /home/deploy/.ssh/authorized_keys
   # Should contain the matching public key
   ```

5. **Regenerate key pair:**
   ```bash
   # On server as deploy user
   ssh-keygen -t ed25519 -f ~/.ssh/github_actions_new
   cat ~/.ssh/github_actions_new.pub >> ~/.ssh/authorized_keys

   # Copy new private key to GitHub Secrets
   cat ~/.ssh/github_actions_new
   ```

---

## Quick Reference

### Essential Commands

```bash
# Switch to deploy user
sudo su - deploy

# Check user info
id deploy
groups deploy
whoami

# Navigate to application
cd ~/bingoscape

# View logs
docker compose logs app -f

# Restart services
docker compose restart

# Check disk usage
df -h
du -sh ~/bingoscape/*

# View recent logins
last deploy

# Check running processes
ps aux | grep deploy
```

### File Locations

```
/home/deploy/                   # Deploy user home directory
├── .ssh/                       # SSH keys and configuration
│   ├── authorized_keys         # Authorized public keys
│   ├── github_actions          # Private key (keep secure!)
│   └── github_actions.pub      # Public key
├── bingoscape/                 # Application directory
│   ├── docker-compose.yml
│   ├── .env
│   ├── nginx/
│   ├── uploads/
│   └── certbot/
└── backups/                    # Database backups (optional)
    ├── database/
    └── uploads/
```

### Permission Quick Reference

```bash
# User directories
/home/deploy/                   # 755 (drwxr-xr-x)
/home/deploy/.ssh/              # 700 (drwx------)
/home/deploy/.ssh/authorized_keys # 600 (-rw-------)
/home/deploy/bingoscape/        # 755 (drwxr-xr-x)
/home/deploy/bingoscape/uploads/ # 755 (drwxr-xr-x)

# Application files
docker-compose.yml              # 644 (-rw-r--r--)
.env                            # 600 (-rw-------)  # Contains secrets!
nginx/ssl/*.pem                 # 600 (-rw-------)  # SSL private keys
```

---

## Additional Resources

- [Debian User Management](https://www.debian.org/doc/manuals/debian-reference/ch04.en.html)
- [Ubuntu Server Guide - User Management](https://ubuntu.com/server/docs/security-users)
- [SSH Key Authentication](https://www.ssh.com/academy/ssh/authorized-keys-file)
- [Docker Post-Installation Steps](https://docs.docker.com/engine/install/linux-postinstall/)
- [Linux File Permissions](https://www.linux.com/training-tutorials/understanding-linux-file-permissions/)

---

## Summary Checklist

After completing this guide, verify:

- [ ] Deploy user created with strong password
- [ ] User added to docker group
- [ ] SSH directory created with correct permissions (700)
- [ ] SSH key pair generated for GitHub Actions
- [ ] Public key added to authorized_keys (600)
- [ ] SSH authentication tested successfully
- [ ] Docker commands work without sudo
- [ ] Application directory structure created
- [ ] All directories owned by deploy user
- [ ] Uploads directory has proper permissions (755, UID 1001)
- [ ] Private key securely stored for GitHub Secrets
- [ ] (Optional) Sudo access configured if needed
- [ ] (Optional) Password authentication disabled
- [ ] (Optional) Backup directory created

**Your deploy user is now ready for production deployment!**

Proceed to [PRODUCTION-SETUP.md](./PRODUCTION-SETUP.md) for application deployment steps.
