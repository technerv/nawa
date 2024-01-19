from rest_framework import generics
from nawaapp.models import *
from .serializers import *

# Create your views here.

# CRIME CATEGORY APIS
class ListCrimeCategory(generics.ListAPIView): # Read
    queryset = CrimeCategory.objects.all()
    serializer_class = CrimeCategorySerializer

class DetailCrimeCategory(generics.RetrieveUpdateAPIView): # Update
    queryset = CrimeCategory.objects.all()
    serializer_class = CrimeCategorySerializer

class CreateCrimeCategory(generics.CreateAPIView): # Create
    queryset = CrimeCategory.objects.all()
    serializer_class = CrimeCategorySerializer

class DeleteCrimeCategory(generics.DestroyAPIView): # Delete
    queryset = CrimeCategory.objects.all()
    serializer_class = CrimeCategorySerializer
    
    
# CRIME REPORT BOOK APIS
class ListCrimeReportBook(generics.ListAPIView): # Read
    queryset = CrimeReportBook.objects.all()
    serializer_class = CrimeReportBookSerializer

class DetailCrimeReportBook(generics.RetrieveUpdateAPIView): # Update
    queryset = CrimeReportBook.objects.all()
    serializer_class = CrimeReportBookSerializer

class CreateCrimeReportBook(generics.CreateAPIView): # Create
    queryset = CrimeReportBook.objects.all()
    serializer_class = CrimeReportBookSerializer

class DeleteCrimeReportBook(generics.DestroyAPIView): # Delete
    queryset = CrimeReportBook.objects.all()
    serializer_class = CrimeReportBookSerializer