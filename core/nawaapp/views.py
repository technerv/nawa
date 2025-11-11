from rest_framework import generics
from rest_framework.viewsets import ModelViewSet
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import Group
from nawaapp.models import CrimeCategory, CrimeReportBook, CrimeWitness, CrimeReportBookAuditLog, AlertEvent
from .serializers import CrimeCategorySerializer, CrimeReportBookSerializer, CrimeWitnessSerializer, AlertEventSerializer
from django.conf import settings
from .permissions import IsAdminOrDispatcherOrReadOnly
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .roles import ALL_ROLES, ROLE_REPORTER, ROLE_ADMIN, ROLE_SUPERADMIN
from django.db.models import Count
from .county_aliases import COUNTY_ALIAS
from .throttles import PublicAnonRateThrottle
from .serializers import PublicCrimeReportSerializer
from .alerting import create_alert_event

# Create your views here.

# CRIME CATEGORY API
class CrimeCategoryViewset(ModelViewSet):
    serializer_class = CrimeCategorySerializer
    queryset = CrimeCategory.objects.all()    
    permission_classes = [permissions.AllowAny]
    search_fields = ['crime_category', 'crime_short_code']
    ordering_fields = ['date_created', 'date_updated', 'crime_category']
    filterset_fields = ['crime_short_code']
    
# CRIME REPORT BOOK API
class CrimeReportBookViewset(ModelViewSet):
    serializer_class = CrimeReportBookSerializer
    queryset = CrimeReportBook.objects.all()
    # Dynamic permission enforcement: AllowAny for dev unless ENFORCE_ROLE_PERMS=true
    def get_permissions(self):
        if getattr(settings, 'ENFORCE_ROLE_PERMS', False):
            # Allow Reporter, FieldOfficer, Dispatcher, Admin, and SuperAdmin to create/update
            from .permissions import IsReporterOrAbove
            permission_classes = [IsReporterOrAbove]
        else:
            permission_classes = [permissions.AllowAny]
        return [permission() for permission in permission_classes]
    filterset_fields = {
        'age': ['exact', 'gte', 'lte'],
        'date_of_arrest': ['exact', 'gte', 'lte'],
        'category_of_crime': ['exact'],
        'criminal_id_number': ['exact'],
        'status': ['exact'],
        'severity': ['exact'],
        'assigned_to': ['exact'],
        'location_name': ['exact', 'icontains'],
        'county': ['exact', 'iexact', 'icontains'],
    }
    search_fields = ['name_of_crime', 'name_of_criminal', 'occurance_book_number', 'description']
    ordering_fields = ['date_created', 'date_updated', 'age', 'date_of_arrest', 'last_status_change']

    def _create_audit_log(self, previous, instance, user, note=''):
        if not previous:
            CrimeReportBookAuditLog.objects.create(
                report=instance,
                changed_by=user if user and user.is_authenticated else None,
                from_status=None,
                to_status=instance.status,
                from_severity=None,
                to_severity=instance.severity,
                from_assigned_to=None,
                to_assigned_to=instance.assigned_to,
                note=note or 'Report created'
            )
            return

        changes = any([
            previous.status != instance.status,
            previous.severity != instance.severity,
            previous.assigned_to_id != instance.assigned_to_id
        ])

        if changes:
            CrimeReportBookAuditLog.objects.create(
                report=instance,
                changed_by=user if user and user.is_authenticated else None,
                from_status=previous.status,
                to_status=instance.status,
                from_severity=previous.severity,
                to_severity=instance.severity,
                from_assigned_to=previous.assigned_to,
                to_assigned_to=instance.assigned_to,
                note=note or ''
            )

    def perform_create(self, serializer):
        user = self.request.user if hasattr(self.request, 'user') else None
        instance = serializer.save()
        note = self.request.data.get('change_note', '')
        self._create_audit_log(None, instance, user, note)
        try:
            create_alert_event(instance, 'created', note=note or 'Report created')
        except Exception:
            pass

    def perform_update(self, serializer):
        user = self.request.user if hasattr(self.request, 'user') else None
        note = self.request.data.get('change_note', '')
        previous = CrimeReportBook.objects.get(pk=self.get_object().pk)
        instance = serializer.save()
        self._create_audit_log(previous, instance, user, note)
        try:
            evt = 'status_changed'
            if previous.status != instance.status:
                if instance.status == CrimeReportBook.STATUS_ESCALATED:
                    evt = 'escalated'
                elif instance.status in (CrimeReportBook.STATUS_RESOLVED, CrimeReportBook.STATUS_CLOSED):
                    evt = 'resolved'
            create_alert_event(instance, evt, note=note or 'Report updated')
        except Exception:
            pass
    
    @action(detail=False, methods=['get'])
    def map(self, request):
        qs = self.filter_queryset(
            self.get_queryset().exclude(latitude__isnull=True).exclude(longitude__isnull=True)
        )
        data = [
            {
                'id': obj.id,
                'occurance_book_number': obj.occurance_book_number,
                'name_of_crime': obj.name_of_crime,
                'severity': obj.severity,
                'status': obj.status,
                'latitude': float(obj.latitude),
                'longitude': float(obj.longitude),
                'location_name': obj.location_name,
                'location_description': obj.location_description,
                'date_updated': obj.date_updated,
            }
            for obj in qs
        ]
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Returns counts per county and national totals, optionally filtered by date range.
        Query params:
          - date_from (YYYY-MM-DD)
          - date_to   (YYYY-MM-DD)
        """
        qs = self.filter_queryset(self.get_queryset())
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        county_filter = request.query_params.get('county')
        if date_from:
            qs = qs.filter(date_created__date__gte=date_from)
        if date_to:
            qs = qs.filter(date_created__date__lte=date_to)
        if county_filter:
            from django.db.models import Q
            # Normalize the filter value for better matching
            filter_normalized = county_filter.strip().lower().replace(' county', '')
            # Try to match against normalized county names
            county_aliases = [k for k, v in COUNTY_ALIAS.items() if filter_normalized in k.lower() or k.lower() in filter_normalized]
            # Build a more comprehensive filter
            filter_conditions = Q(county__iexact=county_filter) | Q(location_name__iendswith=county_filter)
            # Also check if the normalized filter matches any county alias
            if county_aliases:
                for alias in county_aliases:
                    canonical = COUNTY_ALIAS.get(alias)
                    if canonical:
                        filter_conditions |= Q(county__iexact=canonical) | Q(county__icontains=canonical.replace(' County', ''))
            qs = qs.filter(filter_conditions)

        # Build rows with a county fallback derived from location_name (last token)
        # and normalize known sub-counties/constituencies to their parent county
        def normalize_county_name(name: str) -> str:
            if not name:
                return 'Unknown'
            key = name.strip().lower()
            # strip "county" suffix to improve alias matching
            key = key.replace(' county', '')
            normalized = COUNTY_ALIAS.get(key)
            if normalized:
                return normalized
            # Title-case and append "County" if it looks like a bare county name
            title = name.strip().title()
            if not title.endswith('County') and title not in ('Unknown',):
                return f'{title} County'
            return title
        raw = qs.values('county', 'location_name', 'severity')
        rows = []
        for r in raw:
            county = r['county']
            if not county:
                loc = (r.get('location_name') or '').strip()
                if loc and ',' in loc:
                    # Take the last comma-separated part as county candidate
                    county = loc.split(',')[-1].strip()
                elif loc:
                    county = loc
                else:
                    county = 'Unknown'
            county = normalize_county_name(county)
            rows.append({'county': county, 'severity': r['severity']})

        # Pivot into a dict keyed by county
        per_county = {}
        national = {'low': 0, 'medium': 0, 'high': 0, 'critical': 0, 'total': 0}
        for r in rows:
            county = r['county'] or 'Unknown'
            sev = r['severity'] or 'unknown'
            total = 1
            if county not in per_county:
                per_county[county] = {'county': county, 'low': 0, 'medium': 0, 'high': 0, 'critical': 0, 'total': 0}
            if sev in per_county[county]:
                per_county[county][sev] += total
            per_county[county]['total'] += total

            if sev in national:
                national[sev] += total
            national['total'] += total

        # If county filter is applied, only show that county
        if county_filter:
            # Normalize the filter to match the normalized county names
            normalized_filter = normalize_county_name(county_filter)
            # Filter to only show matching counties (case-insensitive match)
            filtered_counties = {}
            filter_lower = normalized_filter.lower()
            for k, v in per_county.items():
                county_lower = k.lower()
                # Match exact or if filter is contained in county name or vice versa
                if (county_lower == filter_lower or 
                    filter_lower in county_lower or 
                    county_lower in filter_lower or
                    county_lower.replace(' county', '') == filter_lower.replace(' county', '')):
                    filtered_counties[k] = v
            per_county = filtered_counties
            # Recalculate national totals from filtered counties only
            national = {'low': 0, 'medium': 0, 'high': 0, 'critical': 0, 'total': 0}
            for county_data in per_county.values():
                national['low'] += county_data['low']
                national['medium'] += county_data['medium']
                national['high'] += county_data['high']
                national['critical'] += county_data['critical']
                national['total'] += county_data['total']

        # Sort counties by total desc
        by_county = sorted(per_county.values(), key=lambda x: x['total'], reverse=True)

        return Response({
            'date_from': date_from,
            'date_to': date_to,
            'national': national,
            'by_county': by_county,
        })


class PublicMapView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = CrimeReportBook.objects.exclude(latitude__isnull=True).exclude(longitude__isnull=True)
        items = []
        def rnd(x):
            try:
                return round(float(x), 4)
            except Exception:
                return None
        for obj in qs.only('id', 'name_of_crime', 'status', 'severity', 'category_of_crime', 'location_name', 'county', 'latitude', 'longitude', 'date_updated'):
            items.append({
                'id': obj.id,
                'name_of_crime': obj.name_of_crime,
                'status': obj.status,
                'severity': obj.severity,
                'category_of_crime_name': obj.category_of_crime.crime_category if obj.category_of_crime_id else None,
                'location_name': obj.location_name,
                'county': obj.county,
                'latitude': rnd(obj.latitude),
                'longitude': rnd(obj.longitude),
                'date_updated': obj.date_updated,
            })
        return Response(items)


class PublicSummaryView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # Proxy to summary logic with same query params and rounding behavior already normalized
        viewset = CrimeReportBookViewset(request=request)
        return CrimeReportBookViewset.summary(viewset, request)

# CRIME WITNESS API
class CrimeWitnessViewset(ModelViewSet):
    serializer_class = CrimeWitnessSerializer
    queryset = CrimeWitness.objects.all()
    permission_classes = [permissions.AllowAny]
    search_fields = ['name', 'contact_information', 'statement']
    ordering_fields = ['date_created', 'date_updated', 'name']
    filterset_fields = ['crime_report']


class AuthMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        groups = list(user.groups.values_list('name', flat=True))
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'roles': groups
        })


class AlertEventViewSet(ModelViewSet):
    """API endpoint for viewing alert events (superusers only)"""
    serializer_class = AlertEventSerializer
    queryset = AlertEvent.objects.all()
    permission_classes = [permissions.IsAdminUser]  # Only superusers
    search_fields = ['incident__occurance_book_number', 'event_type', 'severity', 'county']
    ordering_fields = ['created_at', 'severity']
    filterset_fields = {
        'event_type': ['exact'],
        'severity': ['exact'],
        'county': ['exact', 'icontains'],
        'created_at': ['exact', 'gte', 'lte'],
        'incident': ['exact'],
    }
    ordering = ['-created_at']


class RegistrationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        User = get_user_model()
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()
        email = request.data.get('email', '').strip()
        role = request.data.get('role', ROLE_REPORTER)

        if not username or not password:
            return Response({'detail': 'username and password are required'}, status=status.HTTP_400_BAD_REQUEST)
        if role not in ALL_ROLES:
            role = ROLE_REPORTER

        enforce = getattr(settings, 'ENFORCE_ROLE_PERMS', False)
        if enforce and request.user and request.user.is_authenticated:
            user_groups = set(request.user.groups.values_list('name', flat=True))
            if ROLE_ADMIN not in user_groups and ROLE_SUPERADMIN not in user_groups:
                role = ROLE_REPORTER
        elif enforce:
            role = ROLE_REPORTER

        if User.objects.filter(username=username).exists():
            return Response({'detail': 'username already exists'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email or None, password=password)
        try:
            grp, _ = Group.objects.get_or_create(name=role)
            user.groups.add(grp)
        except Exception:
            pass

        refresh = RefreshToken.for_user(user)
        data = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'roles': list(user.groups.values_list('name', flat=True))
            }
        }
        return Response(data, status=status.HTTP_201_CREATED)