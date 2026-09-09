# ZIM Kiosk POS — Django + MySQL Backend

This directory is the backend foundation for the production architecture.

## Architecture

React/Vite frontend → Django REST Framework API → MySQL (InnoDB)

The browser must never connect directly to MySQL. All authentication, authorization, inventory, sales, payments, debtor and reporting business rules belong in Django.

## Planned Django applications

- `accounts` — users, roles, permissions and authentication
- `branches` — branch management and branch-scoped access
- `products` — products, categories and suppliers
- `inventory` — stock balances and stock transactions
- `sales` — sales and sale items
- `payments` — cash, EcoCash/mobile, card, bank and split payments
- `debtors` — customer credit and payment ledger
- `purchases` — purchases and receiving
- `expenses` — operating expenses
- `reports` — server-side reporting
- `audit` — immutable business audit events

## Critical transaction rule

A sale and its inventory changes must execute inside one database transaction. Inventory rows must be locked while stock is validated and decremented. The frontend total is never trusted; Django recalculates prices, discounts and totals from server-side data.

## Database

Use MySQL 8.x with InnoDB and `utf8mb4`. Credentials belong in environment variables and must never be committed.

## Migration policy

The existing React UI remains the presentation layer. Supabase calls will be replaced incrementally with versioned `/api/v1/` Django endpoints. Existing workflows should not be removed unless they are demonstrably incorrect or unsafe.
