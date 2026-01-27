# 🥬 Zion Groceries

An online shop for fresh vegetables and fruits with WhatsApp ordering.

## Features

### Customer Features
- 🛒 Browse products by category (Vegetables, Fruits)
- 🔍 Search products
- 🛍️ Add to cart with quantity selection
- 📱 Order via WhatsApp with one click
- 💾 Cart persists in browser (localStorage)
- 📱 Fully responsive design

### Admin Features
- ➕ Add new products
- ✏️ Edit existing products
- 🗑️ Delete products
- 📊 View statistics (total products, low stock items)
- 🔍 Search products

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. Clone or download this project
2. Navigate to the project folder:
   ```bash
   cd zion-groceries
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open your browser and visit:
   - **Shop**: http://localhost:3000
   - **Admin**: http://localhost:3000/admin

## Configuration

### WhatsApp Number
The WhatsApp number is configured in `public/js/app.js`:
```javascript
const CONFIG = {
    whatsappNumber: '254745562238', // Current WhatsApp number
    currency: 'KSh'
};
```

**Note**: Use international format without + or spaces (e.g., `254712345678` for Kenya)

## Deployment

### Deploy to Render (Free)

1. Push your code to GitHub
2. Go to [render.com](https://render.com) and sign up
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: zion-groceries
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Click "Create Web Service"

### Deploy to Railway (Free)

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) and sign up
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect Node.js and deploy

## Project Structure

```
zion-groceries/
├── server.js              # Express server & API routes
├── package.json           # Dependencies
├── data/
│   └── products.json      # Product database
├── public/
│   ├── index.html         # Main shop page
│   ├── admin.html         # Admin panel
│   ├── css/
│   │   └── styles.css     # Shop styles
│   └── js/
│       ├── app.js         # Shop functionality
│       └── admin.js       # Admin functionality
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Get all products |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Add new product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

## Technologies Used

- **Backend**: Node.js, Express
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Database**: JSON file storage
- **Icons**: Font Awesome
- **Fonts**: Google Fonts (Poppins)

## License

MIT License - Feel free to use for your own projects!

---

Made with ❤️ for Zion Groceries
