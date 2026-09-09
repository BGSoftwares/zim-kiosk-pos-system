from django.db import models

class ReportRun(models.Model):
    report_type = models.CharField(max_length=100)
    branch = models.ForeignKey("branches.Branch", null=True, blank=True, on_delete=models.PROTECT)
    requested_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT)
    parameters = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
