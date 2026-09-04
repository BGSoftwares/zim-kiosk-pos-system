# ZIM Kiosk POS — Django + MySQL Setup Checklist

## 1. Backend environment

- [ ] Install Python 3.12+
- [ ] Install MySQL 8+
- [ ] Create `zim_kiosk` database with `utf8mb4`
- [ ] Create dedicated MySQL application user
- [ ] Copy `backend/.env.example` to `backend/.env`
- [ ] Set a strong Django secret
- [ ] Set MySQL credentials
- [ ] Set allowed hosts and CORS origins

## 2. Django

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements/base.txt
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py check
```

- [ ] Confirm Django connects to MySQL
- [ ] Confirm `/api/v1/health/` reports database `ok`

## 3. Frontend

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Create `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## 4. Authentication

- [ ] Login with a Django user
- [ ] Confirm JWT access token is issued
- [ ] Confirm refresh token works
- [ ] Confirm logout clears local session tokens
- [ ] Confirm inactive users cannot log in
- [ ] Confirm management endpoints require management roles

## 5. POS

- [ ] Products load from Django
- [ ] Barcode lookup works
- [ ] Branch inventory is displayed from the inventory API
- [ ] Checkout sends a server-side sale request
- [ ] Django recalculates totals
- [ ] Stock is locked during checkout
- [ ] Stock cannot become negative
- [ ] Sale and inventory update are atomic
- [ ] Duplicate idempotency keys do not create duplicate sales

## 6. Payments

- [ ] Cash
- [ ] EcoCash/mobile
- [ ] Card
- [ ] Bank transfer
- [ ] Credit/debt
- [ ] Split payments
- [ ] Historical currency/exchange rate is preserved

## 7. Debtors

- [ ] Create debtor
- [ ] View debtor balance
- [ ] Record debtor payment through protected backend ledger
- [ ] Prevent unauthorized branch access
- [ ] Audit debtor adjustments

## 8. Multi-branch

- [ ] Super Admin can view all branches
- [ ] Branch Manager sees only their branch
- [ ] Cashier is restricted to assigned branch
- [ ] Inventory is branch-specific
- [ ] Sales are branch-specific
- [ ] Reports respect branch permissions

## 9. Offline

- [ ] Offline queue uses IndexedDB
- [ ] No business data is stored as the authoritative localStorage database
- [ ] Every queued sale has an idempotency key
- [ ] Queue retries when connection returns
- [ ] Duplicate retry does not duplicate the sale
- [ ] Failed operations remain visible for retry/error handling

## 10. Production security

- [ ] `DEBUG=False`
- [ ] Strong `DJANGO_SECRET_KEY`
- [ ] HTTPS enabled
- [ ] Restricted `ALLOWED_HOSTS`
- [ ] Restricted CORS origins
- [ ] No secrets committed
- [ ] No MySQL credentials in frontend
- [ ] MySQL root is never used by Django
- [ ] Database backups configured
- [ ] Audit logging enabled

## 11. CI/CD

- [ ] Frontend typecheck passes
- [ ] Frontend build passes
- [ ] Django check passes
- [ ] MySQL 8 CI service starts
- [ ] Django tests pass
- [ ] Production deployment is blocked when CI fails

## Definition of done

The system is ready for production only when all critical POS, financial, security, multi-branch, offline and CI checks above pass against MySQL 8.
