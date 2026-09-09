from decimal import Decimal
from django.db import models

class Inventory(models.Model):
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT, related_name="inventory_records")
    branch = models.ForeignKey("branches.Branch", on_delete=models.PROTECT, related_name="inventory")
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    reorder_level = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0"))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["product", "branch"], name="unique_product_branch_inventory")]

class StockTransaction(models.Model):
    class Type(models.TextChoices):
        SALE = "SALE", "Sale"
        PURCHASE = "PURCHASE", "Purchase"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"
        RETURN = "RETURN", "Return"

    inventory = models.ForeignKey(Inventory, on_delete=models.PROTECT, related_name="transactions")
    transaction_type = models.CharField(max_length=20, choices=Type.choices)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    reference = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey("accounts.User", null=True, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
