from decimal import Decimal
from django.db import models


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH = "CASH", "Cash"
        ECOCASH = "ECOCASH", "EcoCash/Mobile"
        CARD = "CARD", "Card"
        BANK = "BANK", "Bank Transfer"
        CREDIT = "CREDIT", "Credit/Debt"

    sale = models.ForeignKey("sales.Sale", on_delete=models.PROTECT, related_name="payments")
    method = models.CharField(max_length=20, choices=Method.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    exchange_rate = models.DecimalField(max_digits=20, decimal_places=8, default=Decimal("1"))
    reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
