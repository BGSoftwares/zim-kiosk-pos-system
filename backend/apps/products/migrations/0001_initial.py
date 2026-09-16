from django.db import migrations, models
from decimal import Decimal
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(name="Category", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("name", models.CharField(max_length=120, unique=True)), ("is_active", models.BooleanField(default=True)),
        ]),
        migrations.CreateModel(name="Product", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("sku", models.CharField(max_length=60, unique=True)), ("barcode", models.CharField(blank=True, max_length=120, null=True, unique=True)),
            ("name", models.CharField(max_length=200)), ("cost_price", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
            ("selling_price", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)), ("tax_rate", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=5)),
            ("unit", models.CharField(default="unit", max_length=30)), ("is_active", models.BooleanField(default=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("category", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="products", to="products.category")),
        ]),
    ]
