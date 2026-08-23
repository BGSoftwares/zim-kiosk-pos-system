from django.db import models

class AuditLog(models.Model):
    actor = models.ForeignKey("accounts.User", null=True, on_delete=models.PROTECT, related_name="audit_events")
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=100, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
