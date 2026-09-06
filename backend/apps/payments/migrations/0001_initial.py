from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal
class Migration(migrations.Migration):
    initial=True
    dependencies=[("sales","0001_initial")]
    operations=[migrations.CreateModel(name="Payment",fields=[("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),("method",models.CharField(choices=[("CASH","Cash"),("ECOCASH","EcoCash/Mobile"),("CARD","Card"),("BANK","Bank Transfer"),("CREDIT","Credit/Debt")],max_length=20)),("amount",models.DecimalField(decimal_places=2,max_digits=14)),("currency",models.CharField(default="USD",max_length=3)),("exchange_rate",models.DecimalField(decimal_places=8,default=Decimal("1"),max_digits=20)),("reference",models.CharField(blank=True,max_length=100)),("created_at",models.DateTimeField(auto_now_add=True)),("sale",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="payments",to="sales.sale"))])]
