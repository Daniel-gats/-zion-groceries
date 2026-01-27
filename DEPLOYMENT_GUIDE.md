# 🚀 G-man Groceries - Deployment Guide

## Quick Deployment Options

### Option 1: Deploy to Render (Recommended - Free)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Go to [render.com](https://render.com) and sign up
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: zion-groceries
     - **Runtime**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
   - Click "Create Web Service"
   - Your app will be live at: `https://zion-groceries.onrender.com`

### Option 2: Deploy to Railway (Free)

1. **Push to GitHub** (same as above)

2. **Deploy on Railway:**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway auto-detects Node.js and deploys
   - Get your live URL from the dashboard

### Option 3: Deploy to Vercel

1. **Push to GitHub** (same as above)

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel auto-configures and deploys
   - Live at: `https://zion-groceries.vercel.app`

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Access the app
# Shop: http://localhost:3000
# Admin: http://localhost:3000/admin
# Health: http://localhost:3000/health
```

## Environment Variables

For production, you may want to set:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Set to 'production'

## Post-Deployment Checklist

✅ Test the main shop page  
✅ Test adding items to cart  
✅ Test WhatsApp order functionality  
✅ Test admin panel access  
✅ Verify product data is loading  
✅ Check mobile responsiveness  

## Updating Your Live Site

```bash
# Make changes to your code
git add .
git commit -m "Update: description of changes"
git push origin main
```

Your deployment platform will automatically redeploy!

## Database Options

Currently using JSON file storage. For production with multiple users, consider:
- **Supabase** (Free tier available) - Already integrated
- **MongoDB Atlas** (Free tier)
- **PostgreSQL on Render**

## Support

For issues or questions:
- Check README.md for configuration
- Review server logs in your deployment dashboard
- Ensure all required files are committed to Git

---
Made with ❤️ for G-man Groceries
