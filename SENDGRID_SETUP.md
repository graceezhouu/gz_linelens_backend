# SendGrid Email Integration Setup Guide

## 📧 Setting Up Real Email Delivery with SendGrid

### Step 1: Create SendGrid Account
1. Go to [SendGrid](https://sendgrid.com/)
2. Sign up for a free account (100 emails/day free tier)
3. Verify your email address

### Step 2: Get SendGrid API Key
1. Log into your SendGrid dashboard
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Choose **Full Access** (or **Restricted Access** with Mail Send permissions)
5. Give it a name like "LineLens Email Service"
6. Copy the generated API key (starts with `SG.`)

### Step 3: Configure Sender Authentication
1. Go to **Settings** → **Sender Authentication**
2. **Option A - Single Sender Verification:**
   - Add your system email (e.g., `noreply@yourdomain.com`)
   - Verify the email address
   
3. **Option B - Domain Authentication (Recommended for production):**
   - Add your domain (e.g., `yourdomain.com`)
   - Follow DNS setup instructions

### Step 4: Configure Environment Variables

Create a `.env` file in your backend directory:

```bash
# Copy .env.example to .env
cp .env.example .env
```

Edit `.env` with your SendGrid details:
```bash
# Email Service Configuration  
SYSTEM_EMAIL=noreply@yourdomain.com  # Must match verified sender
NODE_ENV=development  # or "production"
SENDGRID_API_KEY=SG.your_actual_api_key_here
```

### Step 5: Test Email Delivery

**Development Testing** (with API key set):
```bash
# Will send real emails even in development mode
SENDGRID_API_KEY="SG.your_key" deno run --allow-net --allow-read --allow-env --allow-sys src/concept_server.ts
```

**Production Mode**:
```bash
NODE_ENV=production SENDGRID_API_KEY="SG.your_key" deno run --allow-net --allow-read --allow-env --allow-sys src/concept_server.ts
```

### Step 6: Test with curl
```bash
curl -X POST http://localhost:8000/api/VirtualCheckIn/reserveSpot \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@gmail.com", "queueID": "test-email-queue", "organizerEmail": "organizer@testevent.com"}'
```

## 🔍 Verification

### What to Expect:
- ✅ **Console Log**: "✅ Email sent successfully to user@example.com via SendGrid"
- ✅ **User Email**: Receives confirmation email with reservation details
- ✅ **Organizer Email**: Receives notification of new reservation

### Troubleshooting:

**API Key Issues:**
- Make sure API key starts with `SG.`
- Ensure Full Access or Mail Send permissions
- Check that key is not expired

**Sender Authentication:**
- System email must be verified in SendGrid
- For custom domains, complete domain authentication
- Use exact email address that's verified

**Rate Limits:**
- Free tier: 100 emails/day
- Paid plans: Higher limits available

## 🚀 Production Deployment

For production deployment:
1. Set `NODE_ENV=production`
2. Use domain authentication instead of single sender
3. Monitor SendGrid dashboard for delivery statistics
4. Set up webhook endpoints for delivery events (optional)

## 💰 SendGrid Pricing
- **Free**: 100 emails/day forever
- **Essentials**: $19.95/month for 50,000 emails/month  
- **Pro**: $89.95/month for 100,000 emails/month

## 🔐 Security Notes
- Never commit API keys to version control
- Use environment variables for all sensitive data
- Rotate API keys regularly
- Use restricted permissions when possible
