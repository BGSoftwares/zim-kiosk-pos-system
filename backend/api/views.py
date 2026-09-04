from django.db import connection
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts.models import User
from apps.branches.models import Branch
from apps.products.models import Product
from apps.sales.models import Sale
from apps.sales.services import create_sale
from apps.debtors.models import Debtor
from apps.inventory.models import Inventory
from .serializers import BranchSerializer, CreateSaleSerializer, DebtorSerializer, InventorySerializer, LoginSerializer, ProductSerializer, SaleSerializer, UserSerializer


class IsManagementRole(BasePermission):
    allowed_roles = {User.Role.SUPER_ADMIN, User.Role.BRANCH_MANAGER}

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in self.allowed_roles)


class IsStockManagementRole(BasePermission):
    allowed_roles = {User.Role.SUPER_ADMIN, User.Role.BRANCH_MANAGER, User.Role.STOREKEEPER}

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in self.allowed_roles)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsManagementRole]
    queryset = User.objects.select_related("branch").order_by("email")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role != User.Role.SUPER_ADMIN and self.request.user.branch_id:
            qs = qs.filter(branch_id=self.request.user.branch_id)
        return qs

    def perform_create(self, serializer):
        if self.request.user.role != User.Role.SUPER_ADMIN:
            serializer.save(branch=self.request.user.branch)
        else:
            serializer.save()


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    queryset = Product.objects.select_related("category").filter(is_active=True).order_by("name")

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        barcode = self.request.query_params.get("barcode")
        sku = self.request.query_params.get("sku")
        if q:
            queryset = queryset.filter(Q(name__icontains=q) | Q(sku__icontains=q) | Q(barcode__icontains=q))
        if barcode:
            queryset = queryset.filter(barcode=barcode)
        if sku:
            queryset = queryset.filter(sku=sku)
        return queryset

    def get_permissions(self):
        if self.request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            return [IsStockManagementRole()]
        return [IsAuthenticated()]


class BranchViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BranchSerializer
    permission_classes = [IsAuthenticated]
    queryset = Branch.objects.filter(is_active=True).order_by("name")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role != User.Role.SUPER_ADMIN and self.request.user.branch_id:
            qs = qs.filter(id=self.request.user.branch_id)
        return qs


class InventoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventorySerializer
    permission_classes = [IsAuthenticated]
    queryset = Inventory.objects.select_related("product", "branch").order_by("product__name")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role != User.Role.SUPER_ADMIN and self.request.user.branch_id:
            qs = qs.filter(branch_id=self.request.user.branch_id)
        product_id = self.request.query_params.get("product_id")
        barcode = self.request.query_params.get("barcode")
        sku = self.request.query_params.get("sku")
        if product_id:
            qs = qs.filter(product_id=product_id)
        if barcode:
            qs = qs.filter(product__barcode=barcode)
        if sku:
            qs = qs.filter(product__sku=sku)
        return qs


class DebtorViewSet(viewsets.ModelViewSet):
    serializer_class = DebtorSerializer
    permission_classes = [IsAuthenticated]
    queryset = Debtor.objects.select_related("branch").filter(is_active=True).order_by("name")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role != User.Role.SUPER_ADMIN and self.request.user.branch_id:
            qs = qs.filter(branch_id=self.request.user.branch_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(branch=self.request.user.branch)


class SaleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    queryset = Sale.objects.select_related("branch", "cashier").prefetch_related("items__product").order_by("-created_at")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role != User.Role.SUPER_ADMIN and self.request.user.branch_id:
            qs = qs.filter(branch_id=self.request.user.branch_id)
        start = self.request.query_params.get("created_at__gte")
        end = self.request.query_params.get("created_at__lte")
        if start:
            qs = qs.filter(created_at__gte=start)
        if end:
            qs = qs.filter(created_at__lte=end)
        return qs

    @action(detail=False, methods=["post"], url_path="create")
    def create_transaction(self, request):
        serializer = CreateSaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.branch_id:
            return Response({"detail": "Cashier is not assigned to a branch."}, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        try:
            sale = create_sale(cashier=request.user, branch=request.user.branch, currency=data["currency"].upper(), exchange_rate=data["exchange_rate"], items=data["items"], payments=data["payments"], idempotency_key=data["idempotency_key"], receipt_number=data["receipt_number"], discount=data.get("discount", 0))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return Response({"status": "ok", "database": "ok", "service": "zim-kiosk-api"})
    except Exception:
        return Response({"status": "degraded", "database": "unavailable", "service": "zim-kiosk-api"}, status=503)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)
