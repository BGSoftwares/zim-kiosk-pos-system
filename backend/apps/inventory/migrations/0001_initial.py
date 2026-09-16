from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal

class Migration(migrations.Migration):
    initial=True
    dependencies=[("accounts","0001_initial"),("branches","0001_initial"),("products","0001_initial")]
    operations=[
        migrations.CreateModel(name="Inventory",fields=[("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),("quantity",models.DecimalField(decimal_places=3,default=Decimal("0"),max_digits=14)),("reorder_level",models.DecimalField(decimal_places=3,default=Decimal("0"),max_digits=14)),("updated_at",models.DateTimeField(auto_now=True)),("branch",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="inventory",to="branches.branch")),("product",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="inventory_records",to="products.product"))]),
        migrations.CreateModel(name="StockTransaction",fields=[("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),("transaction_type",models.CharField(choices=[("SALE","Sale"),("PURCHASE","Purchase"),("ADJUSTMENT","Adjustment"),("RETURN","Return")],max_length=20)),("quantity",models.DecimalField(decimal_places=3,max_digits=14)),("reference",models.CharField(blank=True,max_length=100)),("created_at",models.DateTimeField(auto_now_add=True)),("created_by",models.ForeignKey(null=True,on_delete=django.db.models.deletion.PROTECT,to="accounts.user")),("inventory",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="transactions",to="inventory.inventory"))]),
        migrations.AddConstraint(model_name="inventory",constraint=models.UniqueConstraint(fields=("product","branch"),name="unique_product_branch_inventory")),
    ]
