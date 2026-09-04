from decimal import Decimal
from django.test import TestCase
from apps.accounts.models import User
from apps.branches.models import Branch
from apps.inventory.models import Inventory
from apps.products.models import Product
from apps.payments.models import Payment
from .services import create_sale

class SaleServiceTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(code="HAR", name="Harare Main")
        self.user = User.objects.create_user(username="cashier", password="StrongPass123!", role=User.Role.CASHIER, branch=self.branch)
        self.product = Product.objects.create(sku="SKU-1", name="Test Product", selling_price=Decimal("10.00"))
        self.inventory = Inventory.objects.create(product=self.product, branch=self.branch, quantity=Decimal("10"))

    def test_sale_is_atomic_and_decrements_stock(self):
        sale = create_sale(
            cashier=self.user, branch=self.branch, currency="USD", exchange_rate=Decimal("1"),
            items=[{"product_id": self.product.id, "quantity": "2"}],
            payments=[{"method": Payment.Method.CASH, "amount": "20"}],
            idempotency_key="offline-1", receipt_number="R-1",
        )
        self.assertEqual(sale.total, Decimal("20.00"))
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, Decimal("8"))

    def test_duplicate_idempotency_key_does_not_duplicate_sale(self):
        kwargs = dict(
            cashier=self.user, branch=self.branch, currency="USD", exchange_rate=Decimal("1"),
            items=[{"product_id": self.product.id, "quantity": "1"}],
            payments=[{"method": Payment.Method.CASH, "amount": "10"}],
            idempotency_key="offline-2", receipt_number="R-2",
        )
        first = create_sale(**kwargs)
        second = create_sale(**kwargs)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(self.inventory.__class__.objects.get(pk=self.inventory.pk).quantity, Decimal("9"))

    def test_insufficient_stock_rolls_back(self):
        with self.assertRaises(ValueError):
            create_sale(
                cashier=self.user, branch=self.branch, currency="USD", exchange_rate=Decimal("1"),
                items=[{"product_id": self.product.id, "quantity": "99"}],
                payments=[{"method": Payment.Method.CASH, "amount": "990"}],
                idempotency_key="offline-3", receipt_number="R-3",
            )
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.quantity, Decimal("10"))

    def test_foreign_currency_payment_persists_rate(self):
        sale = create_sale(
            cashier=self.user, branch=self.branch, currency="USD", exchange_rate=Decimal("32"),
            items=[{"product_id": self.product.id, "quantity": "1"}],
            payments=[{"method": Payment.Method.CASH, "amount": "320", "currency": "ZIG", "exchange_rate": "32"}],
            idempotency_key="offline-fx-1", receipt_number="R-FX-1",
        )
        payment = sale.payments.get()
        self.assertEqual(payment.amount, Decimal("320.00"))
        self.assertEqual(payment.currency, "ZIG")
        self.assertEqual(payment.exchange_rate, Decimal("32.00000000"))

    def test_credit_requires_debtor_and_creates_ledger(self):
        from apps.debtors.models import Debtor, DebtorTransaction
        debtor = Debtor.objects.create(name="Test Customer", branch=self.branch, credit_limit=Decimal("100"))
        sale = create_sale(
            cashier=self.user, branch=self.branch, currency="USD", exchange_rate=Decimal("1"),
            items=[{"product_id": self.product.id, "quantity": "1"}],
            payments=[{"method": Payment.Method.CREDIT, "amount": "10"}],
            idempotency_key="credit-1", receipt_number="R-CREDIT-1", debtor_id=debtor.id,
        )
        tx = debtor.transactions.get(sale=sale)
        self.assertEqual(tx.amount, Decimal("10.00"))
        self.assertEqual(tx.currency, "USD")
        self.assertEqual(tx.transaction_type, DebtorTransaction.Type.SALE)

    def test_credit_without_debtor_is_rejected(self):
        with self.assertRaises(ValueError):
            create_sale(
                cashier=self.user, branch=self.branch, currency="USD", exchange_rate=Decimal("1"),
                items=[{"product_id": self.product.id, "quantity": "1"}],
                payments=[{"method": Payment.Method.CREDIT, "amount": "10"}],
                idempotency_key="credit-2", receipt_number="R-CREDIT-2",
            )

    def test_split_payment_reconciles_exactly(self):
        sale = create_sale(
            cashier=self.user, branch=self.branch, currency="USD", exchange_rate=Decimal("1"),
            items=[{"product_id": self.product.id, "quantity": "2"}],
            payments=[
                {"method": Payment.Method.CASH, "amount": "12"},
                {"method": Payment.Method.CARD, "amount": "8", "reference": "CARD-1"},
            ],
            idempotency_key="split-1", receipt_number="R-SPLIT-1",
        )
        self.assertEqual(sale.payments.count(), 2)
        self.assertEqual(sum(p.amount for p in sale.payments.all()), Decimal("20.00"))
