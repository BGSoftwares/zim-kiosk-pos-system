from django.db import connection
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.products.models import Product
from .serializers import LoginSerializer, ProductSerializer

class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer

class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    queryset = Product.objects.select_related("category").filter(is_active=True).order_by("name")

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
