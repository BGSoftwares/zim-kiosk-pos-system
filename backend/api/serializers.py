from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.products.models import Product

class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["branch_id"] = user.branch_id
        return token

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["id", "sku", "barcode", "name", "category", "cost_price", "selling_price", "tax_rate", "unit", "is_active"]
        read_only_fields = ["id"]
