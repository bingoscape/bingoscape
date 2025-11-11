# SSL Certificate Setup

This directory should contain your SSL certificates for production deployment.

## For Production (Let's Encrypt)

### Option 1: Copy Existing Certificates

If you already have Let's Encrypt certificates on your server:

```bash
# Copy certificates to this directory
sudo cp /etc/letsencrypt/live/your-domain/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain/privkey.pem ./nginx/ssl/

# Set proper permissions
sudo chmod 644 ./nginx/ssl/fullchain.pem
sudo chmod 600 ./nginx/ssl/privkey.pem
```

### Option 2: Use Certbot with Docker

1. Create a temporary nginx configuration for certificate generation:

```bash
# Use the HTTP-only configuration temporarily
cp nginx/conf.d/default-dev.conf nginx/conf.d/default.conf
```

2. Start nginx to serve ACME challenge:

```bash
docker compose up -d nginx
```

3. Run certbot to generate certificates:

```bash
docker run --rm \
  -v $(pwd)/nginx/ssl:/etc/letsencrypt/live \
  -v $(pwd)/certbot:/var/www/certbot \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d bingoscape.org \
  -d www.bingoscape.org \
  -d next.bingoscape.org
```

4. After certificates are generated, restore the SSL configuration:

```bash
# Restore the SSL configuration
git checkout nginx/conf.d/default.conf

# Restart nginx
docker compose restart nginx
```

### Option 3: Mount Existing Let's Encrypt Directory

Alternatively, you can mount the Let's Encrypt directory directly in docker-compose.yml:

```yaml
nginx:
  volumes:
    - /etc/letsencrypt/live/your-domain:/etc/nginx/ssl:ro
```

## For Development (Self-Signed Certificates)

Generate self-signed certificates for local development:

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./nginx/ssl/privkey.pem \
  -out ./nginx/ssl/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

Or use the provided script:

```bash
./scripts/generate-dev-ssl.sh
```

## Required Files

The nginx configuration expects these files:

```
nginx/ssl/
├── fullchain.pem  # Certificate chain
└── privkey.pem    # Private key
```

## Certificate Renewal

### Manual Renewal

```bash
docker run --rm \
  -v $(pwd)/nginx/ssl:/etc/letsencrypt \
  -v $(pwd)/certbot:/var/www/certbot \
  certbot/certbot renew
```

### Automatic Renewal (Cron)

Add to crontab:

```bash
0 0 1 * * cd /path/to/bingoscape-next && docker run --rm -v $(pwd)/nginx/ssl:/etc/letsencrypt -v $(pwd)/certbot:/var/www/certbot certbot/certbot renew && docker compose restart nginx
```

## Security Notes

- Never commit SSL private keys to version control
- Ensure proper file permissions (644 for .pem, 600 for privkey.pem)
- Renew certificates before they expire (Let's Encrypt: 90 days)
- Use strong cipher suites (configured in nginx.conf)

## Troubleshooting

### Certificate Not Found Error

```bash
# Check if files exist
ls -la nginx/ssl/

# Check nginx logs
docker compose logs nginx
```

### Permission Denied Error

```bash
# Fix permissions
chmod 644 nginx/ssl/fullchain.pem
chmod 600 nginx/ssl/privkey.pem
```

### Wrong Certificate Domain

Make sure the certificate CN or SAN matches your domain name. Regenerate if necessary.
