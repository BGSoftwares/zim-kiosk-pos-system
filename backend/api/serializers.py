from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import User
from apps.products.models import Product


class LoginSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        user = authenticate(request=self.context.get("request"), username=email, password=password)
        if not user or not user.is_active:
            raise serializers.ValidationError("Invalid email or password.")
        self.user = user
        data = self.get_token(user)
        return {
            "access": str(data.access_token),
            "refresh": str(data),
            "user": UserSerializer(user).data,
        }

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["branch_id"] = user.branch_id
        token["email"] = user.email
        return token


class UserSerializer(serializers.ModelSerializer):
    branch_id = serializers.UUIDField(source="branch.id", read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "phone", "branch_id", "is_active"]
        read_only_fields = ["id", "branch_id"]


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["id", "sku", "barcode", "name", "category", "cost_price", "selling_price", "tax_rate", "unit", "is_active"]
        read_only_fields = ["id"]


class SaleItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=0.001)


class PaymentInputSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=["CASH", "ECOCASH", "CARD", "BANK", "CREDIT"])
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0)
    currency = serializers.CharField(max_length=3, required=False)
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True)


class CreateSaleSerializer(serializers.Serializer):
    currency = serializers.CharField(max_length=3)
    exchange_rate = serializers.DecimalField(max_digits=18, decimal_places=6, min_value=0.000001)
    idempotency_key = serializers.CharField(max_length=100)
    receipt_number = serializers.CharField(max_length=50)
    discount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0, required=False, default=0)
    items = SaleItemInputSerializer(many=True, min_length=1)
    payments = PaymentInputSerializer(many=True, min_length=1)


class SaleItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(source="product.id")
    product_name = serializers.CharField(source="product.name")
    quantity = serializers.DecimalField(max_digits=14, decimal_places=3)
    unit_price = serializers.DecimalField(max_digits=14, decimal_places=2)
    discount = serializers.DecimalField(max_digits=14, decimal_places=2)
    tax = serializers.DecimalField(max_digits=14, decimal_places=2)
    line_total = serializers.DecimalField(max_digits=14, decimal_places=2)


class SaleSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    receipt_number = serializers.CharField()
    branch_id = serializers.IntegerField(source="branch.id")
    cashier_id = serializers.IntegerField(source="cashier.id")
    currency = serializers.CharField()
    exchange_rate = serializers.DecimalField(max_digits=18, decimal_places=6)
    subtotal = serializers.DecimalField(max_digits=14, decimal_places=2)
    discount = serializers.DecimalField(max_digits=14, decimal_places=2)
    tax = serializers.DecimalField(max_digits=14, decimal_places=2)
    total = serializers.DecimalField(max_digits=14, decimal_places=2)
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    items = SaleItemSerializer(many=True, read_only=True)


class DebtorSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        from apps.debtors.models import Debtor
        model = Debtor
        fields = ["id", "name", "phone", "credit_limit", "is_active", "balance", "created_at"]
        read_only_fields = ["id", "balance", "created_at"]

    def get_balance(self, obj):
        from django.db.models import Sum
        credit = obj.transactions.filter(transaction_type="SALE").aggregate(v=Sum("amount"))["v"] or 0
        payments = obj.transactions.filter(transaction_type="PAYMENT").aggregate(v=Sum("amount"))["v"] or 0
        adjustments = obj.transactions.filter(transaction_type="ADJUSTMENT").aggregate(v=Sum("amount"))["v"] or 0
        return credit - payments + adjustments
