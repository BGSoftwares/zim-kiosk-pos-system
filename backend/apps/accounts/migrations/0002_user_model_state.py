from django.db import migrations, models
from django.contrib.auth.models import UserManager

class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]
    operations = [
        migrations.AlterModelOptions(name="user", options={"verbose_name": "user", "verbose_name_plural": "users"}),
        migrations.AlterModelManagers(name="user", managers=[("objects", UserManager())]),
        migrations.AlterField(name="date_joined", model_name="user", field=models.DateTimeField(auto_now_add=True, verbose_name="date joined")),
    ]
