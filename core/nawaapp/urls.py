from django.urls import path
from nawaapp import views
from .views import *

app_name = 'nawaapp'

urlpatterns = [    
    # CRIME CATEGORY API ENDPOINTS
    path('cc/', ListCrimeCategory.as_view()), # read
    path('cc/create/', CreateCrimeCategory.as_view()), # create
    path('cc/<int:pk>/', DetailCrimeCategory.as_view()), # update
    path('cc/delete/<int:pk>/', DeleteCrimeCategory.as_view()),   # delete
    
    # CRIME BOOK API ENDPOINTS
    path('cb/', ListCrimeReportBook.as_view()), # read
    path('cb/create/', CreateCrimeReportBook.as_view()), # create
    path('cb/<int:pk>/', DetailCrimeReportBook.as_view()), # update
    path('cb/delete/<int:pk>/', DeleteCrimeReportBook.as_view()), # delete
]