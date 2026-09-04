from decimal import Decimal

from django.db import models


class Debtor(models.Model):
    name = models.CharField(max_length=160)
    phone = models.CharField(max_length=30, blank=True)
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.PROTECT,
        related_name="debtors",
    )
    credit_limit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class DebtorTransaction(models.Model):
    class Type(models.TextChoices):
        SALE = "SALE", "Sale"
        PAYMENT = "PAYMENT", "Payment"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"

    debtor = models.ForeignKey(Debtor, on_delete=models.PROTECT, related_name="transactions")
    transaction_type = models.CharField(max_length=20, choices=Type.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    sale = models.ForeignKey("sales.Sale", null=True, blank=True, on_delete=models.PROTECT)
    reference = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
