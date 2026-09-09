from django.db import models

class Purchase(models.Model):
    supplier_name = models.CharField(max_length=160)
    branch = models.ForeignKey("branches.Branch", on_delete=models.PROTECT)
    reference = models.CharField(max_length=100, unique=True)
    total = models.DecimalField(max_digits=14, decimal_places=2)
    created_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.PROTECT, related_name="items")
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2)
