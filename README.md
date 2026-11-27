# ZIM KIOSK — Smart POS for Zimbabwe

Multi-branch, multi-currency point of sale with real staff accounts and role-based access.
All data lives in Supabase (Postgres); there is no demo data.

## Roles

| Role | Can open | Can do |
|---|---|---|
| **Super Admin** (`admin`) | Everything | All branches, manage staff and roles, set exchange rates, any discount |
| **Branch Manager** (`manager`) | Dashboard, POS, Inventory, Debtors, Reports, Staff (view), Settings | Own branch: sell, edit/delete products, manage debtors, any discount |
| **Cashier** (`cashier`) | Dashboard, POS, Settings | Sell (max 10% discount), sees only their own sales |
| **Storekeeper** (`storekeeper`) | Dashboard, Inventory, Settings | Add/edit stock (cannot delete products or see sales) |
| **Accountant** (`accountant`) | Dashboard, Inventory (view), Debtors, Reports, Settings | Record debtor payments, view branch sales |

The menu hides pages a role cannot use, but the real enforcement is in the database
(row-level security plus server functions), so it cannot be bypassed from the browser.

## Setup

1. **Create a Supabase project** and copy `.env.example` to `.env`:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
2. **Run the SQL** in the Supabase SQL editor, in this order:
   1. `supabase_schema.sql`
   2. `supabase_migration_roles.sql` (safe to run again)
3. **Create the first account** in Supabase → Authentication → Users → *Add user*
   (tick "Auto confirm"). The **first account ever created becomes the active Super Admin**.
4. **Install and run**
   ```bash
   npm install
   npm run dev
   ```
5. Sign in as the admin, then:
   - **Settings** → enter the ZiG and ZAR exchange rates (those currencies stay disabled until set).
   - **Inventory** → add your products.
   - **Staff** → create further users in Supabase (Authentication → Users). They appear here as
     *pending*; activate each one and choose their role and branch.

Staff cannot sign themselves up into a working account: every account after the first starts
inactive until an admin activates it.

## How sales work

The browser sends only product ids, quantities and discounts to the `create_sale` database
function. The server looks up prices, converts currency with the admin-set rate, applies the
role's discount limit, checks and locks stock, and writes the sale, items, stock log and (for
credit sales) the customer's debt in **one transaction**. A failure rolls everything back.
Reports and debts are kept in USD so sales in different currencies add up correctly.

## Database security

Run these in the Supabase SQL editor, in order: `supabase_schema.sql`, `supabase_migration_roles.sql`,
`supabase_migration_security.sql` (all safe to re-run). Note: this project uses Supabase's
PostgreSQL, not MySQL.

What the security migration enforces in the database itself (not just the app):

- The public (anon) key cannot read or write any table or call any function.
- Logged-in users get only the operations and columns the app needs. Sales, sale lines and debtor
  history are read-only from the app; they are written only by `create_sale`,
  `record_debtor_payment` and `receive_stock`.
- Debtor balances cannot be edited directly (only through a recorded payment or a credit sale).
- Stock ledger rows must be signed by the user who writes them and cannot be edited or deleted.
- The system can never be left without an active admin.
- Negative prices, stock and amounts are rejected.
- `audit_log` (admins only) records product/price changes, staff role changes, exchange-rate and
  branch changes, and debtor edits, with who did it.

Also set these in the Supabase dashboard (they cannot be set from SQL):

- Authentication → Providers → Email: minimum password length 12, and turn on leaked-password
  protection (Pro plan) if available. Turn off "Confirm email" only if you trust the signup list.
- Authentication → Rate limits: keep the defaults or tighten sign-in attempts.
- Turn on Point-in-Time Recovery / daily backups, and keep the **service_role** key out of the
  app, the repository and the APK. Only the anon key belongs in `VITE_SUPABASE_ANON_KEY`.

## Scanning (selling and receiving stock)

- **Selling:** Smart POS → **Scan barcode**. The camera stays open; every scan adds one to the cart
  (scan again for more), with a beep/vibration, then **Charge**. USB/Bluetooth scanners also work
  on the POS page without opening the camera. An unknown barcode shows an error (managers get an
  "Add product" shortcut with the barcode prefilled).
- **Receiving stock:** Inventory → **Scan to Add Stock**. Scan each delivered item (repeat scans
  add quantity), adjust quantities, then **Save stock**. An unknown barcode opens a quick
  "new product" form. Stock only changes on Save, in one transaction (`receive_stock`).
- Users who already ran `supabase_migration_roles.sql` must run it again (it is idempotent) to
  get `receive_stock`.

## Android app (APK)

The same app is wrapped with Capacitor. The APK is built by GitHub Actions
(`.github/workflows/android.yml`), because it needs the Android SDK:

1. In the GitHub repo: **Settings → Secrets and variables → Actions**, add `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY`.
2. **Actions → Android APK → Run workflow**.
3. Download the `zim-kiosk-debug-apk` artifact, unzip, copy `app-debug.apk` to the phone and open
   it (allow "install unknown apps"). Grant the camera permission on first scan.

This is a debug-signed APK, fine for your own shops. A Play Store release needs your own keystore.

## Scripts

```bash
npm run dev         # development server
npm run typecheck   # TypeScript check
npm run build       # production build
```

---

Developed by **BG Devops**. Contact: **0784654328**.
