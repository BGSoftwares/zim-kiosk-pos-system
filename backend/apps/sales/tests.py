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
