"""core URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from nawaapp.views import AuthMeView, RegistrationView, PublicMapView, PublicSummaryView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('nawaapp.urls')),
	# OpenAPI schema and docs
	path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
	path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
	# Auth
	path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
	path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
	path('api/auth/me/', AuthMeView.as_view(), name='auth_me'),
	path('api/auth/register/', RegistrationView.as_view(), name='auth_register'),
	# Public
	path('api/public/map/', PublicMapView.as_view(), name='public_map'),
	path('api/public/summary/', PublicSummaryView.as_view(), name='public_summary'),
]+static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
