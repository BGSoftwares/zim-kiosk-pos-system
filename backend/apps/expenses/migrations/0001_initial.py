from django.db import migrations, models
import django.db.models.deletion
class Migration(migrations.Migration):
 initial=True
 dependencies=[("accounts","0001_initial"),("branches","0001_initial")]
 operations=[migrations.CreateModel(name="Expense",fields=[("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),("category",models.CharField(max_length=100)),("description",models.TextField(blank=True)),("amount",models.DecimalField(decimal_places=2,max_digits=14)),("currency",models.CharField(default="USD",max_length=3)),("created_at",models.DateTimeField(auto_now_add=True)),("branch",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="expenses",to="branches.branch")),("created_by",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,to="accounts.user"))])]
