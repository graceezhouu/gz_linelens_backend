# MongoDB Deployment Troubleshooting Guide

## 🚨 Common MongoDB Deployment Errors

### Error: "Could not find environment variable: MONGODB_URL"

**Problem**: The MongoDB connection string environment variable is not set.

**Solutions**:

1. **Set the environment variable** in your deployment platform:
   ```bash
   MONGODB_URL=mongodb://your_connection_string
   ```

2. **Alternative environment variable names** (the app now supports these):
   - `MONGODB_URL` (preferred)
   - `MONGODB_URI` 
   - `DATABASE_URL`
   - `MONGO_URL`

3. **For different deployment platforms**:

   **Render**:
   - Go to your service dashboard
   - Click "Environment" tab
   - Add: `MONGODB_URL` = `your_connection_string`

   **Railway**:
   - Go to your project variables
   - Add: `MONGODB_URL` = `your_connection_string`

   **Deno Deploy**:
   - Go to project settings
   - Add environment variable: `MONGODB_URL`

   **Heroku**:
   ```bash
   heroku config:set MONGODB_URL=your_connection_string
   ```

## 📊 MongoDB Connection String Formats

### Local MongoDB:
```bash
MONGODB_URL=mongodb://localhost:27017/linelens
```

### MongoDB Atlas (Cloud):
```bash
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/linelens?retryWrites=true&w=majority
```

### MongoDB with Authentication:
```bash
MONGODB_URL=mongodb://username:password@host:port/database
```

## 🔧 Quick Setup with MongoDB Atlas

1. **Create Atlas Account**: Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **Create Cluster**: Choose free tier
3. **Create Database User**: 
   - Username: `linelens-user`
   - Password: Generate strong password
4. **Whitelist IP**: Add `0.0.0.0/0` for all IPs (or your deployment platform's IPs)
5. **Get Connection String**: 
   - Click "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your actual password
6. **Set Environment Variable**: Use the connection string as `MONGODB_URL`

## ✅ Verify Database Connection

After deployment, check your logs for:
```
🔗 Connecting to MongoDB...
✅ MongoDB connected successfully
📊 Using database: linelens
```

If you see this, your database connection is working!

## 🆘 Still Having Issues?

1. **Check your connection string format**
2. **Verify database user permissions**
3. **Ensure IP whitelist includes your deployment platform**
4. **Test the connection string locally first**:
   ```bash
   MONGODB_URL="your_connection_string" deno task start
   ```

## 📱 Platform-Specific MongoDB Add-ons

### Render:
- No built-in MongoDB, use Atlas or external provider

### Railway:
- MongoDB plugin available in marketplace
- Automatically sets `DATABASE_URL`

### Heroku:
- mLab MongoDB add-on: `heroku addons:create mongolab`
- Sets `MONGODB_URI` automatically

Your deployment should now work with proper MongoDB configuration! 🚀
