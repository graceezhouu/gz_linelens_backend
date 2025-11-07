# LineLens Backend Deployment Guide

## 🚀 Deployment Ready!

The backend is now properly configured for deployment with fixed import paths and a working `main.ts` entry point.

### ✅ What Was Fixed:

1. **Fixed main.ts imports**: Removed invalid module specifiers like `@syncs`, `@engine`, `@concepts`
2. **Simplified entry point**: `main.ts` now simply imports and runs the concept server
3. **Updated deno.json**: Added proper import aliases and tasks
4. **Added start task**: `deno task start` runs the server using main.ts
5. **Updated package.json**: Added proper scripts and metadata for deployment platforms

### 📋 Deployment Options:

#### Option 1: Deploy with Deno Deploy
```bash
# Your deployment command should now work:
deno task start

# Or directly:
deno run --allow-net --allow-read --allow-env --allow-sys src/main.ts
```

#### Option 2: Deploy with Render
```yaml
# render.yaml
services:
  - type: web
    name: linelens-backend
    env: deno
    buildCommand: deno task build
    startCommand: deno task start
```

#### Option 3: Deploy with Railway
```json
// railway.json
{
  "build": {
    "builder": "deno"
  },
  "deploy": {
    "startCommand": "deno task start"
  }
}
```

### 🔧 Environment Variables for Production:

```bash
# Required for production deployment:
NODE_ENV=production
PORT=8000                           # Or use platform's PORT env var
SYSTEM_EMAIL=noreply@yourdomain.com

# Optional - for email functionality:
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here

# Optional - for custom database:
MONGODB_URI=mongodb://your_mongodb_connection_string
```

### 🌐 Platform-Specific Instructions:

#### Deno Deploy:
1. Connect your GitHub repository
2. Set build command: `deno task build` (optional)
3. Set start command: `deno task start`
4. Set environment variables in dashboard

#### Render:
1. Connect repository 
2. Select "Deno" as environment
3. Build command: `deno task build`
4. Start command: `deno task start`
5. Add environment variables

#### Railway:
1. Connect GitHub repository
2. Railway will auto-detect Deno
3. Set start command: `deno task start`
4. Configure environment variables

### 📊 Available Endpoints:

Once deployed, your API will be available at:
- `GET /` - Health check
- `POST /api/QueueStatus/*` - Queue management
- `POST /api/VirtualCheckIn/*` - Virtual check-in
- `POST /api/UserReport/*` - User reports  
- `POST /api/Prediction/*` - AI predictions

### 🔍 Testing Deployment:

```bash
# Test locally first:
deno task start

# Then test the API:
curl http://localhost:8000/
curl -X POST http://localhost:8000/api/QueueStatus/_getAllQueues -H "Content-Type: application/json" -d '{}'
```

### 🚨 Common Deployment Issues:

1. **Port binding**: Make sure your platform's PORT environment variable is used
2. **Permissions**: Ensure `--allow-net --allow-read --allow-env --allow-sys` permissions
3. **Database**: Make sure MongoDB connection string is configured
4. **CORS**: Frontend domain should be added to CORS origins in concept_server.ts

### 🎯 Success Indicators:

When deployment is successful, you should see:
```
📧 Email Service Status:
  - Mode: production (or development)
  - System Email: your-configured-email
  - SendGrid Configured: ✅ Yes (if configured)

Server listening on http://0.0.0.0:8000
```

Your deployment is ready! 🚀
