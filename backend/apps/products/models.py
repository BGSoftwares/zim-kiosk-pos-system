from decimal import Decimal
from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    is_active = models.BooleanField(default=True)

class Product(models.Model):
    sku = models.CharField(max_length=60, unique=True)
    barcode = models.CharField(max_length=120, unique=True, null=True, blank=True)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="products")
    cost_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    selling_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    unit = models.CharField(max_length=30, default="unit")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
