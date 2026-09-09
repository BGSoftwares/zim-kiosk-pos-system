# ZIM Kiosk POS System

Production-oriented multi-branch retail POS for Zimbabwean businesses.

## Architecture

```text
React 19 + TypeScript + Vite
            |
            | HTTPS / REST / JWT
            v
Django REST Framework
            |
            v
MySQL 8 / InnoDB
```

The browser never connects directly to MySQL. Django owns authentication, authorization, financial calculations, inventory, sales, payments, debtors and audit records.

## Core features

- Barcode/QR product lookup
- Fast POS checkout
- Cash, EcoCash/mobile, card, bank transfer and credit payments
- Split-payment capable payment model
- Multi-branch inventory
- Stock transaction audit trail
- Customer debtors and ledger foundation
- Role-based access control
- USD, ZiG and ZAR transaction support
- Server-side financial calculations using Decimal
- Atomic sales with row-level inventory locking
- Idempotent sale creation for offline retry safety
- IndexedDB offline queue foundation

## Roles

- Super Admin
- Branch Manager
- Cashier
- Storekeeper
- Accountant

## Technology

- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Backend: Django 5.2, Django REST Framework
- Database: MySQL 8 / InnoDB
- Authentication: Django JWT
- Barcode/QR: html5-qrcode
- Charts: Recharts
- Containers: Docker / Docker Compose
- CI: GitHub Actions

## Development

### Frontend

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Set:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements/base.txt
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Configure `backend/.env` from `backend/.env.example` with the MySQL credentials.

### Docker

```bash
cp backend/.env.example .env
# Set production-safe values before starting

docker compose up --build
```

## API

Base URL:

```text
/api/v1/
```

Important endpoints:

```text
GET  /health/
POST /auth/login/
POST /auth/refresh/
GET  /auth/me/
GET  /auth/users/
GET  /products/
GET  /branches/
GET  /debtors/
GET  /sales/
POST /sales/create/
```

## Security

- MySQL credentials are server-side only.
- Production `DEBUG=False` requires `DJANGO_SECRET_KEY`.
- JWT authentication is enforced by Django REST Framework.
- Branch access is enforced server-side.
- Financial totals are recalculated by Django.
- Inventory rows are locked during sale transactions.
- Sale requests support idempotency keys.
- Secrets and `.env` files must never be committed.

## Testing

CI runs frontend TypeScript/build checks and Django checks/tests against MySQL 8.4.

Before merging:

```bash
npm run typecheck
npm run build
cd backend
python manage.py check
python manage.py test
```

## Migration status

Supabase is no longer part of the application architecture. The frontend data services communicate with Django, and MySQL is the authoritative transactional database.
