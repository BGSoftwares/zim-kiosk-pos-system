from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
        BRANCH_MANAGER = "BRANCH_MANAGER", "Branch Manager"
        CASHIER = "CASHIER", "Cashier"
        STOREKEEPER = "STOREKEEPER", "Storekeeper"
        ACCOUNTANT = "ACCOUNTANT", "Accountant"

    role = models.CharField(max_length=30, choices=Role.choices, default=Role.CASHIER)
    phone = models.CharField(max_length=30, blank=True)
    branch = models.ForeignKey("branches.Branch", null=True, blank=True, on_delete=models.PROTECT, related_name="users")
