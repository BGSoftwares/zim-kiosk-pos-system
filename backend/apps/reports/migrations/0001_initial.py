from django.db import migrations, models
import django.db.models.deletion
class Migration(migrations.Migration):
 initial=True
 dependencies=[("accounts","0001_initial"),("branches","0001_initial")]
 operations=[migrations.CreateModel(name="ReportRun",fields=[("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),("report_type",models.CharField(max_length=100)),("parameters",models.JSONField(blank=True,default=dict)),("created_at",models.DateTimeField(auto_now_add=True)),("branch",models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.PROTECT,to="branches.branch")),("requested_by",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,to="accounts.user"))])]
