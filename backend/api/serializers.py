from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import User
from apps.branches.models import Branch
from apps.products.models import Product
from apps.debtors.models import Debtor


class LoginSerializer(TokenObtainPairSerializer):
    username_field = "email"

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password", "")
        try:
            user = User.objects.select_related("branch").get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active or not user.check_password(password):
            raise serializers.ValidationError("Invalid email or password.")
        self.user = user
        refresh = self.get_token(user)
        return {"access": str(refresh.access_token), "refresh": str(refresh), "user": UserSerializer(user).data}

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["branch_id"] = user.branch_id
        token["email"] = user.email
        return token


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    branch_id = serializers.IntegerField(source="branch.id", read_only=True, allow_null=True)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "phone", "branch_id", "branch", "password", "is_active"]
        read_only_fields = ["id", "branch_id"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        email = validated_data.get("email", "").strip().lower()
        user = User(**validated_data, username=email)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "code", "name", "address", "phone", "currency", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


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
        model = Debtor
        fields = ["id", "name", "phone", "credit_limit", "is_active", "balance", "created_at"]
        read_only_fields = ["id", "balance", "created_at"]

    def get_balance(self, obj):
        from django.db.models import Sum
        credit = obj.transactions.filter(transaction_type="SALE").aggregate(v=Sum("amount"))["v"] or 0
        payments = obj.transactions.filter(transaction_type="PAYMENT").aggregate(v=Sum("amount"))["v"] or 0
        adjustments = obj.transactions.filter(transaction_type="ADJUSTMENT").aggregate(v=Sum("amount"))["v"] or 0
        return credit - payments + adjustments
