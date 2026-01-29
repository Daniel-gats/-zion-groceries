# 🚀 Deploy Zion Groceries to Vercel

## Quick Deploy Steps

### 1. Sign Up / Login to Vercel
- Go to **https://vercel.com**
- Click **"Sign Up"** or **"Login"**
- Use your GitHub account for easy integration

### 2. Import Your Project
- Click **"Add New..."** → **"Project"**
- Click **"Import Git Repository"**
- Find and select: **`Daniel-gats/-zion-groceries`**
- Click **"Import"**

### 3. Configure Project
Vercel will auto-detect the settings:
- **Framework Preset**: Other
- **Build Command**: `npm install` (auto-detected)
- **Output Directory**: Leave blank
- **Install Command**: `npm install`

### 4. Deploy
- Click **"Deploy"**
- ⏱️ Wait 1-2 minutes for deployment
- ✅ Your site will be live!

### 5. Get Your Live URL
Your shop will be available at:
```
https://zion-groceries.vercel.app
```
Or a custom URL like:
```
https://your-project-name-randomstring.vercel.app
```

## After Deployment

### Update WhatsApp Number (Important!)
Once deployed, update the WhatsApp number in your live site:
1. Go to your Vercel dashboard
2. Navigate to your project
3. Go to **Settings** → **Environment Variables**
4. Or update directly in `public/js/app.js` and push changes

### Test Your Live Site
✅ Browse products  
✅ Add items to cart  
✅ Test WhatsApp ordering  
✅ Access admin panel at: `https://your-url.vercel.app/admin`  
✅ Check mobile responsiveness  

## Updating Your Live Site

Every time you push to GitHub, Vercel auto-deploys:
```bash
git add .
git commit -m "Update: your changes"
git push origin main
```

Vercel will automatically redeploy in ~1 minute!

## Custom Domain (Optional)

To use your own domain (e.g., www.ziongroceries.com):
1. Go to Vercel dashboard
2. Click your project
3. Go to **Settings** → **Domains**
4. Add your custom domain
5. Follow DNS setup instructions

## Performance Features on Vercel

✨ **Global CDN** - Lightning fast worldwide  
✨ **Auto-scaling** - Handles traffic spikes  
✨ **HTTPS** - Automatic SSL certificate  
✨ **Edge Network** - Low latency globally  
✨ **Analytics** - Built-in performance monitoring  

## Troubleshooting

**Issue**: Products not loading
- **Solution**: Check that `data/products.json` is committed to Git

**Issue**: Admin panel not accessible
- **Solution**: Ensure all files in `public/` folder are committed

**Issue**: Images not showing
- **Solution**: Verify image URLs are absolute (not relative paths)

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Check deployment logs in Vercel dashboard
- Review server.js for any errors

---

🎉 **Ready to deploy!** Just follow the steps above and your Zion Groceries shop will be live online!
