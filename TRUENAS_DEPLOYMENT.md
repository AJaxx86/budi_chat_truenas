# 🚀 TrueNAS Scale Deployment Guide

This guide will walk you through deploying AI Chat Hub on TrueNAS Scale using the Custom App feature.

## 📋 Prerequisites

1. TrueNAS Scale installed and running
2. OpenRouter API key ([Get one here](https://openrouter.ai/keys))
3. Basic familiarity with TrueNAS Scale Apps

## 🔧 Step-by-Step Deployment

### Step 1: Prepare the Docker Image

You have two options:

#### Option A: Build Locally (Recommended)
1. SSH into your TrueNAS server
2. Clone or download this repository
3. Build the Docker image:
   ```bash
   cd /mnt/your-pool/ai-chat-hub
   docker build -t ai-chat-hub:latest .
   ```

#### Option B: Use Docker Hub
1. Build on your computer and push to Docker Hub
2. Use the image in TrueNAS Custom App

### Step 2: Create Storage Location

1. In TrueNAS, go to **Datasets**
2. Create a new dataset:
   - Name: `ai-chat-hub-data`
   - Path: `/mnt/your-pool/ai-chat-hub-data`
3. Note the full path for later

### Step 3: Deploy Custom App

1. **Navigate to Apps** in TrueNAS UI
2. Click **"Discover Apps"**
3. Click **"Custom App"** button

### Step 4: Configure the Application

Fill in the following configuration:

#### **Application Name**
```
ai-chat-hub
```

#### **Container Images**

**Image Repository:**
```
ai-chat-hub
```
*Or your Docker Hub repository if you pushed it there*

**Image Tag:**
```
latest
```

**Image Pull Policy:**
```
IfNotPresent
```

#### **Container Entrypoint**
Leave empty (use default)

#### **Container Args**
Leave empty (use default)

#### **Container Environment Variables**

Click "Add" for each of these environment variables:

| Name | Value |
|------|-------|
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | `CHANGE-THIS-TO-A-SECURE-RANDOM-STRING-AT-LEAST-32-CHARS` |
| `ADMIN_EMAIL` | `admin@yourdomain.com` |
| `ADMIN_PASSWORD` | `YourSecurePassword123!` |
| `DB_PATH` | `/app/data/database.db` |
| `DEFAULT_OPENROUTER_API_KEY` | `sk-your-openrouter-api-key-here` (optional) |

⚠️ **IMPORTANT SECURITY NOTES:**
- **JWT_SECRET**: Generate a secure random string (at least 32 characters)
  - Example: Use `openssl rand -base64 32` to generate one
- **ADMIN_PASSWORD**: Use a strong password, change it after first login
- **DEFAULT_OPENROUTER_API_KEY**: Optional - leave empty if users will use their own keys

#### **Networking**

**Port Forwarding:**

Click "Add" to add a port:
- **Container Port:** `3001`
- **Node Port:** `30001` (or any available port 30000-32767)
- **Protocol:** `TCP`

You can also use host networking if preferred.

**DNS Configuration:**
- Leave default unless you have specific DNS requirements

#### **Storage**

Click "Add" under **Host Path Volumes**:

**Mount Path 1: Database Storage**
- **Host Path:** `/mnt/your-pool/ai-chat-hub-data`
- **Mount Path:** `/app/data`
- **Read Only:** `No` (unchecked)

#### **Security Context**
Leave as default unless you have specific requirements.

#### **Resources**
Configure based on your needs:
- **CPU Limit:** `2000m` (2 cores)
- **Memory Limit:** `2Gi` (2GB)
- **CPU Request:** `500m` (0.5 core)
- **Memory Request:** `512Mi` (512MB)

*Adjust based on expected usage*

### Step 5: Deploy

1. Review all settings
2. Click **"Install"** at the bottom
3. Wait for deployment to complete (check "Installed Applications")

### Step 6: Access Your Application

1. Find your TrueNAS IP address
2. Open browser and navigate to:
   ```
   http://YOUR-TRUENAS-IP:30001
   ```
   (Replace `30001` with your chosen Node Port)

3. Login with admin credentials:
   - Email: What you set in `ADMIN_EMAIL`
   - Password: What you set in `ADMIN_PASSWORD`

### Step 7: Post-Installation Setup

1. **Change Admin Password:**
   - Go to Settings
   - Update your password immediately

2. **Configure API Keys:**
   - If you set `DEFAULT_OPENROUTER_API_KEY`, go to Admin Panel and verify it
   - Otherwise, go to Settings and add your personal OpenRouter API key

3. **Create Users (if needed):**
   - Go to Admin Panel
   - Click "Add User"
   - Set permissions appropriately

## 🔐 Security Best Practices

### 1. Use a Reverse Proxy (Recommended)

Set up a reverse proxy with SSL/TLS:
- Use TrueNAS Scale's built-in reverse proxy (if available)
- Or use Traefik/Nginx as a separate container
- Enable HTTPS with Let's Encrypt

### 2. Restrict Access

- Use TrueNAS firewall rules to limit access
- Consider VPN access for remote users
- Use strong passwords for all accounts

### 3. Regular Backups

Backup your data directory regularly:
```bash
# Example backup command
tar -czf ai-chat-hub-backup-$(date +%Y%m%d).tar.gz /mnt/your-pool/ai-chat-hub-data
```

### 4. Monitor Resource Usage

- Check container logs regularly
- Monitor CPU/Memory usage in TrueNAS Apps
- Set up alerts for high resource usage

## 🔄 Updating the Application

### Method 1: Using TrueNAS UI

1. Go to **Installed Applications**
2. Find **ai-chat-hub**
3. Click **"Update"** (if available)

### Method 2: Manual Update

1. Build new image:
   ```bash
   docker build -t ai-chat-hub:latest .
   ```

2. Stop the application in TrueNAS UI

3. Start the application (it will use the new image)

## 🐛 Troubleshooting

### Application Won't Start

1. **Check Logs:**
   - Go to TrueNAS Apps
   - Click on ai-chat-hub
   - View container logs

2. **Common Issues:**
   - Port already in use → Change Node Port
   - Permission denied → Check host path permissions
   - Image not found → Verify image was built correctly

### Cannot Access Application

1. **Verify Port:**
   ```bash
   netstat -tuln | grep 30001
   ```

2. **Check Firewall:**
   - Ensure port is open in TrueNAS firewall
   - Check router/firewall settings

3. **Test Connectivity:**
   ```bash
   curl http://localhost:30001
   ```

### Database Issues

If database gets corrupted:

1. Stop the application
2. Backup current database:
   ```bash
   cp /mnt/your-pool/ai-chat-hub-data/database.db /mnt/your-pool/ai-chat-hub-data/database.db.backup
   ```
3. Delete database:
   ```bash
   rm /mnt/your-pool/ai-chat-hub-data/database.db*
   ```
4. Restart application (new database will be created)

### High Resource Usage

1. Reduce concurrent users
2. Increase resource limits in app configuration
3. Consider using GPT-3.5 instead of GPT-4 for lower latency

## 📊 Monitoring

### View Container Logs
```bash
docker logs ai-chat-hub
```

### Check Container Status
```bash
docker ps | grep ai-chat-hub
```

### Monitor Resource Usage
Use TrueNAS built-in monitoring or:
```bash
docker stats ai-chat-hub
```

## 🔧 Advanced Configuration

### Using External Database

To use PostgreSQL instead of SQLite:
1. Deploy PostgreSQL container
2. Modify application to use PostgreSQL (requires code changes)

### Multiple Instances

Deploy multiple instances for high availability:
1. Use different Node Ports for each instance
2. Set up load balancer (Traefik/Nginx)
3. Use shared database storage

### Custom Domain

1. Set up reverse proxy with SSL
2. Configure DNS to point to TrueNAS
3. Access via `https://ai-chat.yourdomain.com`

## 📞 Getting Help

### Check Application Status
```bash
# SSH into TrueNAS
docker exec -it ai-chat-hub sh

# Inside container
node -e "console.log('App is running')"
```

### Common Commands
```bash
# Restart application
docker restart ai-chat-hub

# View environment variables
docker exec ai-chat-hub env

# Check disk usage
du -sh /mnt/your-pool/ai-chat-hub-data
```

## 🎯 Performance Tuning

### For Heavy Usage (10+ concurrent users)

**Resource Limits:**
- CPU: 4 cores (4000m)
- Memory: 4GB (4Gi)

**Database Optimization:**
Consider PostgreSQL for better performance with multiple concurrent users.

### For Light Usage (1-5 users)

**Resource Limits:**
- CPU: 1 core (1000m)
- Memory: 1GB (1Gi)

## ✅ Success Checklist

- [ ] Application deployed and running
- [ ] Can access via web browser
- [ ] Logged in as admin
- [ ] Changed default admin password
- [ ] Configured API keys
- [ ] Created test chat and verified it works
- [ ] Set up backup strategy
- [ ] Documented configuration for team
- [ ] (Optional) Configured reverse proxy with SSL

---

## 🎉 You're All Set!

Your AI Chat Hub is now running on TrueNAS Scale. Enjoy your private, self-hosted AI chat application!

For questions or issues, refer to the main README.md or create an issue on GitHub.

**Happy Chatting! 💬✨**
