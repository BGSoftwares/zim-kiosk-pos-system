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

## Scripts

```bash
npm run dev         # development server
npm run typecheck   # TypeScript check
npm run build       # production build
```
