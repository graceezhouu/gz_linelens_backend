# 🔐 Security Guide: Environment Variables

## ⚠️ CRITICAL SECURITY RULES

### ❌ NEVER DO THIS:
- ❌ Never commit `.env` files with real credentials to Git
- ❌ Never put passwords, API keys, or database URLs in code
- ❌ Never share your MongoDB connection string publicly
- ❌ Never commit files like `.env.production` with real values

### ✅ ALWAYS DO THIS:
- ✅ Keep `.env` in `.gitignore`
- ✅ Use template files (like `.env.example`) without real values
- ✅ Set environment variables in your deployment platform
- ✅ Use different credentials for development vs production

## 🛡️ Your Current Security Setup

### Files in Git (safe to commit):
- ✅ `.env.example` - Template without real values
- ✅ `.env.local` - Template for local development
- ✅ `.env.production` - Template for production (no real values)

### Files NOT in Git (contains real secrets):
- 🔒 `.env` - Your actual environment variables (ignored by Git)
- 🔒 Any `.env.*` files with real credentials

## 🚀 Deployment Security

### For your deployment platform, set these environment variables:

```bash
# Database (use your actual values in deployment platform only)
MONGODB_URL=mongodb+srv://gracez03:Seanbryden201124772@gz-1040-backend.8rmljiw.mongodb.net/?retryWrites=true&w=majority&appName=gz-1040-backend
DB_NAME=gz-1040-backend

# Server
NODE_ENV=production
PORT=8000

# Email (optional)
SYSTEM_EMAIL=noreply@linelens.com
```

### Platform-Specific Instructions:

#### Render:
1. Go to your service dashboard
2. Click "Environment" tab  
3. Add each variable individually

#### Railway:
1. Go to your project
2. Click "Variables" tab
3. Add each environment variable

#### Deno Deploy:
1. Go to project settings
2. Click "Environment Variables"
3. Add each variable

## 🔧 If You Accidentally Committed Secrets

If you've already pushed credentials to Git:

1. **Change your MongoDB password immediately**
2. **Rotate any API keys**
3. **Remove the commit from Git history**:
   ```bash
   git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env' --prune-empty --tag-name-filter cat -- --all
   git push origin --force --all
   ```

## ✅ Security Checklist

Before pushing to Git:
- [ ] `.env` is in `.gitignore`
- [ ] No real passwords in any committed files
- [ ] Template files use placeholder values only
- [ ] Real environment variables set in deployment platform
- [ ] Different credentials for dev/prod environments

## 🎯 Quick Security Check

Run this to verify no secrets are being tracked:
```bash
git status --ignored | grep -E "\.env"
```

If you see any `.env` files listed under "Changes to be committed", **DO NOT PUSH!**

Your secrets are safe as long as you follow these rules! 🔐
