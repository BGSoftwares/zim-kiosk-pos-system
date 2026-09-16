from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal
class Migration(migrations.Migration):
    initial=True
    dependencies=[("accounts","0001_initial"),("branches","0001_initial"),("sales","0001_initial")]
    operations=[
      migrations.CreateModel(name="Debtor",fields=[("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),("name",models.CharField(max_length=160)),("phone",models.CharField(blank=True,max_length=30)),("credit_limit",models.DecimalField(decimal_places=2,default=Decimal("0"),max_digits=14)),("is_active",models.BooleanField(default=True)),("created_at",models.DateTimeField(auto_now_add=True)),("branch",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="debtors",to="branches.branch"))]),
      migrations.CreateModel(name="DebtorTransaction",fields=[("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),("transaction_type",models.CharField(choices=[("SALE","Sale"),("PAYMENT","Payment"),("ADJUSTMENT","Adjustment")],max_length=20)),("amount",models.DecimalField(decimal_places=2,max_digits=14)),("currency",models.CharField(default="USD",max_length=3)),("reference",models.CharField(blank=True,max_length=100)),("created_at",models.DateTimeField(auto_now_add=True)),("created_by",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,to="accounts.user")),("debtor",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="transactions",to="debtors.debtor")),("sale",models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.PROTECT,to="sales.sale"))])]
