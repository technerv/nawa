from rest_framework import serializers
from .models import CrimeCategory, CrimeReportBook

class CrimeCategorySerializer(serializers.ModelSerializer):
       
    class Meta:
        model = CrimeCategory
        fields = ('id', 'crime_category', 'crime_short_code')
        
class CrimeReportBookSerializer(serializers.ModelSerializer):
    
    # the field for category_of_crime should be able to show foreign key name and not the id number
    category_of_crime = serializers.StringRelatedField()   
    
    class Meta:
        model = CrimeReportBook
        fields = ('id', 'occurance_book_number', 'name_of_crime', 'category_of_crime', 'name_of_criminal', 'criminal_id_number', 'upload_criminal_photo', 'date_created', 'date_updated')        