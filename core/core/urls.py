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
from nawaapp.views import AuthMeView, RegistrationView, PublicMapView, PublicSummaryView, PublicReportsView, PublicSubCountiesGeoJSONView, PublicConstituenciesGeoJSONView, PublicSOSView, PublicSMSSubscribeView, PublicSMSUnsubscribeView, PublicEmergencyNumbersView, CountyAliasesView

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
    path('api/public/reports/', PublicReportsView.as_view(), name='public_reports'),
    path('api/public/subcounties_geojson/', PublicSubCountiesGeoJSONView.as_view(), name='public_subcounties_geojson'),
    path('api/public/constituencies_geojson/', PublicConstituenciesGeoJSONView.as_view(), name='public_constituencies_geojson'),
    path('api/public/sos/', PublicSOSView.as_view(), name='public_sos'),
    path('api/public/sms/subscribe/', PublicSMSSubscribeView.as_view(), name='public_sms_subscribe'),
    path('api/public/sms/unsubscribe/', PublicSMSUnsubscribeView.as_view(), name='public_sms_unsubscribe'),
    path('api/public/emergency_numbers/', PublicEmergencyNumbersView.as_view(), name='public_emergency_numbers'),
    path('api/county_aliases/', CountyAliasesView.as_view(), name='county_aliases'),
]+static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
