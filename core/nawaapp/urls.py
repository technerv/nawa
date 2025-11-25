from rest_framework.routers import DefaultRouter
from django.urls import path, include
from nawaapp import views
from .views import *

app_name = 'nawaapp'

router = DefaultRouter()
router.register('crimecategory', CrimeCategoryViewset)
router.register('crimereportbook', CrimeReportBookViewset)
# router.register('crimereportbook/map/', CrimeReportBookViewset)
router.register('crimewitness', CrimeWitnessViewset)
router.register('alertevent', AlertEventViewSet)
router.register('neighborhood', NeighborhoodViewSet)


urlpatterns = [    
    path('api/', include(router.urls))
    ,path('api/alerts/subscribe/', SubscribeAlertsView.as_view())
    ,path('api/admin/users_roles/', UsersRolesView.as_view())
    # CRIME CATEGORY API ENDPOINTS
    # path('cc/', ListCrimeCategory.as_view()), # read
    # path('cc/create/', CreateCrimeCategory.as_view()), # create
    # path('cc/<int:pk>/', DetailCrimeCategory.as_view()), # update
    # path('cc/delete/<int:pk>/', DeleteCrimeCategory.as_view()),   # delete
    
    # CRIME BOOK API ENDPOINTS
    # path('cb/', ListCrimeReportBook.as_view()), # read
    # path('cb/create/', CreateCrimeReportBook.as_view()), # create
    # path('cb/<int:pk>/', DetailCrimeReportBook.as_view()), # update
    # path('cb/delete/<int:pk>/', DeleteCrimeReportBook.as_view()), # delete
]
