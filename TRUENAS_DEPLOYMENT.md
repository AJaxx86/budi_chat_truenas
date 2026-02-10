# 🚀 TrueNAS Scale 25.10.1 Deployment Guide

This guide covers deploying AI Chat Hub on TrueNAS Scale 25.10.1 (Goldeye) using **Dockge** and Docker Compose - the recommended modern approach.

## 📋 Prerequisites

1. TrueNAS Scale 25.10.1 (Goldeye) installed and running
2. Storage pool created (e.g., `/mnt/ARK/`)
3. Nginx Proxy Manager already installed as TrueNAS App
4. Docker Hub account (free)
5. Domain configured (e.g., `chat.ajaxx.uk`)
6. OpenRouter API key ([Get one here](https://openrouter.ai/keys))

---

## 🔧 Phase 1: Push Image to Docker Hub

Since TrueNAS will pull your image from Docker Hub, you need to build and push it first.

### Step 1: Create Docker Hub Account

1. Go to [hub.docker.com](https://hub.docker.com)
2. Sign up for a free account
3. Create a new repository:
   - **Repository Name:** `budi-chat`
   - **Visibility:** Public (or Private if you have Pro)
   - **Description:** "AI Chat Hub - Self-hosted multi-user AI chat application"

### Step 2: Build and Push Image

On your development machine (where you have the source code):

```bash
# Navigate to your project directory
cd /path/to/ai-chat-hub

# Login to Docker Hub
docker login

# Build the image
docker build -t ajaxx123/budi-chat:latest .

# Tag with version (optional but recommended)
docker tag ajaxx123/budi-chat:latest ajaxx123/budi-chat:v1.0.0

# Push to Docker Hub
docker push ajaxx123/budi-chat:latest
docker push ajaxx123/budi-chat:v1.0.0
```

**Note:** Your Docker Hub username is `ajaxx123` and repository name is `budi-chat`.

### Step 3: Verify Push

Check your Docker Hub repository to confirm the image was pushed successfully.

---

## 🔧 Phase 2: Install Dockge on TrueNAS

Dockge is a Docker Compose GUI manager that makes deployment easy.

### Step 1: Install Dockge

1. In TrueNAS UI, go to **Apps**
2. Click **Discover Apps**
3. Search for **"Dockge"**
4. Click **Install**
5. Configure:
   - **Application Name:** `dockge` (or your preference)
   - **Storagen>**: Use default or specify a path
   - Click **Install**
6. Wait for installation to complete

### Step 2: Access Dockge

1. Find the Dockge app in **Installed Applications**
2. Click the **Open** button or go to `http://YOUR-TRUENAS-IP:5001`
3. Create your Dockge admin account

---

## 🔧 Phase 3: Create Storage Location

### Step 1: Create Dataset

1. In TrueNAS UI, go to **Datasets**
2. Navigate to your pool (`/mnt/ARK/`)
3. Click **Add Dataset**
4. Configure:
   - **Name:** `ai-chat-hub`
   - **Path:** `/mnt/ARK/apps/ai-chat-hub`
   - **Encryption:** Optional (recommended for production)
   - Click **Save**

### Step 2: Create Data Subfolder

```bash
# SSH into your TrueNAS server
ssh root@YOUR-TRUENAS-IP

# Create data directory
mkdir -p /mnt/ARK/apps/ai-chat-hub/data

# Set proper permissions
chown -R 568:568 /mnt/ARK/apps/ai-chat-hub
chmod 755 /mnt/ARK/apps/ai-chat-hub/data
```

---

## 🔧 Phase 4: Deploy AI Chat Hub

### Step 1: Create New Stack in Dockge

1. Open Dockge UI (`http://YOUR-TRUENAS-IP:5001`)
2. Click **"+ New Stack"**
3. **Stack Name:** `ai-chat-hub`
4. **File Path:** `/mnt/ARK/apps/ai-chat-hub/docker-compose.yml`

### Step 2: Paste Docker Compose Configuration

In the Docker Compose editor, paste:

```yaml
version: '3.8'

services:
  ai-chat-hub:
    image: ajaxx123/budi-chat:latest
    container_name: ai-chat-hub
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - /mnt/ARK/apps/ai-chat-hub/data:/app/data
    environment:
      - PORT=3001
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - DEFAULT_OPENROUTER_API_KEY=${DEFAULT_OPENROUTER_API_KEY:-}
      - DB_PATH=/app/data/database.db
      - BRAVE_SEARCH_API_KEY=${BRAVE_SEARCH_API_KEY:-}
      - WEB_SEARCH_MAX_RESULTS=${WEB_SEARCH_MAX_RESULTS:-5}
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/api/auth/me', (r) => {process.exit(r.statusCode === 401 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s
    networks:
      - ai-chat-hub

networks:
  ai-chat-hub:
    driver: bridge
```

**⚠️ Important:** The image is set to `ajaxx123/budi-chat:latest` which uses your Docker Hub username and repository name.

### Step 3: Create Environment Variables File

1. In Dockge, click **".env"** tab
2. Paste the following (customize values):

```bash
# Security - CHANGE THESE!
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
ADMIN_PASSWORD=your-secure-admin-password-here

# Optional API Keys
DEFAULT_OPENROUTER_API_KEY=sk-or-v1-your-openrouter-api-key-here
BRAVE_SEARCH_API_KEY=your-brave-search-api-key-here

# Admin Settings
ADMIN_EMAIL=admin@ajaxx.uk
WEB_SEARCH_MAX_RESULTS=5
```

**🔐 Generate JWT Secret:**
```bash
# On any Linux/Mac machine
openssl rand -base64 32
```

### Step 4: Deploy

1. Click **"Compose"** → **"Up"** in Dockge
2. Wait for the image to pull and container to start (this may take 2-5 minutes)
3. Check logs to confirm successful startup

### Step 5: Verify Deployment

1. Go to `http://YOUR-TRUENAS-IP:3001`
2. You should see the login page
3. Login with:
   - **Email:** Your `ADMIN_EMAIL` value
   - **Password:** Your `ADMIN_PASSWORD` value

---

## 🔧 Phase 5: Configure Nginx Proxy Manager

Since you already have Nginx Proxy Manager installed:

### Step 1: Add Proxy Host

1. Open Nginx Proxy Manager (`http://YOUR-TRUENAS-IP:81`)
2. Go to **Hosts** → **Proxy Hosts**
3. Click **Add Proxy Host**

### Step 2: Configure Proxy Host

**Details Tab:**
- **Domain Names:** `chat.ajaxx.uk`
- **Scheme:** `http`
- **Forward Hostname/IP:** `YOUR-TRUENAS-IP` (or `truenas-hostname`)
- **Forward Port:** `3001`

**SSL Tab:**
- **SSL Certificate:** Request a new SSL Certificate
- **Force SSL:** ✅ Enabled
- **HTTP/2 Support:** ✅ Enabled
- **HSTS Enabled:** ✅ Enabled
- **HSTS Subdomains:** ✅ Enabled

**Advanced Tab:**
Paste this custom configuration for WebSocket support (required for SSE streaming):

```nginx
# WebSocket support for SSE streaming
location / {
    proxy_pass http://YOUR-TRUENAS-IP:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

### Step 3: Save and Test

1. Click **Save**
2. Wait for SSL certificate to be issued
3. Visit `https://chat.ajaxx.uk`
4. You should see the AI Chat Hub login page with SSL enabled

---

## 🔐 Security Best Practices

### 1. Change Default Password

1. Login to AI Chat Hub
2. Go to **Profile** (top right)
3. Change your password immediately

### 2. Configure Firewall

In TrueNAS UI:
1. Go to **Network** → **Firewall**
2. Create rule to block direct access to port 3001 from external networks
3. Only allow access through Nginx Proxy Manager (port 443)

### 3. Enable 2FA (Optional)

1. Go to **Profile**
2. Enable Two-Factor Authentication
3. Scan QR code with authenticator app

---

## 🔄 Updating the Application

### Manual Update Process

When a new version is released:

#### Step 1: Build and Push New Version

On your development machine:

```bash
cd /path/to/ai-chat-hub

# Build new version
docker build -t ajaxx123/budi-chat:v1.1.0 .

# Tag as latest
docker tag ajaxx123/budi-chat:v1.1.0 ajaxx123/budi-chat:latest

# Push both tags
docker push ajaxx123/budi-chat:v1.1.0
docker push ajaxx123/budi-chat:latest
```

#### Step 2: Update in Dockge

1. Open Dockge UI
2. Select the `ai-chat-hub` stack
3. Click **"Compose"** → **"Pull"** (downloads latest image)
4. Click **"Compose"** → **"Up"** (recreates container with new image)
5. Check logs to confirm successful update

#### Step 3: Verify

1. Visit `https://chat.ajaxx.uk`
2. Verify the app loads correctly
3. Test basic functionality (login, create chat)

### Rollback (if needed)

If something goes wrong:

1. In Dockge, edit the compose file
2. Change image tag to previous version (e.g., `ajaxx123/budi-chat:v1.0.0`)
3. Click **"Compose"** → **"Up"**
4. Container will roll back to previous version

---

## 💾 Backup Strategy

### Automated Backups

Create a backup script:

```bash
#!/bin/bash
# /mnt/ARK/apps/ai-chat-hub/backup.sh

BACKUP_DIR="/mnt/ARK/backups/ai-chat-hub"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
cp /mnt/ARK/apps/ai-chat-hub/data/database.db "$BACKUP_DIR/database_$DATE.db"

# Keep only last 10 backups
cd "$BACKUP_DIR" && ls -t *.db | tail -n +11 | xargs rm -f

echo "Backup completed: database_$DATE.db"
```

### TrueNAS Task Scheduler

1. Go to **System** → **Tasks** → **Cron Jobs**
2. Click **Add**
3. Configure:
   - **Description:** AI Chat Hub Backup
   - **Command:** `/mnt/ARK/apps/ai-chat-hub/backup.sh`
   - **Schedule:** Daily at 3:00 AM (or your preference)
   - **User:** root
4. Click **Save**

---

## 🐛 Troubleshooting

### Container Won't Start

**Check logs in Dockge:**
1. Select `ai-chat-hub` stack
2. Click on container logs
3. Look for error messages

**Common issues:**
- Image not found → Verify Docker Hub username and image name
- Permission denied → Check dataset permissions (`chown -R 568:568`)
- Port conflict → Change port 3001 in compose file if needed

### Cannot Access Application

1. **Verify container is running:**
   ```bash
   docker ps | grep ai-chat-hub
   ```

2. **Check TrueNAS firewall:**
   - Go to **Network** → **Firewall**
   - Ensure port 3001 is allowed locally

3. **Test direct access:**
   ```bash
   curl http://localhost:3001/api/auth/me
   ```
   Should return 401 (unauthorized) - this means app is running

### SSL Certificate Issues

If Nginx Proxy Manager shows SSL errors:
1. Ensure port 80 is forwarded to TrueNAS for ACME validation
2. Check DNS A record points to your TrueNAS IP
3. Try deleting and recreating the SSL certificate in NPM

### Database Issues

If database becomes corrupted:
1. Stop the container in Dockge
2. SSH into TrueNAS:
   ```bash
   cd /mnt/ARK/apps/ai-chat-hub/data
   cp database.db database.db.backup.$(date +%Y%m%d)
   rm database.db*
   ```
3. Start the container - new database will be created
4. Login with admin credentials (re-create users and data)

---

## 📊 Monitoring

### Resource Usage

Monitor in TrueNAS UI:
1. Go to **Apps** → **Installed Applications**
2. Click on **ai-chat-hub**
3. View CPU, Memory, and Network usage

### Container Logs

In Dockge:
1. Select `ai-chat-hub` stack
2. View real-time logs
3. Use search/filter to find specific events

### Health Check

The container includes a health check that automatically restarts if the app becomes unresponsive. Check status:
```bash
docker ps | grep ai-chat-hub
# Look for (healthy) status
```

---

## ✅ Success Checklist

- [ ] Image pushed to Docker Hub successfully
- [ ] Dockge installed on TrueNAS
- [ ] Storage dataset created at `/mnt/ARK/apps/ai-chat-hub/data`
- [ ] Docker Compose stack deployed in Dockge
- [ ] Environment variables configured (.env file)
- [ ] Application accessible at `http://YOUR-TRUENAS-IP:3001`
- [ ] Nginx Proxy Manager configured with SSL
- [ ] Application accessible at `https://chat.ajaxx.uk`
- [ ] Default admin password changed
- [ ] OpenRouter API key configured
- [ ] Backup script created and scheduled
- [ ] Test chat created successfully
- [ ] WebSocket streaming works (test AI response)

---

## 🎯 Performance Tuning

### For Light Usage (1-5 users)

Default configuration is sufficient.

### For Medium Usage (5-20 users)

Add resource limits to docker-compose.yml:

```yaml
services:
  ai-chat-hub:
    # ... existing config ...
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### For Heavy Usage (20+ users)

Consider:
- Increasing CPU/Memory limits
- Using an external database (PostgreSQL)
- Load balancing with multiple instances

---

## 🎉 You're All Set!

Your AI Chat Hub is now running on TrueNAS Scale 25.10.1 with:
- ✅ Docker Hub image management
- ✅ Dockge for easy deployment and updates
- ✅ SSL/HTTPS via Nginx Proxy Manager
- ✅ Automated backups
- ✅ Custom domain (`chat.ajaxx.uk`)

**Access your app at:** https://chat.ajaxx.uk

For questions or issues:
- Check the logs in Dockge
- Review this troubleshooting section
- Check the main README.md

**Happy Chatting! 💬✨**
