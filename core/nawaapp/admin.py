from django.contrib import admin
from .models import CrimeCategory, CrimeReportBook, CrimeWitness, CrimeReportBookAuditLog, UserProfile, AlertSubscription, AlertEvent
# from leaflet.admin import LeafletGeoAdmin
# Register your models here.
#admin.site.register(CrimeReportBook)

@admin.register(CrimeCategory)
class CrimeCategoryModelAdmin(admin.ModelAdmin):
    list_display = ('crime_category', 'crime_short_code',)
    search_fields = ('crime_category', 'crime_short_code',)
    list_filter = ('crime_category',)
    ordering = ('crime_category',)

# admin.site.register(CrimeCategoryModelAdmin)
    
@admin.register(CrimeReportBook)
class CrimeReportBookModelAdmin(admin.ModelAdmin):
    list_display = ('occurance_book_number', 'name_of_criminal', 'status', 'severity', 'location_name', 'date_of_arrest', 'name_of_crime', 'category_of_crime',
                    'assigned_to', 'date_created', 'date_updated',)
    search_fields = ('occurance_book_number', 'name_of_crime', 'name_of_criminal', 'criminal_id_number', 'location_name',)
    list_filter = ('category_of_crime', 'status', 'severity', 'assigned_to', 'location_name', 'date_created', 'date_updated',)
    ordering = ('-date_created',)
    fieldsets = (
        (None, {
            'fields': ('occurance_book_number', 'name_of_crime', 'description', 'category_of_crime', 'status', 'severity')
        }),
        ('Location', {
            'fields': ('location_name', 'location_description', 'latitude', 'longitude')
        }),
        ('Criminal Details', {
            'fields': ('name_of_criminal', 'criminal_id_number', 'age', 'upload_criminal_photo')
        }),
        ('Workflow', {
            'fields': ('assigned_to', 'assigned_at', 'triaged_at', 'escalated_at', 'resolved_at', 'closed_at', 'last_status_change')
        }),
        ('Dates', {
            'fields': ('date_created', 'date_updated',)
        }),
    )
    readonly_fields = ('occurance_book_number', 'assigned_at', 'triaged_at', 'escalated_at', 'resolved_at', 'closed_at', 'last_status_change', 'date_created', 'date_updated',)

@admin.register(CrimeWitness)
class CrimeWitnessModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'contact_information', 'statement', 'crime_report',)
    search_fields = ('name', 'contact_information', 'crime_report',)
    list_filter = ('name', 'contact_information',)
    ordering = ('-date_created',)
    fieldsets = (
        (None, {
            'fields': ('name', 'contact_information', 'statement', 'crime_report',)
        }),
        # ('Witness Details', {
        #     'fields': ('name', 'contact_information', 'statement', 'crime_report',)
        # }),
        ('Dates', {
            'fields': ('date_created', 'date_updated',)
        }),
    )
    readonly_fields = ('date_created', 'date_updated',)


@admin.register(CrimeReportBookAuditLog)
class CrimeReportBookAuditLogAdmin(admin.ModelAdmin):
    list_display = ('report', 'from_status', 'to_status', 'from_severity', 'to_severity', 'changed_by', 'created_at')
    search_fields = ('report__occurance_book_number', 'changed_by__username', 'note')
    list_filter = ('to_status', 'to_severity', 'changed_by', 'created_at')
    readonly_fields = ('report', 'from_status', 'to_status', 'from_severity', 'to_severity', 'from_assigned_to', 'to_assigned_to', 'changed_by', 'note', 'created_at')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'county', 'on_duty', 'sms_opt_in', 'phone_number')
    list_filter = ('county', 'on_duty', 'sms_opt_in')
    search_fields = ('user__username', 'county', 'phone_number')
    list_editable = ('on_duty',)  # Quick toggle for on_duty
    fieldsets = (
        (None, {
            'fields': ('user', 'county', 'on_duty', 'sms_opt_in')
        }),
        ('Contact Info', {
            'fields': ('phone_number', 'fcm_token')
        }),
    )


@admin.register(AlertSubscription)
class AlertSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'channel', 'county', 'enabled', 'quiet_hours_start', 'quiet_hours_end', 'created_at')
    list_filter = ('channel', 'enabled', 'county')
    search_fields = ('user__username', 'county')


@admin.register(AlertEvent)
class AlertEventAdmin(admin.ModelAdmin):
    list_display = ('incident', 'event_type', 'severity', 'county', 'recipient_count', 'created_at')
    list_filter = ('event_type', 'severity', 'county', 'created_at')
    search_fields = ('incident__occurance_book_number',)
    readonly_fields = ('incident', 'event_type', 'severity', 'county', 'recipients', 'payload', 'created_at', 'dispatch_summary')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    def recipient_count(self, obj):
        return len(obj.recipients) if obj.recipients else 0
    recipient_count.short_description = 'Recipients'

    def dispatch_summary(self, obj):
        """Show dispatch results summary"""
        results = obj.payload.get('dispatch_results', {})
        if not results:
            return "No dispatch results"
        summary = []
        for uid, channels in results.items():
            success = [ch for ch, ok in channels.items() if ok]
            failed = [ch for ch, ok in channels.items() if not ok]
            if success:
                summary.append(f"User {uid}: ✓ {', '.join(success)}")
            if failed:
                summary.append(f"User {uid}: ✗ {', '.join(failed)}")
        return "\n".join(summary) if summary else "Pending dispatch"
    dispatch_summary.short_description = 'Dispatch Summary'
