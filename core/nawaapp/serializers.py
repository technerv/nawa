from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import CrimeCategory, CrimeReportBook, CrimeWitness, CrimeReportBookAuditLog, AlertEvent
from .models import Neighborhood, NeighborhoodMember

class CrimeReportBookAuditLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()
    to_assigned_to_name = serializers.SerializerMethodField()
    from_assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = CrimeReportBookAuditLog
        fields = [
            'id',
            'from_status',
            'to_status',
            'from_severity',
            'to_severity',
            'from_assigned_to',
            'from_assigned_to_name',
            'to_assigned_to',
            'to_assigned_to_name',
            'changed_by',
            'changed_by_name',
            'note',
            'created_at'
        ]
        read_only_fields = fields

    def get_changed_by_name(self, obj):
        user = getattr(obj, 'changed_by', None)
        if not user:
            return None
        return user.get_full_name() or user.get_username()

    def get_to_assigned_to_name(self, obj):
        user = getattr(obj, 'to_assigned_to', None)
        if not user:
            return None
        return user.get_full_name() or user.get_username()

    def get_from_assigned_to_name(self, obj):
        user = getattr(obj, 'from_assigned_to', None)
        if not user:
            return None
        return user.get_full_name() or user.get_username()

    

class NeighborhoodSerializer(serializers.ModelSerializer):
    class Meta:
        model = Neighborhood
        fields = ['id', 'name', 'center_lat', 'center_lon', 'invite_code', 'polygon', 'created_at']
        read_only_fields = ['id', 'created_at']


class NeighborhoodMemberSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = NeighborhoodMember
        fields = ['id', 'neighborhood', 'user', 'user_name', 'role', 'joined_at']
        read_only_fields = ['id', 'joined_at', 'user_name']

    def get_user_name(self, obj):
        user = getattr(obj, 'user', None)
        if not user:
            return None
        return user.get_full_name() or user.get_username()

    

class CrimeCategorySerializer(serializers.ModelSerializer):

    def validate_crime_short_code(self,value):
        if len(value) !=3:
            raise serializers.ValidationError("Crime Short Code must be exactly 3 characters long")
        if not value.isalnum():
            raise serializers.ValidationError("Crime Short Code must contain only alphanumeric characters")
        return value
       
    class Meta:
        model = CrimeCategory
        fields = ('id', 'crime_category', 'crime_short_code')
        
class CrimeReportBookSerializer(serializers.ModelSerializer):

    # writable relation by id, plus readable name field
    category_of_crime = serializers.PrimaryKeyRelatedField(queryset=CrimeCategory.objects.all())
    category_of_crime_name = serializers.CharField(source='category_of_crime.crime_category', read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=get_user_model().objects.all(), allow_null=True, required=False)
    assigned_to_name = serializers.SerializerMethodField()
    audit_logs = CrimeReportBookAuditLogSerializer(many=True, read_only=True)

    def validate(self, attrs):
        latitude = attrs.get('latitude', getattr(self.instance, 'latitude', None))
        longitude = attrs.get('longitude', getattr(self.instance, 'longitude', None))
        if (latitude is None) ^ (longitude is None):
            raise serializers.ValidationError('Latitude and longitude must both be provided together.')
        if latitude is not None and not (-90 <= float(latitude) <= 90):
            raise serializers.ValidationError({'latitude': 'Latitude must be between -90 and 90.'})
        if longitude is not None and not (-180 <= float(longitude) <= 180):
            raise serializers.ValidationError({'longitude': 'Longitude must be between -180 and 180.'})
        return attrs
    
    def validate_criminal_id_number(self, value):
        if value is None:
            return value
        if not isinstance(value, int):
            raise serializers.ValidationError("Criminal ID Number must be an integer.")
        if value <= 0:
            raise serializers.ValidationError("Criminal ID Number must be a positive number.")
        return value
    
    def validate_age(self, value):
        if value <= 0:
            raise serializers.ValidationError("Age must be a positive number.")
        return value
    
    def validate_date_of_arrest(self, value):
        if value > timezone.now().date():
            raise serializers.ValidationError("Date of Arrest cannot be in the future.")
        return value

    class Meta:
        model = CrimeReportBook
        fields = [
            'id',
            'occurance_book_number',
            'date_of_arrest',
            'name_of_crime',
            'description',
            'status',
            'severity',
            'location_name',
            'location_description',
            'latitude',
            'longitude',
            'county',
            'name_of_criminal',
            'age',
            'criminal_id_number',
            'upload_criminal_photo',
            'assigned_to',
            'assigned_to_name',
            'assigned_at',
            'triaged_at',
            'escalated_at',
            'resolved_at',
            'closed_at',
            'last_status_change',
            'date_created',
            'date_updated',
            'category_of_crime',
            'category_of_crime_name',
            'audit_logs'
        ]
        read_only_fields = [
            'occurance_book_number',
            'assigned_at',
            'triaged_at',
            'escalated_at',
            'resolved_at',
            'closed_at',
            'last_status_change',
            'date_created',
            'date_updated',
            'category_of_crime_name',
            'assigned_to_name'
        ]

    def get_assigned_to_name(self, obj):
        user = getattr(obj, 'assigned_to', None)
        if not user:
            return None
        return user.get_full_name() or user.get_username()

class CrimeWitnessSerializer(serializers.ModelSerializer):
    # Create validators to validate the information in every field
    class Meta:
        model = CrimeWitness
        fields = ['id', 'name', 'contact_information', 'statement', 'crime_report']


class PublicCrimeReportSerializer(serializers.ModelSerializer):
    category_of_crime_name = serializers.CharField(source='category_of_crime.crime_category', read_only=True)
    
    class Meta:
        model = CrimeReportBook
        fields = [
            'id',
            'name_of_crime',
            'status',
            'severity',
            'category_of_crime_name',
            'location_name',
            'county',
            'latitude',
            'longitude',
            'date_updated',
        ]


class AlertEventSerializer(serializers.ModelSerializer):
    incident_ob_number = serializers.CharField(source='incident.occurance_book_number', read_only=True)
    incident_name = serializers.CharField(source='incident.name_of_crime', read_only=True)
    recipient_count = serializers.SerializerMethodField()
    dispatch_summary = serializers.SerializerMethodField()

    class Meta:
        model = AlertEvent
        fields = [
            'id',
            'incident',
            'incident_ob_number',
            'incident_name',
            'event_type',
            'severity',
            'county',
            'recipients',
            'recipient_count',
            'payload',
            'dispatch_summary',
            'created_at',
        ]
        read_only_fields = fields

    def get_recipient_count(self, obj):
        return len(obj.recipients) if obj.recipients else 0

    def get_dispatch_summary(self, obj):
        results = obj.payload.get('dispatch_results', {})
        if not results:
            return {}
        summary = {}
        for uid, channels in results.items():
            success = [ch for ch, ok in channels.items() if ok]
            failed = [ch for ch, ok in channels.items() if not ok]
            summary[uid] = {
                'success': success,
                'failed': failed,
            }
        return summary