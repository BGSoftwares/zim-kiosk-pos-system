# Django + MySQL Database Integration Guide

The POS now uses Django REST Framework as the application/data layer and MySQL 8 InnoDB as the authoritative transactional database.

## Architecture

```text
React/Vite
   |
   | JWT + HTTPS REST
   v
Django REST Framework
   |
   | Django ORM / transactions
   v
MySQL 8 InnoDB
```

React must never contain MySQL credentials or connect directly to the database.

## Local setup

### MySQL

Create a database and application user:

```sql
CREATE DATABASE zim_kiosk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'zim_kiosk'@'localhost' IDENTIFIED BY 'change-this-password';
GRANT ALL PRIVILEGES ON zim_kiosk.* TO 'zim_kiosk'@'localhost';
FLUSH PRIVILEGES;
```

For production, use a dedicated database account with only the privileges required by the application and never use the MySQL root account from Django.

### Django

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate
pip install -r requirements/base.txt
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend

Create `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Then:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Backend environment

Copy `backend/.env.example` to `backend/.env` and configure:

```env
DJANGO_SECRET_KEY=long-random-production-secret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=pos.example.com
MYSQL_DATABASE=zim_kiosk
MYSQL_USER=zim_kiosk
MYSQL_PASSWORD=strong-database-password
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
CORS_ALLOWED_ORIGINS=https://pos.example.com
```

Never commit `.env`.

## Core models

### Accounts

Django's custom `accounts.User` contains the POS roles:

- Super Admin
- Branch Manager
- Cashier
- Storekeeper
- Accountant

Users may be assigned to a branch. Branch access is enforced by the API.

### Products

Products contain SKU, barcode, cost price, selling price, tax rate and category.

Stock does **not** belong directly to Product. Stock belongs to:

```text
Inventory(product, branch, quantity)
```

This prevents incorrect stock values when the same product is sold at multiple branches.

### Sales

A sale contains:

- receipt number
- branch
- cashier
- currency
- exchange rate used at sale time
- subtotal
- discount
- tax
- total
- idempotency key
- status

Sale items preserve the price used at the time of sale.

### Payments

Payment methods include:

- Cash
- EcoCash/mobile
- Card
- Bank transfer
- Credit/debt

Multiple payment records can belong to one sale, allowing split payments.

## Atomic sales

Sales are created through Django's transactional service:

```python
transaction.atomic()
```

Inventory rows are locked using:

```python
select_for_update()
```

The transaction validates stock, calculates prices, creates the sale and line items, deducts stock, creates stock transactions and records payments. A failure rolls back the complete operation.

## Idempotency

Every sale request requires an `idempotency_key`.

The client stores a unique key for each offline/online sale attempt. Retrying the same request must return the existing sale rather than creating a duplicate transaction.

## Offline operation

The frontend uses IndexedDB as an offline queue. It is not the authoritative database.

```text
OFFLINE
  |
  v
IndexedDB PENDING
  |
  | connection restored
  v
Django API
  |
  v
MySQL atomic transaction
  |
  v
SYNCED
```

Each queued operation must have an idempotency key.

## Security

- JWT authentication is handled by Django.
- Production secrets stay on the backend.
- Branch restrictions are enforced server-side.
- Financial totals are recalculated server-side.
- Inventory updates are transactional.
- Django password hashing is used for users.
- Production uses HTTPS and secure cookie settings where applicable.

## Health check

```text
GET /api/v1/health/
```

The endpoint checks the MySQL connection with `SELECT 1` and returns a degraded response if the database is unavailable.

## Docker

The project includes Docker Compose with MySQL 8.4 and Django/Gunicorn. The backend waits for MySQL health before running migrations and starting Gunicorn.

```bash
docker compose up --build
```

Use production secrets through the shell environment or a protected deployment secret store.

## CI

GitHub Actions runs:

- `npm install`
- TypeScript check
- frontend build
- Django checks
- Django migrations
- Django tests
- MySQL 8.4 service

Before production deployment, committed Django migration files must be generated and reviewed rather than relying on CI to generate them dynamically.
