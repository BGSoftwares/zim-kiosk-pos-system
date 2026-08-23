from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import BranchViewSet, DebtorViewSet, LoginView, ProductViewSet, SaleViewSet, UserViewSet, health, me

router = DefaultRouter()
router.register("products", ProductViewSet, basename="product")
router.register("branches", BranchViewSet, basename="branch")
router.register("debtors", DebtorViewSet, basename="debtor")
router.register("sales", SaleViewSet, basename="sale")
router.register("auth/users", UserViewSet, basename="user")

urlpatterns = [
    path("health/", health, name="health"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", me, name="me"),
    path("", include(router.urls)),
]
