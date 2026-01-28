# G-MAN GROCERIES - QUICK START GUIDE

## 🚀 Starting the Application (EASIEST WAY)

### For Windows Users:
1. **Double-click** `START_SERVER.bat`
2. The server will start automatically and open in your browser
3. That's it! 🎉

### To Stop the Server:
- **Double-click** `STOP_SERVER.bat`

---

## 📋 Alternative: Manual Start

If the batch files don't work:

```bash
cd zion-groceries
node server.js
```

Then open your browser to: http://localhost:3000

---

## 🛠️ Troubleshooting

### Problem: "Port 3000 already in use"
**Solution:** Run `STOP_SERVER.bat` first, then start again.

### Problem: Products not showing
**Solution:** 
1. Check if server is running (you should see the green messages)
2. Refresh the browser (F5 or Ctrl+R)
3. Open browser console (F12) and check for errors
4. The app has 3 fallback layers:
   - ✅ Local server `/api/products` (FIRST PRIORITY)
   - ✅ Supabase database (BACKUP)
   - ✅ Hardcoded products data (LAST RESORT)

### Problem: Images not loading
**Solution:** 
- Images are hosted on Unsplash CDN
- Check your internet connection
- If images fail, a placeholder will show

---

## 📂 Important Files

- `server.js` - Backend server
- `data/products.json` - 100 products with images
- `public/index.html` - Main website
- `public/admin.html` - Admin panel
- `public/js/app.js` - Frontend logic (NOW FIXED!)

---

## ✅ What Was Fixed Today

### Issue: Products and Images Not Displaying
**Root Cause:** The app was trying to load from Supabase first, which could fail or timeout, causing products not to display.

**Solution Implemented:**
1. ✅ Changed priority order: LOCAL SERVER → SUPABASE → FALLBACK
2. ✅ Added better error logging to console
3. ✅ Ensured all 100 products load correctly
4. ✅ Fixed image loading with fallback placeholders
5. ✅ Created startup scripts for easy launching
6. ✅ All products (50 vegetables + 50 fruits) now display

---

## 🎯 Features Working

✅ 100 products with images
✅ Category filtering (All, Vegetables, Fruits)
✅ Search functionality
✅ Shopping cart
✅ WhatsApp ordering
✅ Admin panel for managing products
✅ Auto-reply notification system
✅ Responsive design

---

## 📞 Client Setup Instructions

Send these instructions to your clients:

### Step 1: Install Node.js
Download from: https://nodejs.org/
(Choose LTS version)

### Step 2: Get the Code
1. Download the `zion-groceries` folder
2. Place it anywhere on your computer

### Step 3: Install Dependencies (ONE TIME ONLY)
Open Command Prompt in the `zion-groceries` folder and run:
```bash
npm install
```

### Step 4: Start the Application
Double-click `START_SERVER.bat`

---

## 🔧 For Deployment

### Option 1: Render.com (FREE)
1. Push code to GitHub
2. Connect to Render
3. Deploy automatically
4. Your site will be live at: `https://your-app.onrender.com`

### Option 2: Vercel (FREE)
1. Push code to GitHub
2. Import to Vercel
3. Deploy with one click

### Option 3: Railway (FREE TIER)
1. Push code to GitHub
2. Connect to Railway
3. Deploy automatically

---

## 📊 Product Count

- **Total Products:** 100
- **Vegetables:** 50
- **Fruits:** 50
- **All with images:** ✅
- **All with prices:** ✅

---

## 🆘 Support

If you encounter any issues:
1. Check the browser console (F12)
2. Check the server terminal for errors
3. Make sure port 3000 is available
4. Restart using `STOP_SERVER.bat` then `START_SERVER.bat`

---

## ✨ This Fix is PERMANENT

The code now has triple redundancy:
1. **Local Server** (fastest, most reliable)
2. **Supabase** (cloud backup)
3. **Hardcoded Data** (always works)

**You won't have to fix this again!** 🎉

---

Last Updated: January 28, 2026
Version: 2.0 (FIXED)
