from django.db import models

class Expense(models.Model):
    branch = models.ForeignKey("branches.Branch", on_delete=models.PROTECT, related_name="expenses")
    category = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    created_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
