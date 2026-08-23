from django.db import connection
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.branches.models import Branch
from apps.products.models import Product
from apps.sales.models import Sale
from apps.sales.services import create_sale
from apps.debtors.models import Debtor
from .serializers import (
    CreateSaleSerializer,
    DebtorSerializer,
    LoginSerializer,
    ProductSerializer,
    SaleSerializer,
    UserSerializer,
)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    queryset = Product.objects.select_related("category").filter(is_active=True).order_by("name")

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            queryset = queryset.filter(Q(name__icontains=q) | Q(sku__icontains=q) | Q(barcode__icontains=q))
        return queryset


class BranchViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = None
    permission_classes = [IsAuthenticated]
    queryset = Branch.objects.filter(is_active=True).order_by("name")

    def list(self, request, *args, **kwargs):
        branches = self.get_queryset()
        if request.user.role != request.user.Role.SUPER_ADMIN and request.user.branch_id:
            branches = branches.filter(id=request.user.branch_id)
        return Response([
            {"id": b.id, "code": b.code, "name": b.name, "address": b.address, "phone": b.phone, "currency": b.currency}
            for b in branches
        ])


class DebtorViewSet(viewsets.ModelViewSet):
    serializer_class = DebtorSerializer
    permission_classes = [IsAuthenticated]
    queryset = Debtor.objects.filter(is_active=True).order_by("name")


class SaleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    queryset = Sale.objects.select_related("branch", "cashier").prefetch_related("items__product").order_by("-created_at")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role != self.request.user.Role.SUPER_ADMIN and self.request.user.branch_id:
            qs = qs.filter(branch_id=self.request.user.branch_id)
        return qs

    @action(detail=False, methods=["post"], url_path="create")
    def create_transaction(self, request):
        serializer = CreateSaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.branch_id:
            return Response({"detail": "Cashier is not assigned to a branch."}, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        try:
            sale = create_sale(
                cashier=request.user,
                branch=request.user.branch,
                currency=data["currency"].upper(),
                exchange_rate=data["exchange_rate"],
                items=data["items"],
                payments=data["payments"],
                idempotency_key=data["idempotency_key"],
                receipt_number=data["receipt_number"],
                discount=data.get("discount", 0),
            )
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
