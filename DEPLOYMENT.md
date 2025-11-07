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
# REQUIRED - Database Configuration:
# Use your MongoDB Atlas connection string (NOT localhost):
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Example with your actual Atlas cluster:
# MONGODB_URL=mongodb+srv://gracez03:Seanbryden201124772@gz-1040-backend.8rmljiw.mongodb.net/?retryWrites=true&w=majority&appName=gz-1040-backend

# Alternative environment variable names (the app supports these):
# MONGODB_URI=your_atlas_connection_string
# DATABASE_URL=your_atlas_connection_string

# REQUIRED - Server Configuration:
NODE_ENV=production
PORT=8000                           # Or use platform's PORT env var

# REQUIRED - Database name:
DB_NAME=gz-1040-backend             # Use your actual database name

# Optional - Email functionality:
SYSTEM_EMAIL=noreply@yourdomain.com
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
```

### 📊 Database Setup Options:

#### Option 1: MongoDB Atlas (Recommended for Production)
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Create a database user
4. Get your connection string
5. Set `MONGODB_URL` environment variable

#### Option 2: Platform-provided MongoDB
Many deployment platforms offer MongoDB add-ons that automatically set the `DATABASE_URL` environment variable.

#### Option 3: Local MongoDB (Development Only - NOT for Production)
```bash
# For local development only:
MONGODB_URL=mongodb://localhost:27017/linelens
```
**⚠️ WARNING: Never use localhost MongoDB URLs in production deployment!**

### 🌐 Platform-Specific Instructions:

#### Deno Deploy:
1. Connect your GitHub repository
2. Set build command: `deno task build` (optional)
3. Set start command: `deno task start`
4. **Add environment variables in dashboard:**
   - `MONGODB_URL`: Your MongoDB connection string
   - `NODE_ENV`: `production`
   - `SYSTEM_EMAIL`: Your email address

#### Render:
1. Connect repository 
2. Select "Deno" as environment
3. Build command: `deno task build`
4. Start command: `deno task start`
5. **Add environment variables:**
   - `MONGODB_URL`: Your MongoDB connection string
   - `NODE_ENV`: `production`
6. **Optional: Add MongoDB service**
   - Render offers MongoDB add-on
   - Will automatically set `DATABASE_URL`

#### Railway:
1. Connect GitHub repository
2. Railway will auto-detect Deno
3. Set start command: `deno task start`
4. **Configure environment variables:**
   - `MONGODB_URL`: Your MongoDB connection string
   - `NODE_ENV`: `production`
5. **Optional: Add MongoDB plugin**
   - Railway has MongoDB plugin available
   - Will automatically set database environment variables

#### Heroku:
1. Use Deno buildpack: `heroku/deno`
2. **Add MongoDB:**
   - Install mLab MongoDB add-on: `heroku addons:create mongolab`
   - Or use MongoDB Atlas and set `MONGODB_URL` config var
3. **Set config vars:**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URL=your_connection_string
   heroku config:set SYSTEM_EMAIL=your_email
   ```

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

### ✅ Pre-Deployment Checklist:

1. **Database URL Check**: 
   - ✅ Uses MongoDB Atlas (cloud) connection string
   - ❌ NOT localhost URLs like `mongodb://localhost:27017/`
   - ✅ Includes database name and authentication

2. **Environment Variables Set**:
   - ✅ `MONGODB_URL` - Your Atlas connection string
   - ✅ `DB_NAME` - Your database name (e.g., `gz-1040-backend`)
   - ✅ `NODE_ENV=production`
   - ✅ `PORT` (if required by platform)

3. **File Consistency**:
   - ✅ `.env` file NOT committed to git
   - ✅ All localhost references removed from error messages
   - ✅ `deno task start` works locally

### 🚨 Common Deployment Issues:

1. **❌ "MONGODB_URL localhost error"**: Using localhost MongoDB URL in production
   - **Fix**: Use MongoDB Atlas connection string instead
   
2. **Port binding**: Make sure your platform's PORT environment variable is used
3. **Permissions**: Ensure `--allow-net --allow-read --allow-env --allow-sys` permissions
4. **Database**: Make sure MongoDB connection string is configured
5. **CORS**: Frontend domain should be added to CORS origins in concept_server.ts

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
