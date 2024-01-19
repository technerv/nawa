from django.contrib import admin
from .models import CrimeCategory, CrimeReportBook
# from leaflet.admin import LeafletGeoAdmin
# Register your models here.
#admin.site.register(CrimeReportBook)


@admin.register(CrimeCategory)
class CrimeCategoryModelAdmin(admin.ModelAdmin):
    list_display = ('crime_category', 'crime_short_code',)

# admin.site.register(CrimeCategoryModelAdmin)
    
@admin.register(CrimeReportBook)
class CrimeReportBookModelAdmin(admin.ModelAdmin):
    # pass
    list_display = ('occurance_book_number', 'name_of_crime', 'category_of_crime',
                    'name_of_criminal', 'criminal_id_number', 'upload_criminal_photo', 'date_created', 'date_updated',)