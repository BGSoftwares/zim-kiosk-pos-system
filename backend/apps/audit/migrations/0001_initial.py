from django.db import migrations, models
import django.db.models.deletion
class Migration(migrations.Migration):
 initial=True
 dependencies=[("accounts","0001_initial")]
 operations=[migrations.CreateModel(name="AuditLog",fields=[("id",models.BigAutoField(auto_created=True,primary_key=True,serialize=False,verbose_name="ID")),("action",models.CharField(max_length=100)),("entity_type",models.CharField(max_length=100)),("entity_id",models.CharField(blank=True,max_length=100)),("metadata",models.JSONField(blank=True,default=dict)),("ip_address",models.GenericIPAddressField(blank=True,null=True)),("created_at",models.DateTimeField(auto_now_add=True)),("actor",models.ForeignKey(null=True,on_delete=django.db.models.deletion.PROTECT,related_name="audit_events",to="accounts.user"))]),migrations.AlterModelOptions(name="auditlog",options={"ordering":["-created_at"]})]
