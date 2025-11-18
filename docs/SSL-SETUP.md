# SSL Certificate Setup Guide

Complete guide for setting up SSL certificates for the nginx container using Let's Encrypt.

**Domain:** staging.bingoscape.org
**Email:** sschubert932@gmail.com

## Table of Contents
- [Prerequisites](#prerequisites)
- [Option 1: Manual Setup (Recommended for First Time)](#option-1-manual-setup-recommended-for-first-time)
- [Option 2: Automated Setup with Certbot Container](#option-2-automated-setup-with-certbot-container)
- [Option 3: Copy Existing Certificates](#option-3-copy-existing-certificates)
- [Verification](#verification)
- [Certificate Renewal](#certificate-renewal)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Server with Docker and Docker Compose installed
- Domain name pointing to your server (A record)
- Ports 80 and 443 open in firewall
- Application deployed at `~/bingoscape` (or your configured directory)

**Verify DNS is configured:**
```bash
# Check if your domain points to your server
dig +short staging.bingoscape.org
# Should return your server's IP address

# Or use nslookup
nslookup staging.bingoscape.org
```

---

## Option 1: Manual Setup (Recommended for First Time)

This approach uses certbot to generate certificates, then copies them to the nginx container directory.

### Step 1: Install Certbot

**On Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install certbot -y
```

**On CentOS/RHEL:**
```bash
sudo yum install certbot -y
```

### Step 2: Temporarily Use HTTP-Only Configuration

Before getting SSL certificates, nginx needs to be able to serve the ACME challenge over HTTP.

```bash
cd ~/bingoscape

# Backup the SSL config
cp nginx/conf.d/default.conf nginx/conf.d/default.conf.backup

# Create temporary HTTP-only config
cat > nginx/conf.d/default.conf << 'EOF'
# Temporary HTTP configuration for Let's Encrypt verification

upstream nextjs_app {
    server app:3000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name staging.bingoscape.org;

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Temporary: proxy to app for initial setup
    location / {
        proxy_pass http://nextjs_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

### Step 3: Update docker-compose.yml for Certbot

Add certbot webroot volume to docker-compose.yml:

```bash
# Edit docker-compose.yml
nano docker-compose.yml
```

Add to the nginx service volumes:
```yaml
services:
  nginx:
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./uploads:/var/www/uploads:ro
      - ./certbot:/var/www/certbot:ro  # Add this line
```

### Step 4: Restart Nginx with HTTP Config

```bash
cd ~/bingoscape

# Restart nginx to use HTTP-only config
docker compose restart nginx

# Verify nginx is running
docker compose ps nginx
```

### Step 5: Create Certbot Directory

```bash
cd ~/bingoscape
mkdir -p certbot
```

### Step 6: Generate SSL Certificates

Run certbot with webroot authentication:

```bash
sudo certbot certonly \
  --webroot \
  --webroot-path ~/bingoscape/certbot \
  --email sschubert932@gmail.com \
  --agree-tos \
  --no-eff-email \
  -d staging.bingoscape.org
```

You should see:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/staging.bingoscape.org/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/staging.bingoscape.org/privkey.pem
```

### Step 7: Copy Certificates to nginx Directory

```bash
cd ~/bingoscape

# Create SSL directory
mkdir -p nginx/ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/bingoscape.org/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/bingoscape.org/privkey.pem nginx/ssl/

# Set proper permissions
sudo chown $USER:$USER nginx/ssl/*.pem
chmod 644 nginx/ssl/fullchain.pem
chmod 600 nginx/ssl/privkey.pem
```

### Step 8: Restore SSL Configuration

```bash
cd ~/bingoscape

# Restore the SSL config
cp nginx/conf.d/default.conf.backup nginx/conf.d/default.conf

# Or copy from the example if you don't have backup
# cp nginx/conf.d/default-ssl.conf.example nginx/conf.d/default.conf
```

### Step 9: Restart Nginx with SSL

```bash
cd ~/bingoscape

# Restart nginx to use SSL config
docker compose restart nginx

# Check nginx logs for any errors
docker compose logs nginx
```

### Step 10: Verify SSL is Working

Visit your site:
```
https://bingoscape.org
```

You should see:
- ✅ HTTPS connection (lock icon in browser)
- ✅ Valid certificate
- ✅ Redirect from HTTP to HTTPS
- ✅ Redirect from www to main domain

---

## Option 2: Automated Setup with Certbot Container

This approach uses a certbot Docker container to generate and manage certificates.

### Step 1: Create Certbot Service in docker-compose.yml

Add this to your docker-compose.yml:

```yaml
services:
  # ... existing services ...

  certbot:
    image: certbot/certbot:latest
    container_name: bingoscape-certbot
    volumes:
      - ./nginx/ssl:/etc/letsencrypt
      - ./certbot:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email your-email@example.com --agree-tos --no-eff-email -d bingoscape.org -d www.bingoscape.org -d next.bingoscape.org
    networks:
      - bingoscape-network
    profiles:
      - certbot
```

### Step 2: Prepare for Certificate Generation

```bash
cd ~/bingoscape

# Use HTTP-only config temporarily (same as Option 1, Step 2)
# ... follow same steps ...

# Create certbot directory
mkdir -p certbot

# Restart nginx
docker compose restart nginx
```

### Step 3: Run Certbot Container

```bash
cd ~/bingoscape

# Run certbot to generate certificates
docker compose --profile certbot run --rm certbot

# Check if certificates were created
ls -la nginx/ssl/
```

### Step 4: Restore SSL Configuration and Restart

```bash
# Restore SSL config
cp nginx/conf.d/default-ssl.conf.example nginx/conf.d/default.conf

# Restart nginx
docker compose restart nginx
```

---

## Option 3: Copy Existing Certificates

If you already have Let's Encrypt certificates on your server from a previous setup:

### Step 1: Locate Existing Certificates

```bash
# Certificates are usually at:
sudo ls -la /etc/letsencrypt/live/your-domain.com/
```

### Step 2: Copy to nginx Directory

```bash
cd ~/bingoscape

# Create SSL directory
mkdir -p nginx/ssl

# Copy certificates (replace 'your-domain.com' with your domain)
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/

# Fix permissions
sudo chown $USER:$USER nginx/ssl/*.pem
chmod 644 nginx/ssl/fullchain.pem
chmod 600 nginx/ssl/privkey.pem
```

### Step 3: Verify and Restart

```bash
# Check files exist
ls -la nginx/ssl/

# Restart nginx
docker compose restart nginx
```

---

## Verification

### Check Certificate Files

```bash
cd ~/bingoscape

# Check if certificate files exist
ls -la nginx/ssl/

# Should see:
# fullchain.pem (644 permissions)
# privkey.pem (600 permissions)
```

### Check Certificate Validity

```bash
# Check certificate details
openssl x509 -in ~/bingoscape/nginx/ssl/fullchain.pem -noout -text

# Check expiration date
openssl x509 -in ~/bingoscape/nginx/ssl/fullchain.pem -noout -dates
```

### Check nginx Configuration

```bash
# Test nginx config
docker compose exec nginx nginx -t

# Should output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Check nginx Logs

```bash
# Check for SSL errors
docker compose logs nginx | grep -i error
docker compose logs nginx | grep -i ssl
```

### Test HTTPS Connection

```bash
# Test SSL connection
curl -I https://bingoscape.org

# Should return:
# HTTP/2 200
# (with other headers)

# Test SSL handshake
openssl s_client -connect bingoscape.org:443 -servername bingoscape.org
```

### Online SSL Test

Visit these tools to verify your SSL setup:
- https://www.ssllabs.com/ssltest/analyze.html?d=bingoscape.org
- https://www.sslshopper.com/ssl-checker.html

---

## Certificate Renewal

Let's Encrypt certificates expire every 90 days. Here's how to renew them.

### Manual Renewal

```bash
# Renew certificates
sudo certbot renew

# Copy renewed certificates
sudo cp /etc/letsencrypt/live/bingoscape.org/fullchain.pem ~/bingoscape/nginx/ssl/
sudo cp /etc/letsencrypt/live/bingoscape.org/privkey.pem ~/bingoscape/nginx/ssl/

# Fix permissions
sudo chown $USER:$USER ~/bingoscape/nginx/ssl/*.pem
chmod 644 ~/bingoscape/nginx/ssl/fullchain.pem
chmod 600 ~/bingoscape/nginx/ssl/privkey.pem

# Restart nginx
cd ~/bingoscape
docker compose restart nginx
```

### Automated Renewal with Cron

Create a renewal script:

```bash
# Create renewal script
cat > ~/bingoscape/renew-ssl.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Renewing SSL certificates..."

# Renew certificates
certbot renew --quiet

# Copy to nginx directory
cp /etc/letsencrypt/live/bingoscape.org/fullchain.pem ~/bingoscape/nginx/ssl/
cp /etc/letsencrypt/live/bingoscape.org/privkey.pem ~/bingoscape/nginx/ssl/

# Fix permissions
chown $USER:$USER ~/bingoscape/nginx/ssl/*.pem
chmod 644 ~/bingoscape/nginx/ssl/fullchain.pem
chmod 600 ~/bingoscape/nginx/ssl/privkey.pem

# Restart nginx
cd ~/bingoscape
docker compose restart nginx

echo "✅ SSL certificates renewed successfully"
EOF

# Make script executable
chmod +x ~/bingoscape/renew-ssl.sh
```

Add to crontab (runs monthly at 2 AM):

```bash
# Edit crontab
sudo crontab -e

# Add this line:
0 2 1 * * /home/your-username/bingoscape/renew-ssl.sh >> /home/your-username/bingoscape/ssl-renewal.log 2>&1
```

### Renewal with Certbot Container

If using the certbot container approach:

```bash
# Run certbot renewal
docker compose --profile certbot run --rm certbot renew

# Restart nginx
docker compose restart nginx
```

---

## Troubleshooting

### Error: Challenge Failed

**Problem:** Certbot can't verify domain ownership.

**Solution:**
```bash
# Verify DNS is correct
dig +short bingoscape.org

# Verify port 80 is open
sudo netstat -tlnp | grep :80

# Verify nginx is serving .well-known directory
curl http://bingoscape.org/.well-known/acme-challenge/test

# Check nginx logs
docker compose logs nginx
```

### Error: Certificate Not Found in Container

**Problem:** nginx can't find SSL certificates.

**Solution:**
```bash
# Check if files exist on host
ls -la ~/bingoscape/nginx/ssl/

# Check if files exist in container
docker compose exec nginx ls -la /etc/nginx/ssl/

# Verify docker-compose.yml has correct volume mount
grep -A 10 "nginx:" docker-compose.yml | grep ssl
```

### Error: Permission Denied

**Problem:** nginx can't read certificate files.

**Solution:**
```bash
# Fix permissions
cd ~/bingoscape
chmod 644 nginx/ssl/fullchain.pem
chmod 600 nginx/ssl/privkey.pem

# Restart nginx
docker compose restart nginx
```

### Error: nginx Configuration Test Failed

**Problem:** `nginx -t` fails with SSL errors.

**Solution:**
```bash
# Check nginx error logs
docker compose logs nginx

# Common issues:
# 1. Certificate path wrong in config
# 2. Certificate files don't exist
# 3. Certificate files have wrong permissions

# Verify paths in default.conf match:
grep ssl_certificate nginx/conf.d/default.conf

# Should be:
# ssl_certificate /etc/nginx/ssl/fullchain.pem;
# ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

### Error: Certificate Expired

**Problem:** Certificate has expired (>90 days old).

**Solution:**
```bash
# Check expiration date
openssl x509 -in ~/bingoscape/nginx/ssl/fullchain.pem -noout -dates

# If expired, renew:
sudo certbot renew --force-renewal

# Copy renewed certificates
sudo cp /etc/letsencrypt/live/bingoscape.org/fullchain.pem ~/bingoscape/nginx/ssl/
sudo cp /etc/letsencrypt/live/bingoscape.org/privkey.pem ~/bingoscape/nginx/ssl/

# Restart nginx
cd ~/bingoscape
docker compose restart nginx
```

### Error: Wrong Certificate Domain

**Problem:** Certificate is for different domain.

**Solution:**
```bash
# Check certificate domains
openssl x509 -in ~/bingoscape/nginx/ssl/fullchain.pem -noout -text | grep DNS

# If wrong domain, generate new certificate:
sudo certbot certonly --webroot \
  --webroot-path ~/bingoscape/certbot \
  --email your-email@example.com \
  --agree-tos \
  -d correct-domain.com \
  -d www.correct-domain.com

# Copy and restart
```

---

## Quick Reference

### Generate Certificates (First Time)
```bash
# 1. Install certbot
sudo apt install certbot -y

# 2. Use HTTP-only nginx config
cp nginx/conf.d/default-dev.conf.example nginx/conf.d/default.conf

# 3. Restart nginx
docker compose restart nginx

# 4. Generate certificates
sudo certbot certonly --webroot \
  --webroot-path ~/bingoscape/certbot \
  --email your-email@example.com \
  --agree-tos \
  -d bingoscape.org -d www.bingoscape.org

# 5. Copy certificates
sudo cp /etc/letsencrypt/live/bingoscape.org/*.pem ~/bingoscape/nginx/ssl/
sudo chown $USER:$USER ~/bingoscape/nginx/ssl/*.pem
chmod 644 ~/bingoscape/nginx/ssl/fullchain.pem
chmod 600 ~/bingoscape/nginx/ssl/privkey.pem

# 6. Activate SSL config
cp nginx/conf.d/default-ssl.conf.example nginx/conf.d/default.conf

# 7. Restart nginx
docker compose restart nginx
```

### Verify Setup
```bash
# Test nginx config
docker compose exec nginx nginx -t

# Check HTTPS
curl -I https://bingoscape.org

# View logs
docker compose logs nginx
```

### Renew Certificates
```bash
# Renew
sudo certbot renew

# Copy
sudo cp /etc/letsencrypt/live/bingoscape.org/*.pem ~/bingoscape/nginx/ssl/

# Restart
docker compose restart nginx
```

---

## Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://eff-certbot.readthedocs.io/)
- [nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [SSL Labs Testing](https://www.ssllabs.com/ssltest/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
