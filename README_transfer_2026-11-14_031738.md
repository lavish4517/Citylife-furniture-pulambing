# FurniMarket — upgraded furniture marketplace

A mobile-first, Jumia-inspired furniture marketplace starter with customer shopping, seller product submissions, image uploads, administrator controls, commission calculations, and Uganda MTN/Airtel Mobile Money collection through Flutterwave.

## Included features

- Responsive furniture storefront, categories, search and sorting
- Customer registration, login, cart, checkout and order history
- Seller registration/upgrade, seller product list and product image uploads
- Admin dashboard at `/admin` for summary, product approvals, order status and commission reporting
- Configurable platform commission (default 10%) calculated per seller line in an order
- UGX checkout with cash-on-delivery option
- MTN or Airtel Uganda Mobile Money charge initiation and server-side transaction verification via Flutterwave
- Flutterwave webhook endpoint at `/api/payments/flutterwave-webhook`
- JSON file persistence for easy local testing

## Run on Android with Termux

Install Node.js in Termux if needed, then extract this ZIP and enter its `furnimarket` folder:

```bash
pkg update
pkg install nodejs-lts unzip
npm install
cp .env.example .env
nano .env
npm start
```

Open `http://127.0.0.1:3000` on the same phone. Admin dashboard: `http://127.0.0.1:3000/admin`.

## Required first security setup

Edit `.env` and set a long unique `JWT_SECRET` and a strong `ADMIN_PASSWORD` before the first server start. Default local admin values, only if no environment values are configured:

- Email: `admin@furnimarket.ug`
- Password: `ChangeMe123!`

The admin account is created on first start. Changing `ADMIN_PASSWORD` after the account already exists does not reset its password. Do not expose the default account publicly. Never upload `.env`, `data.json`, or uploaded customer data to a public GitHub repository.

## Enable MTN and Airtel Mobile Money

This project uses Flutterwave's Uganda mobile-money charge flow, which documents `MTN` and `AIRTEL` networks for UGX collections. You need a verified merchant account and API keys from Flutterwave.

1. Create/verify your merchant account and complete the provider's business/KYC requirements.
2. Enable Uganda Mobile Money in the merchant dashboard.
3. Start with TEST API keys. Copy your secret key and webhook secret hash into `.env`:

```env
FLW_SECRET_KEY=FLWSECK_TEST-...
FLW_SECRET_HASH=your_webhook_secret_hash
FLW_REDIRECT_URL=https://YOUR-PUBLIC-DOMAIN/payment-result
PUBLIC_BASE_URL=https://YOUR-PUBLIC-DOMAIN
```

4. In the Flutterwave dashboard, configure the webhook URL as `https://YOUR-PUBLIC-DOMAIN/api/payments/flutterwave-webhook` and use the same webhook secret hash in `FLW_SECRET_HASH`.
5. Deploy behind HTTPS before testing external callbacks. `127.0.0.1` is only accessible on your own device and cannot receive provider webhooks.
6. Test successful, failed, cancelled, duplicate and delayed payments before switching to live keys.

Checkout sends the customer's phone number and selected `MTN`/`AIRTEL` network to the server. The customer must approve the payment prompt on their phone. The backend verifies the transaction with Flutterwave before marking the order paid. Do not mark an order paid based only on a browser redirect or an unverified webhook.

Official provider guide: https://developer.flutterwave.com/docs/uganda

## Marketplace commission

Set `PLATFORM_COMMISSION_PERCENT=10` (or another agreed percentage from 0 to 50) in `.env`. The order records the gross seller subtotal, marketplace commission and seller net amount for each seller. The admin dashboard reports these figures. **Payouts to sellers are not automated**; they must be reconciled and paid manually until a compliant, verified payout process is built. Agree on commission, delivery responsibility, refunds, chargebacks and seller terms before launch.

## Admin dashboard

Open `/admin` and sign in using the admin account. Admin can:
- View counts, paid revenue and commission totals
- Approve or delete seller-submitted products
- Review orders and update order status
- Review per-seller gross, commission and net figures

## Image uploads

Seller dashboard supports JPG, PNG, WEBP and GIF uploads up to 5 MB. Images are stored in the local `uploads/` directory. Back up this folder. For production, move images to managed object storage/CDN and add malware scanning, image resizing and stricter upload controls.

## Important launch limitations

This is an expanded MVP, not a fully audited production marketplace. Before accepting public orders, add PostgreSQL (instead of JSON files), HTTPS, rate limiting, CSRF/security headers, robust input validation, audit trails, email/SMS notifications, privacy policy/terms, refund handling, shipping/courier integrations, tax invoices, seller verification, dispute handling, automated seller payouts and proper backup/restore. Payment provider fees and eligibility can change; confirm them with the provider. Never store or request a customer's Mobile Money PIN.

## Main project files

- `server.js` — API, authentication, order processing, payment integration and admin endpoints
- `public/index.html` — storefront
- `public/app.js` — storefront/cart/customer/seller interactions
- `public/style.css` — responsive design
- `public/admin.html` — administrator dashboard
- `public/payment-result.html` — payment return/verification screen
- `.env.example` — environment configuration template
- `uploads/` — seller product images
