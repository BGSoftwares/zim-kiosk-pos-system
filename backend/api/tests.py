from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.branches.models import Branch
from apps.debtors.models import Debtor
from apps.inventory.models import Inventory
from apps.products.models import Product
from apps.sales.models import Sale


class ApiModuleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch_a = Branch.objects.create(code="HAR", name="Harare")
        self.branch_b = Branch.objects.create(code="BUL", name="Bulawayo")
        self.cashier = User.objects.create_user(
            username="cashier@example.com", email="cashier@example.com",
            password="StrongPass123!", role=User.Role.CASHIER, branch=self.branch_a,
        )
        self.client.force_authenticate(self.cashier)
        self.product = Product.objects.create(
            sku="SKU-API", barcode="1234567890123", name="API Product",
            selling_price=Decimal("10.00"), tax_rate=Decimal("0.00"),
        )
        Inventory.objects.create(product=self.product, branch=self.branch_a, quantity=Decimal("5"))
        Inventory.objects.create(product=self.product, branch=self.branch_b, quantity=Decimal("20"))

    def test_inventory_isolation(self):
        response = self.client.get("/api/v1/inventory/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_sale_api_creates_atomic_sale(self):
        response = self.client.post("/api/v1/sales/create/", {
            "currency": "USD", "exchange_rate": "1", "idempotency_key": "api-sale-1",
            "receipt_number": "API-1", "items": [{"product_id": self.product.id, "quantity": "2"}],
            "payments": [{"method": "CASH", "amount": "20", "currency": "USD"}],
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Sale.objects.count(), 1)
        self.assertEqual(Inventory.objects.get(branch=self.branch_a, product=self.product).quantity, Decimal("3"))

    def test_credit_sale_api_passes_debtor(self):
        debtor = Debtor.objects.create(name="API Debtor", branch=self.branch_a, credit_limit=Decimal("100"))
        response = self.client.post("/api/v1/sales/create/", {
            "currency": "USD", "exchange_rate": "1", "idempotency_key": "api-credit-1",
            "receipt_number": "API-CREDIT-1", "debtor_id": debtor.id,
            "items": [{"product_id": self.product.id, "quantity": "1"}],
            "payments": [{"method": "CREDIT", "amount": "10", "currency": "USD"}],
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(debtor.transactions.count(), 1)

    def test_health_endpoint(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/v1/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok")
