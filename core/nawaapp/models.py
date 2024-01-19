from django.db import models
from django.contrib.gis.db import models
from django.db.models import Manager as GeoManager
# from django.db.models import manager as GeoManager

import uuid

# Create your models here.
# User Agency App Model

# Crime Category Model
class CrimeCategory(models.Model):
    crime_category = models.CharField(max_length=30, verbose_name='Crime Category')
    crime_short_code = models.CharField(max_length=4, verbose_name='Crime Short Code')
    date_created = models.DateTimeField(verbose_name="Date Created", auto_now_add=True, null=True, blank=True)
    date_updated = models.DateTimeField(verbose_name="Date Updated", auto_now=True, null=True, blank=True)
    
    def __str__(self):
        return self.crime_category
    
    class Meta:
        verbose_name_plural = "Crime Categories"

# Crime Report Model
class CrimeReportBook(models.Model):
    occurance_book_number = models.CharField(max_length=100, verbose_name='Occurance Book Number (OB Number)', blank=True, unique=True, default=uuid.uuid4, editable=False)
    name_of_crime = models.CharField(max_length=100,verbose_name='Name of Crime')
    category_of_crime = models.ForeignKey(CrimeCategory, verbose_name='Category of Crime', on_delete=models.CASCADE)
    # crime_location = models.PointField(srid=4326)
    # crime_location = models.CharField(max_length=100, verbose_name='Crime Location', null=True) # create geo cordinate feature which includes latitude and longitude
    name_of_criminal = models.CharField(max_length=60, verbose_name='Name of Criminal', null=True)
    criminal_id_number = models.IntegerField(null=True)
    upload_criminal_photo = models.ImageField(upload_to="images" , blank=True, null=True)
    date_created = models.DateTimeField(verbose_name="Date Created", auto_now_add=True, null=True, blank=True)
    date_updated = models.DateTimeField(verbose_name="Date Updated", auto_now=True, null=True, blank=True)
    # objects = GeoManager() # Geo Django GeoManager
    
    def __str__(self):
        return self.occurance_book_number
    
    class Meta:
        ordering = ['-date_updated']
        verbose_name_plural = "Crime Report Book"
