# Zion Groceries

Online grocery shop for fresh produce, customer checkout, order tracking, and admin product/order management.

Live site:
`https://zion-groceries-azure.vercel.app/`

## Current Project Status

This project has been cleaned down to the runtime files only. Old setup notes, backups, seed SQL files, unused advert pages, and duplicate helpers were removed.

The active app is an Express server deployed on Vercel. It serves static pages from `public/` and API routes from `server.js`, `routes/`, `middleware/`, and `lib/`.

## Main Features

- Customer shop with category filters, search, product cards, and cart.
- Responsive mobile layout for phone screens.
- Checkout page with order creation and confirmation flow.
- Customer order tracking via `my-orders.html`.
- Login/register/dashboard pages for customer accounts.
- Admin panel for products, orders, reports, and stock alerts.
- JSON file fallback storage for local development.
- Optional PostgreSQL storage when `DATABASE_URL` is set.
- M-Pesa route support and WhatsApp order confirmation support.

## Project Structure

```text
zion-groceries/
├── server.js
├── package.json
├── package-lock.json
├── vercel.json
├── README.md
├── .env
├── .env.example
├── data/
│   ├── products.json
│   ├── products-catalog.json is in public/
│   ├── orders.json
│   ├── users.json
│   ├── reviews.json
│   └── mpesa_transactions.json
├── lib/
│   └── storage.js
├── middleware/
│   └── auth.js
├── routes/
│   ├── auth.js
│   ├── orders.js
│   ├── reviews.js
│   └── mpesa.js
└── public/
    ├── index.html
    ├── admin.html
    ├── login.html
    ├── register.html
    ├── dashboard.html
    ├── checkout.html
    ├── order-confirmation.html
    ├── my-orders.html
    ├── scan.html
    ├── logo.svg
    ├── products-catalog.json
    ├── css/
    │   └── styles.css
    └── js/
        ├── app.js
        ├── admin.js
        └── dashboard.js
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the server:

```bash
npm start
```

Open:

```text
http://localhost:3000/
http://localhost:3000/admin
```

## Environment Variables

The app loads `.env` through `dotenv`.

Important variables:

```text
PORT=3000
JWT_SECRET=...
DATABASE_URL=...
NODE_ENV=production
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_PASSKEY=...
MPESA_SHORTCODE=...
MPESA_CALLBACK_URL=https://zion-groceries-azure.vercel.app/api/mpesa/callback
MPESA_ENVIRONMENT=production
SHOP_LOCATION_LABEL=Croton Ridge Estate, Kenyatta Road / Theta, Juja
SHOP_LATITUDE=-1.1087
SHOP_LONGITUDE=37.0719
```

If `DATABASE_URL` is not set or PostgreSQL is unavailable, the app falls back to JSON files in `data/`.

Do not commit real production secrets. Use `.env.example` as the template.

Check local M-Pesa readiness without printing secrets:

```bash
npm run check:mpesa-env
```

## API Routes

Products:

```text
GET    /api/products
GET    /api/products/:id
POST   /api/products
POST   /api/products/bulk
PUT    /api/products/:id
DELETE /api/products/:id
```

Auth:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/profile
PUT  /api/auth/profile
```

Orders:

```text
POST   /api/orders
GET    /api/orders/my-orders
GET    /api/admin/orders
PUT    /api/orders/:id/status
DELETE /api/orders/:id
```

Other:

```text
GET /api/health
GET /api/products/stats/overview
GET /api/admin/inventory-alerts
GET /api/admin/reports/sales
```

## Active Frontend Pages

- `/` -> customer shop
- `/checkout.html` -> checkout form
- `/order-confirmation.html` -> receipt/confirmation
- `/my-orders.html` -> customer order tracking
- `/login.html` -> login
- `/register.html` -> registration
- `/dashboard.html` -> customer dashboard
- `/admin` or `/admin.html` -> admin panel
- `/scan.html` -> QR scan landing page

## Data Files

Local JSON storage files:

```text
data/products.json
data/orders.json
data/users.json
data/reviews.json
data/mpesa_transactions.json
```

Static fallback product catalog:

```text
public/products-catalog.json
```

When updating products manually, keep `data/products.json` and `public/products-catalog.json` in sync if the static fallback is still needed.

## Deployment

Production deploys through Vercel using `vercel.json`.

Deploy:

```bash
vercel deploy --prod --yes
```

The deployment should alias to:

```text
https://zion-groceries-azure.vercel.app/
```

## Verification

Run syntax checks before deploying:

```bash
node --check server.js
node --check public/js/app.js
node --check public/js/admin.js
node --check public/js/dashboard.js
```

Recommended live checks after deployment:

```text
/
/api/health
/api/products
/checkout.html
/admin
```

## Notes For Future Maintenance

- Keep `public/css/styles.css` mobile-first and avoid fixed widths without `max-width` or responsive `clamp()`.
- Keep product cards capped on small screens so the grid does not break phones.
- Avoid adding large documentation dumps back into the root folder.
- If temporary scripts or seed files are needed, place them in a clearly named temporary folder and remove them after use.
- Keep `node_modules/` locally if you want immediate local runs; it does not need to be deployed manually.
