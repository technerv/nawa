from rest_framework import generics
from rest_framework.viewsets import ModelViewSet
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import Group
from nawaapp.models import CrimeCategory, CrimeReportBook, CrimeWitness, CrimeReportBookAuditLog, AlertEvent
from .serializers import CrimeCategorySerializer, CrimeReportBookSerializer, CrimeWitnessSerializer, AlertEventSerializer
from .serializers import NeighborhoodSerializer, NeighborhoodMemberSerializer
from .serializers import NeighborhoodMessageSerializer
from django.conf import settings
from .permissions import IsAdminOrDispatcherOrReadOnly
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .roles import ALL_ROLES, ROLE_SUPERADMIN, ROLE_SECURITY_ORG, ROLE_ADMIN, ROLE_REPORTER, ROLE_ANALYST, ROLE_SUPERVISOR, ROLE_EXTERNAL
from .org_access import get_org_filter, filter_queryset_by_org, can_access_report, is_superadmin, is_security_org_user, get_user_organization
from django.db.models import Count
from .county_aliases import COUNTY_ALIAS
from .throttles import PublicAnonRateThrottle
from .serializers import PublicCrimeReportSerializer
from rest_framework.pagination import PageNumberPagination
from .alerting import create_alert_event
from .models import Neighborhood, NeighborhoodMember, AlertSubscription, NeighborhoodMessage
from django.utils import timezone
from datetime import timedelta
from django.core.exceptions import ValidationError

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
            act = getattr(self, 'action', None)
            if act in ('list', 'retrieve', 'map'):
                from .permissions import AllowReadUnlessAnalystOnCases
                permission_classes = [permissions.IsAuthenticated, AllowReadUnlessAnalystOnCases]
            elif act in ('create',):
                from .permissions import IsReporterOrAbove
                permission_classes = [permissions.IsAuthenticated, IsReporterOrAbove]
            elif act in ('update', 'partial_update'):
                from .permissions import IsFieldOfficerOrAbove
                permission_classes = [permissions.IsAuthenticated, IsFieldOfficerOrAbove]
            elif act in ('destroy',):
                from .permissions import IsAdminOrSupervisor
                permission_classes = [permissions.IsAuthenticated, IsAdminOrSupervisor]
            else:
                permission_classes = [permissions.IsAuthenticated]
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

    def get_queryset(self):
        qs = CrimeReportBook.objects.all()
        if getattr(self, '_public', False):
            return qs
        
        user = getattr(self.request, 'user', None)
        
        # Apply organization-based access control
        # SuperAdmin sees all, Security Org Users see only their org's reports
        if user and user.is_authenticated:
            # SuperAdmin bypasses org filtering
            if is_superadmin(user):
                pass  # No filtering for SuperAdmin
            # Security Org Users only see their organization's reports
            elif is_security_org_user(user):
                qs = filter_queryset_by_org(qs, user)
            # Other authenticated users see nothing (unless explicitly allowed)
            else:
                # Legacy role-based filtering for backward compatibility
                enforce = getattr(settings, 'ENFORCE_ROLE_PERMS', False)
                if enforce:
                    try:
                        groups = set(user.groups.values_list('name', flat=True))
                        act = getattr(self, 'action', None)
                        if ROLE_ANALYST in groups and act in ('list', 'retrieve', 'map'):
                            return CrimeReportBook.objects.none()
                        if ROLE_EXTERNAL in groups and act in ('list', 'retrieve', 'map'):
                            return qs.filter(assigned_to=user)
                    except Exception:
                        pass
                else:
                    # If not enforcing role perms, non-org users see nothing
                    return CrimeReportBook.objects.none()
        else:
            # Unauthenticated users see nothing (except public endpoints)
            return CrimeReportBook.objects.none()
        
        return qs

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
        
        # Auto-assign organization if security org user created the report and it's not already assigned
        if user and user.is_authenticated and is_security_org_user(user):
            if not instance.assigned_organization:
                org = get_user_organization(user)
                if org:
                    instance.assigned_organization = org
                    # Also assign to the user if not already assigned
                    if not instance.assigned_to:
                        instance.assigned_to = user
                    instance.save()
        
        note = self.request.data.get('change_note', '')
        self._create_audit_log(None, instance, user, note)
        try:
            create_alert_event(instance, 'created', note=note or 'Report created')
            # Send WebSocket notification
            from .websocket_utils import send_alert_to_websocket
            send_alert_to_websocket({
                'id': instance.id,
                'type': 'new_report',
                'severity': instance.severity,
                'status': instance.status,
                'location': instance.location_name,
                'county': instance.county,
                'ob_number': instance.occurance_book_number,
                'timestamp': instance.date_created.isoformat() if instance.date_created else None,
            })
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
                'category_of_crime_name': getattr(obj, 'category_of_crime_name', (obj.category_of_crime.crime_category if obj.category_of_crime_id else None)),
                'severity': obj.severity,
                'status': obj.status,
                'latitude': float(obj.latitude),
                'longitude': float(obj.longitude),
                'location_name': obj.location_name,
                'location_description': obj.location_description,
                'county': obj.county,
                'date_updated': obj.date_updated,
            }
            for obj in qs
        ]
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Stats endpoint for Security Org Users (org-specific)"""
        from django.db.models import Count, Q, Avg, F
        from django.utils import timezone
        from datetime import timedelta
        
        # Get user's organization if Security Org User
        user_groups = set(request.user.groups.values_list('name', flat=True))
        if ROLE_SECURITY_ORG not in user_groups and ROLE_SUPERADMIN not in user_groups:
            return Response({'detail': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Filter by organization if Security Org User (not SuperAdmin)
        org_filter = Q()
        if ROLE_SUPERADMIN not in user_groups:
            # For Security Org Users, filter by their organization's reports
            # This would need to be implemented based on how reports are associated with orgs
            # For now, return all reports (can be refined later)
            pass
        
        # Calculate stats
        total = CrimeReportBook.objects.filter(org_filter).count()
        pending = CrimeReportBook.objects.filter(org_filter, status=CrimeReportBook.STATUS_SUBMITTED).count()
        in_progress = CrimeReportBook.objects.filter(
            org_filter,
            status__in=[CrimeReportBook.STATUS_IN_PROGRESS, CrimeReportBook.STATUS_TRIAGED]
        ).count()
        resolved = CrimeReportBook.objects.filter(
            org_filter,
            status__in=[CrimeReportBook.STATUS_RESOLVED, CrimeReportBook.STATUS_CLOSED]
        ).count()
        
        # Calculate average response time (time from submitted to acknowledged/in_progress)
        avg_response_time = None
        try:
            resolved_reports = CrimeReportBook.objects.filter(
                org_filter,
                status__in=[CrimeReportBook.STATUS_RESOLVED, CrimeReportBook.STATUS_CLOSED],
                date_updated__isnull=False,
                date_created__isnull=False
            )[:100]  # Sample first 100 for performance
            if resolved_reports.exists():
                response_times = []
                for report in resolved_reports:
                    if report.date_created and report.date_updated:
                        delta = report.date_updated - report.date_created
                        response_times.append(delta.total_seconds() / 60)  # Convert to minutes
                if response_times:
                    avg_response_time = sum(response_times) / len(response_times)
        except Exception:
            pass
        
        # SLA compliance (simplified: % resolved within 24 hours)
        sla_compliance = None
        try:
            last_30_days = timezone.now() - timedelta(days=30)
            recent_resolved = CrimeReportBook.objects.filter(
                org_filter,
                status__in=[CrimeReportBook.STATUS_RESOLVED, CrimeReportBook.STATUS_CLOSED],
                date_updated__gte=last_30_days
            )[:100]
            if recent_resolved.exists():
                within_sla = 0
                total_recent = recent_resolved.count()
                for report in recent_resolved:
                    if report.date_created and report.date_updated:
                        delta = report.date_updated - report.date_created
                        if delta.total_seconds() <= 24 * 3600:  # 24 hours
                            within_sla += 1
                if total_recent > 0:
                    sla_compliance = (within_sla / total_recent) * 100
        except Exception:
            pass
        
        return Response({
            'total': total,
            'pending': pending,
            'in_progress': in_progress,
            'resolved': resolved,
            'avg_response_time': round(avg_response_time, 1) if avg_response_time else None,
            'sla_compliance': round(sla_compliance, 1) if sla_compliance else None,
        })

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Returns counts per county and national totals, optionally filtered by date range.
        Query params:
          - date_from (YYYY-MM-DD)
          - date_to   (YYYY-MM-DD)
        """
        qs = self.filter_queryset(self.get_queryset())
        try:
            CANONICAL_COUNTIES = set(COUNTY_ALIAS.values())
        except Exception:
            CANONICAL_COUNTIES = set()
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
            import re
            key = str(name).strip().lower()
            key = re.sub(r"\s+county$", "", key)
            base = key.replace('_', ' ').replace('-', ' ')
            base = re.sub(r"\s+", " ", base).strip()
            if base:
                v = COUNTY_ALIAS.get(base)
                if v:
                    return v
                dashed = base.replace(' ', '-')
                v = COUNTY_ALIAS.get(dashed)
                if v:
                    return v
            # Try substring match for base county names inside the text
            try:
                for alias_key, canonical in COUNTY_ALIAS.items():
                    ak = str(alias_key or '').strip().lower()
                    if not ak:
                        continue
                    if ak in base:
                        return canonical
            except Exception:
                pass
            title = str(name).strip().title()
            if not title.endswith('County') and title not in ('Unknown',):
                return f"{title} County"
            return title
        def guess_county_from_location(loc: str) -> str:
            s = (loc or '').strip()
            if not s:
                return ''
            import re
            # Normalize separators to spaces and remove common noise words
            t = re.sub(r"[,/|]+", " ", s)
            t = t.replace('Sub-County', '').replace('SubCounty', '').replace('Sub County', '')
            t = t.replace('Constituency', '').replace('Ward', '').replace('Division', '')
            t = re.sub(r"\s+", " ", t).strip().lower()
            # Try longest span tokens first
            parts = t.split(' ')
            for span in range(len(parts), 0, -1):
                for i in range(0, len(parts) - span + 1):
                    cand = ' '.join(parts[i:i+span])
                    # direct alias lookup
                    v = COUNTY_ALIAS.get(cand)
                    if v:
                        return v
                    # dashed variant
                    v = COUNTY_ALIAS.get(cand.replace(' ', '-'))
                    if v:
                        return v
            # As a last resort, try substring search against aliases
            try:
                for alias_key, canonical in COUNTY_ALIAS.items():
                    ak = str(alias_key or '').strip().lower()
                    if ak and ak in t:
                        return canonical
            except Exception:
                pass
            return ''
        raw = qs.values('county', 'location_name', 'severity', 'latitude', 'longitude')
        rows = []
        import re
        county_features_cache = {'features': None}
        def point_in_ring(lon, lat, ring):
            inside = False
            j = len(ring) - 1
            for i in range(len(ring)):
                xi = float(ring[i][0]); yi = float(ring[i][1])
                xj = float(ring[j][0]); yj = float(ring[j][1])
                intersect = ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi)
                if intersect:
                    inside = not inside
                j = i
            return inside
        def geometry_contains(geometry, lat, lon):
            if not geometry or not geometry.get('type') or not geometry.get('coordinates'):
                return False
            if geometry['type'] == 'Polygon':
                rings = geometry['coordinates']
                if not isinstance(rings, list) or not rings:
                    return False
                outer = rings[0]
                if not point_in_ring(lon, lat, outer):
                    return False
                for r in range(1, len(rings)):
                    if point_in_ring(lon, lat, rings[r]):
                        return False
                return True
            if geometry['type'] == 'MultiPolygon':
                polys = geometry['coordinates']
                for poly in polys:
                    rings = poly
                    if not isinstance(rings, list) or not rings:
                        continue
                    outer = rings[0]
                    if not point_in_ring(lon, lat, outer):
                        continue
                    in_hole = False
                    for r in range(1, len(rings)):
                        if point_in_ring(lon, lat, rings[r]):
                            in_hole = True
                            break
                    if not in_hole:
                        return True
                return False
            return False
        def load_county_features():
            if county_features_cache['features'] is not None:
                return county_features_cache['features']
            try:
                import os, json
                from django.conf import settings
                persisted_path = os.path.join(getattr(settings, 'MEDIA_ROOT', settings.BASE_DIR), 'counties.geojson')
                data = None
                if os.path.exists(persisted_path):
                    with open(persisted_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                else:
                    import requests
                    url = 'https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/counties.geojson'
                    r = requests.get(url, headers={'Accept': 'application/json'}, timeout=10)
                    r.raise_for_status()
                    data = r.json()
                    try:
                        os.makedirs(os.path.dirname(persisted_path), exist_ok=True)
                        with open(persisted_path, 'w', encoding='utf-8') as f:
                            json.dump(data, f)
                    except Exception:
                        pass
                features = data and (data.get('features') or (data.get('data') or {}).get('features'))
                county_features_cache['features'] = features if isinstance(features, list) else []
            except Exception:
                county_features_cache['features'] = []
            return county_features_cache['features']
        def county_from_point(lat, lon):
            try:
                features = load_county_features()
                for cf in (features or []):
                    props = (cf or {}).get('properties') or {}
                    raw = props.get('COUNTY_NAM') or props.get('name') or ''
                    label = normalize_county_name(raw)
                    if not label:
                        continue
                    if geometry_contains((cf or {}).get('geometry'), float(lat), float(lon)):
                        return label
            except Exception:
                return None
            return None
        for r in raw:
            county = r['county']
            loc = (r.get('location_name') or '').strip()
            if not county:
                if loc and ',' in loc:
                    county = loc.split(',')[-1].strip()
                elif loc:
                    county = loc
                else:
                    county = ''
            norm = normalize_county_name(county)
            if not norm or not re.search(r"[a-zA-Z]", str(county or '')):
                lat = r.get('latitude')
                lon = r.get('longitude')
                if lat is not None and lon is not None:
                    derived = county_from_point(lat, lon)
                    if derived:
                        norm = derived
                if not norm and loc:
                    # Try to guess from location text using aliases only (avoid naive title-case fallback)
                    guessed = guess_county_from_location(loc)
                    norm = guessed
            # Drop non-canonical label produced by free-text without alias
            if norm and CANONICAL_COUNTIES and norm not in CANONICAL_COUNTIES:
                norm = ''
            if not norm:
                norm = 'Unknown'
            rows.append({'county': norm, 'severity': r['severity']})

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
        # Drop placeholder Unknown from county listing
        if 'Unknown' in per_county:
            try:
                del per_county['Unknown']
            except Exception:
                pass
        by_county = sorted(per_county.values(), key=lambda x: x['total'], reverse=True)
        try:
            from django.db.models.functions import TruncDate
            from django.db.models import Q
            days_series_qs = qs
            if not (date_from or date_to):
                try:
                    since = timezone.now() - timedelta(days=30)
                    days_series_qs = days_series_qs.filter(date_updated__gte=since)
                except Exception:
                    pass
            ts = days_series_qs.annotate(day=TruncDate('date_updated')).values('day').annotate(
                total=Count('id'),
                low=Count('id', filter=Q(severity='low')),
                medium=Count('id', filter=Q(severity='medium')),
                high=Count('id', filter=Q(severity='high')),
                critical=Count('id', filter=Q(severity='critical')),
            ).order_by('day')
            timeseries = [
                {
                    'date': str(row['day']),
                    'total': row['total'],
                    'low': row['low'],
                    'medium': row['medium'],
                    'high': row['high'],
                    'critical': row['critical'],
                }
                for row in ts
            ]
        except Exception:
            timeseries = []

        return Response({
            'date_from': date_from,
            'date_to': date_to,
            'national': national,
            'by_county': by_county,
            'timeseries': timeseries,
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
        for obj in qs.only('id', 'occurance_book_number', 'name_of_crime', 'status', 'severity', 'category_of_crime', 'location_name', 'county', 'latitude', 'longitude', 'date_updated'):
            items.append({
                'id': obj.id,
                'occurance_book_number': obj.occurance_book_number,
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
        viewset = CrimeReportBookViewset(request=request)
        setattr(viewset, '_public', True)
        return CrimeReportBookViewset.summary(viewset, request)

class PublicReportsView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = CrimeReportBook.objects.all()
        search = request.query_params.get('search')
        ordering = request.query_params.get('ordering') or '-date_updated'
        county = request.query_params.get('county')
        ob = request.query_params.get('ob') or request.query_params.get('occurance_book_number')
        rid = request.query_params.get('id')

        if ob or rid:
            try:
                obj = (CrimeReportBook.objects.get(occurance_book_number=str(ob)) if ob else CrimeReportBook.objects.get(id=int(rid)))
            except Exception:
                return Response({'detail': 'not found'}, status=status.HTTP_404_NOT_FOUND)
            # Compute risk_score and canonical county using same helpers
            name = obj.name_of_crime or ''
            desc = obj.description or ''
            sev = getattr(obj, 'severity', 'medium') or 'medium'
            kw = ['gun', 'firearm', 'knife', 'explosive', 'riot', 'mob', 'assault', 'kidnap', 'terror', 'arson', 'shoot', 'stab']
            kw_score = sum(1 for k in kw if (k in (name.lower()) or k in (desc.lower())))
            sev_w = {'low': 0.1, 'medium': 0.3, 'high': 0.7, 'critical': 1.0}.get(sev, 0.3)
            text_w = min(1.0, (len(name) + len(desc)) / 400.0)
            risk_score = int(max(0, min(100, round(sev_w * 60 + kw_score * 8 + text_w * 20))))
            # Canonical county label
            import re
            def normalize_county_name(name: str) -> str:
                if not name:
                    return ''
                key = str(name).strip().lower()
                key = re.sub(r"\s+county$", "", key)
                base = key.replace('_', ' ').replace('-', ' ')
                base = re.sub(r"\s+", " ", base).strip()
                if base:
                    v = COUNTY_ALIAS.get(base)
                    if v:
                        return v
                    dashed = base.replace(' ', '-')
                    v = COUNTY_ALIAS.get(dashed)
                    if v:
                        return v
                try:
                    for alias_key, canonical in COUNTY_ALIAS.items():
                        ak = str(alias_key or '').strip().lower()
                        if ak and ak in base:
                            return canonical
                except Exception:
                    pass
                title = str(name).strip().title()
                if not title or title == 'Unknown':
                    return ''
                return (title if title.endswith('County') else f"{title} County")
            county_label = normalize_county_name(obj.county or '') or 'Unknown'
            return Response({
                'id': obj.id,
                'name_of_crime': obj.name_of_crime,
                'description': obj.description,
                'location_name': obj.location_name,
                'county': county_label,
                'date_updated': obj.date_updated,
                'category_of_crime_name': (obj.category_of_crime.crime_category if obj.category_of_crime_id else None),
                'occurance_book_number': obj.occurance_book_number,
                'risk_score': risk_score,
            })

        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(name_of_crime__icontains=search) |
                Q(description__icontains=search) |
                Q(location_name__icontains=search)
            )
        if county:
            from django.db.models import Q
            # Build alias-aware filter similar to summary
            filter_raw = str(county or '').strip()
            filter_norm = filter_raw.lower().replace(' county', '')
            alias_keys = [k for k, v in COUNTY_ALIAS.items() if (filter_norm in k.lower()) or (k.lower() in filter_norm)]
            conditions = Q(county__icontains=filter_raw) | Q(location_name__icontains=filter_raw)
            for ak in alias_keys:
                canonical = COUNTY_ALIAS.get(ak)
                if canonical:
                    base = str(canonical).replace(' County', '')
                    conditions |= Q(county__iexact=canonical) | Q(county__icontains=base) | Q(location_name__icontains=canonical) | Q(location_name__icontains=base)
            qs = qs.filter(conditions)

        if ordering:
            try:
                qs = qs.order_by(ordering)
            except Exception:
                pass

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        rows = []
        # Normalization helpers mirroring summary
        import re
        def normalize_county_name(name: str) -> str:
            if not name:
                return ''
            key = str(name).strip().lower()
            key = re.sub(r"\s+county$", "", key)
            base = key.replace('_', ' ').replace('-', ' ')
            base = re.sub(r"\s+", " ", base).strip()
            if base:
                v = COUNTY_ALIAS.get(base)
                if v:
                    return v
                dashed = base.replace(' ', '-')
                v = COUNTY_ALIAS.get(dashed)
                if v:
                    return v
            try:
                for alias_key, canonical in COUNTY_ALIAS.items():
                    ak = str(alias_key or '').strip().lower()
                    if ak and ak in base:
                        return canonical
            except Exception:
                pass
            title = str(name).strip().title()
            if not title or title == 'Unknown':
                return ''
            return (title if title.endswith('County') else f"{title} County")
        county_features_cache = {'features': None}
        def point_in_ring(lon, lat, ring):
            inside = False
            j = len(ring) - 1
            for i in range(len(ring)):
                xi = float(ring[i][0]); yi = float(ring[i][1])
                xj = float(ring[j][0]); yj = float(ring[j][1])
                intersect = ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi)
                if intersect:
                    inside = not inside
                j = i
            return inside
        def geometry_contains(geometry, lat, lon):
            if not geometry or not geometry.get('type') or not geometry.get('coordinates'):
                return False
            if geometry['type'] == 'Polygon':
                rings = geometry['coordinates']
                if not isinstance(rings, list) or not rings:
                    return False
                outer = rings[0]
                if not point_in_ring(lon, lat, outer):
                    return False
                for r in range(1, len(rings)):
                    if point_in_ring(lon, lat, rings[r]):
                        return False
                return True
            if geometry['type'] == 'MultiPolygon':
                polys = geometry['coordinates']
                for poly in polys:
                    rings = poly
                    if not isinstance(rings, list) or not rings:
                        continue
                    outer = rings[0]
                    if not point_in_ring(lon, lat, outer):
                        continue
                    in_hole = False
                    for r in range(1, len(rings)):
                        if point_in_ring(lon, lat, rings[r]):
                            in_hole = True
                            break
                    if not in_hole:
                        return True
                return False
            return False
        def load_county_features():
            if county_features_cache['features'] is not None:
                return county_features_cache['features']
            try:
                import os, json
                from django.conf import settings
                persisted_path = os.path.join(getattr(settings, 'MEDIA_ROOT', settings.BASE_DIR), 'counties.geojson')
                data = None
                if os.path.exists(persisted_path):
                    with open(persisted_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                else:
                    import requests
                    url = 'https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/counties.geojson'
                    r = requests.get(url, headers={'Accept': 'application/json'}, timeout=10)
                    r.raise_for_status()
                    data = r.json()
                    try:
                        os.makedirs(os.path.dirname(persisted_path), exist_ok=True)
                        with open(persisted_path, 'w', encoding='utf-8') as f:
                            json.dump(data, f)
                    except Exception:
                        pass
                features = data and (data.get('features') or (data.get('data') or {}).get('features'))
                county_features_cache['features'] = features if isinstance(features, list) else []
            except Exception:
                county_features_cache['features'] = []
            return county_features_cache['features']
        def county_from_point(lat, lon):
            try:
                features = load_county_features()
                for cf in (features or []):
                    props = (cf or {}).get('properties') or {}
                    raw = props.get('COUNTY_NAM') or props.get('name') or ''
                    label = normalize_county_name(raw)
                    if not label:
                        continue
                    if geometry_contains((cf or {}).get('geometry'), float(lat), float(lon)):
                        return label
            except Exception:
                return None
            return None
        def guess_county_from_location(loc: str) -> str:
            s = (loc or '').strip()
            if not s:
                return ''
            t = re.sub(r"[,/|]+", " ", s)
            t = t.replace('Sub-County', '').replace('SubCounty', '').replace('Sub County', '')
            t = t.replace('Constituency', '').replace('Ward', '').replace('Division', '')
            t = re.sub(r"\s+", " ", t).strip().lower()
            parts = t.split(' ')
            for span in range(len(parts), 0, -1):
                for i in range(0, len(parts) - span + 1):
                    cand = ' '.join(parts[i:i+span])
                    v = COUNTY_ALIAS.get(cand)
                    if v:
                        return v
                    v = COUNTY_ALIAS.get(cand.replace(' ', '-'))
                    if v:
                        return v
            try:
                for alias_key, canonical in COUNTY_ALIAS.items():
                    ak = str(alias_key or '').strip().lower()
                    if ak and ak in t:
                        return canonical
            except Exception:
                pass
            return ''
        try:
            CANONICAL_COUNTIES = set(COUNTY_ALIAS.values())
        except Exception:
            CANONICAL_COUNTIES = set()
        for obj in page:
            name = obj.name_of_crime or ''
            desc = obj.description or ''
            sev = getattr(obj, 'severity', 'medium') or 'medium'
            kw = ['gun', 'firearm', 'knife', 'explosive', 'riot', 'mob', 'assault', 'kidnap', 'terror', 'arson', 'shoot', 'stab']
            kw_score = sum(1 for k in kw if (k in (name.lower()) or k in (desc.lower())))
            sev_w = {'low': 0.1, 'medium': 0.3, 'high': 0.7, 'critical': 1.0}.get(sev, 0.3)
            text_w = min(1.0, (len(name) + len(desc)) / 400.0)
            risk_score = int(max(0, min(100, round(sev_w * 60 + kw_score * 8 + text_w * 20))))
            # Compute canonical county for display
            raw_county = obj.county or ''
            loc = obj.location_name or ''
            county_label = normalize_county_name(raw_county)
            if not county_label or not re.search(r"[a-zA-Z]", str(raw_county or '')):
                if obj.latitude is not None and obj.longitude is not None:
                    derived = county_from_point(obj.latitude, obj.longitude)
                    if derived:
                        county_label = derived
                if not county_label and loc:
                    guessed = guess_county_from_location(loc)
                    county_label = guessed
            if county_label and CANONICAL_COUNTIES and county_label not in CANONICAL_COUNTIES:
                county_label = ''
            if not county_label:
                county_label = 'Unknown'
            rows.append({
                'id': obj.id,
                'name_of_crime': obj.name_of_crime,
                'description': obj.description,
                'location_name': obj.location_name,
                'county': county_label,
                'date_updated': obj.date_updated,
                'category_of_crime_name': obj.category_of_crime.crime_category if obj.category_of_crime_id else None,
                'occurance_book_number': obj.occurance_book_number,
                'risk_score': risk_score,
            })
        return paginator.get_paginated_response(rows)

    def post(self, request):
        # Track anonymous session
        from .utils import get_or_create_anonymous_session, check_rate_limit
        from .models import AnonymousSession, DeviceFingerprint
        from django.db.models import Count, Sum
        import uuid as uuid_lib
        
        session_id = request.headers.get('X-Session-ID') or request.data.get('session_id')
        # Validate UUID format if provided
        if session_id:
            try:
                uuid_lib.UUID(str(session_id))  # Validate format
            except (ValueError, TypeError):
                session_id = None  # Invalid UUID, generate new one
        
        try:
            session, created = get_or_create_anonymous_session(request, session_id)
            
            # Check if session/device is blocked
            if session.is_blocked:
                return Response({
                    'detail': f'Access blocked: {session.blocked_reason or "Abuse detected"}'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Check rate limits
            allowed, reason = check_rate_limit(session, max_per_hour=10, max_per_day=50)
            if not allowed:
                return Response({'detail': reason}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            # Log error but don't block submission
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Session tracking error: {e}")
        
        hp = str(request.data.get('honeypot') or '')
        if hp.strip():
            return Response({'detail': 'invalid submission'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ca = int(request.data.get('captcha_a') or 0)
            cb = int(request.data.get('captcha_b') or 0)
            ans = int(request.data.get('captcha_answer') or -1)
            if ca + cb != ans:
                return Response({'detail': 'human check failed'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'detail': 'human check failed'}, status=status.HTTP_400_BAD_REQUEST)
        name = request.data.get('name_of_crime')
        category_id = request.data.get('category_of_crime')
        if not name or not category_id:
            return Response({'detail': 'name_of_crime and category_of_crime are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from .models import CrimeCategory
            cat = CrimeCategory.objects.get(id=int(category_id))
        except Exception:
            return Response({'detail': 'invalid category_of_crime'}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize optional inputs: treat empty strings as None
        def none_if_empty(x):
            return (None if (x is None or (isinstance(x, str) and x.strip() == '')) else x)

        # Build instance with safe defaults
        obj = CrimeReportBook(
            name_of_crime=str(name),
            description=none_if_empty(request.data.get('description')),
            location_name=none_if_empty(request.data.get('location_name')),
            location_description=none_if_empty(request.data.get('location_description')),
            county=none_if_empty(request.data.get('county')),
            category_of_crime=cat,
        )
        # Optional coordinates
        try:
            lat = request.data.get('latitude')
            lon = request.data.get('longitude')
            if lat is not None and lon is not None:
                from decimal import Decimal, ROUND_HALF_UP
                q = Decimal('0.000001')
                obj.latitude = Decimal(str(lat)).quantize(q, rounding=ROUND_HALF_UP)
                obj.longitude = Decimal(str(lon)).quantize(q, rounding=ROUND_HALF_UP)
        except Exception:
            pass
        # Ensure optional fields do not fail validation when blank strings are posted
        obj.age = none_if_empty(request.data.get('age'))
        obj.name_of_criminal = none_if_empty(request.data.get('name_of_criminal'))
        obj.criminal_id_number = none_if_empty(request.data.get('criminal_id_number'))
        doa = request.data.get('date_of_arrest')
        if doa and isinstance(doa, str) and doa.strip():
            try:
                from datetime import date
                obj.date_of_arrest = date.fromisoformat(doa)
            except Exception:
                obj.date_of_arrest = None
        else:
            obj.date_of_arrest = None
        try:
            file = getattr(request, 'FILES', {}).get('evidence_video')
            if file is not None:
                obj.evidence_video = file
        except Exception:
            pass
        # Persist (skip full_clean to avoid blank-string validation on optional fields)
        try:
            obj.save()
        except Exception as e:
            return Response({'detail': f'Failed to save: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            create_alert_event(obj, 'created', note='Report created anonymously')
        except Exception:
            pass
        
        # Update session tracking
        try:
            session.report_count += 1
            session.last_seen = timezone.now()
            session.save(update_fields=['report_count', 'last_seen'])
            
            # Update device fingerprint
            if session.device_fingerprint:
                try:
                    device = DeviceFingerprint.objects.get(fingerprint_hash=session.device_fingerprint)
                    device.report_count += 1
                    device.last_seen = timezone.now()
                    device.save(update_fields=['report_count', 'last_seen'])
                except DeviceFingerprint.DoesNotExist:
                    pass
        except Exception:
            pass

        return Response({
            'id': obj.id,
            'occurance_book_number': obj.occurance_book_number,
            'name_of_crime': obj.name_of_crime,
            'location_name': obj.location_name,
            'county': obj.county,
            'date_updated': obj.date_updated,
            'category_of_crime_name': obj.category_of_crime.crime_category,
            'session_id': str(session.session_id),  # Return session ID for client to store
        }, status=status.HTTP_201_CREATED)

class PublicSubCountiesGeoJSONView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    _CACHE = None
    _CACHE_TS = 0
    _CACHE_TTL = 60 * 60 * 24 * 7

    def get(self, request):
        import time
        import os
        from django.conf import settings
        now = int(time.time())
        try:
            if self._CACHE and (now - self._CACHE_TS) < self._CACHE_TTL:
                return Response(self._CACHE)
        except Exception:
            pass

        primary = 'https://ckan.africadatahub.org/dataset/ebfdedaa-b9c4-442e-9144-72f2303105c5/resource/650999c2-c1f7-4acb-9bbb-d3af84a6a04b/download/kenya-subcounties-simplified.geojson'
        fallback = 'https://raw.githubusercontent.com/Mondieki/kenya-counties-subcounties/master/geojson/subcounties.geojson'
        persisted_path = os.path.join(getattr(settings, 'MEDIA_ROOT', settings.BASE_DIR), 'subcounties.geojson')

        def fetch_json(url: str):
            import requests
            headers = {'Accept': 'application/json'}
            resp = requests.get(url, headers=headers, timeout=10)
            resp.raise_for_status()
            return resp.json()

        data = None
        # Try external sources
        try:
            data = fetch_json(primary)
        except Exception:
            try:
                data = fetch_json(fallback)
            except Exception:
                try:
                    if os.path.exists(persisted_path):
                        import json
                        with open(persisted_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                    else:
                        return Response({'detail': 'Failed to load sub-counties'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                except Exception:
                    return Response({'detail': 'Failed to load sub-counties'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            self._CACHE = data
            self._CACHE_TS = now
            try:
                import json
                os.makedirs(os.path.dirname(persisted_path), exist_ok=True)
                with open(persisted_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f)
            except Exception:
                pass
        except Exception:
            pass

        return Response(data)

class PublicConstituenciesGeoJSONView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    _CACHE = None
    _CACHE_TS = 0
    _CACHE_TTL = 60 * 60 * 24 * 7

    def get(self, request):
        import time
        import os
        from django.conf import settings
        now = int(time.time())
        try:
            if self._CACHE and (now - self._CACHE_TS) < self._CACHE_TTL:
                return Response(self._CACHE)
        except Exception:
            pass

        primary = 'https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/constituencies.geojson'
        persisted_path = os.path.join(getattr(settings, 'MEDIA_ROOT', settings.BASE_DIR), 'constituencies.geojson')

        def fetch_json(url: str):
            import requests
            headers = {'Accept': 'application/json'}
            resp = requests.get(url, headers=headers, timeout=10)
            resp.raise_for_status()
            return resp.json()

        data = None
        try:
            data = fetch_json(primary)
        except Exception:
            try:
                if os.path.exists(persisted_path):
                    import json
                    with open(persisted_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                else:
                    return Response({'detail': 'Failed to load constituencies'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            except Exception:
                return Response({'detail': 'Failed to load constituencies'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            self._CACHE = data
            self._CACHE_TS = now
            try:
                import json
                os.makedirs(os.path.dirname(persisted_path), exist_ok=True)
                with open(persisted_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f)
            except Exception:
                pass
        except Exception:
            pass
        
        return Response(data)

class PublicEmergencyNumbersView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        nums = [
            {'name': 'Kenya Police Emergency', 'number': '999', 'tel': 'tel:999'},
            {'name': 'National Emergency', 'number': '112', 'tel': 'tel:112'},
        ]
        return Response({'results': nums})

class PublicSOSView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from .models import CrimeCategory, CrimeReportBook
        name = 'SOS Alert'
        try:
            cat = CrimeCategory.objects.filter(crime_short_code='SOS').first()
            if not cat:
                cat = CrimeCategory.objects.create(crime_category='Emergency', crime_short_code='SOS')
        except Exception:
            return Response({'detail': 'Failed to prepare category'}, status=status.HTTP_400_BAD_REQUEST)

        obj = CrimeReportBook(
            name_of_crime=name,
            description=(request.data.get('description') or None),
            location_name=(request.data.get('location_name') or None),
            location_description=(request.data.get('location_description') or None),
            county=(request.data.get('county') or None),
            category_of_crime=cat,
            severity=CrimeReportBook.SEVERITY_CRITICAL,
        )
        try:
            lat = request.data.get('latitude')
            lon = request.data.get('longitude')
            if lat is not None and lon is not None:
                from decimal import Decimal, ROUND_HALF_UP
                q = Decimal('0.000001')
                obj.latitude = Decimal(str(lat)).quantize(q, rounding=ROUND_HALF_UP)
                obj.longitude = Decimal(str(lon)).quantize(q, rounding=ROUND_HALF_UP)
        except Exception:
            pass
        try:
            obj.save()
        except Exception as e:
            return Response({'detail': f'Failed to save: {e}'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            create_alert_event(obj, 'created', note='SOS alert')
        except Exception:
            pass
        try:
            send_to = request.data.get('notify_phone') or request.data.get('phone') or request.data.get('notify_to')
            if send_to:
                digits = ''.join([c for c in str(send_to) if c.isdigit() or c == '+'])
                if digits.startswith('0'):
                    digits = '+254' + digits[1:]
                if not digits.startswith('+'):
                    digits = '+' + digits
                from .channels import get_sms_provider
                from .alerting import format_alert_message
                msg = str(request.data.get('notify_message') or '').strip()
                if not msg:
                    msg = format_alert_message(obj, 'created', note='SOS alert')
                    if obj.latitude and obj.longitude:
                        try:
                            lat_s = str(obj.latitude)
                            lon_s = str(obj.longitude)
                            msg += f"\nGPS: {lat_s}, {lon_s}\nMap: https://maps.google.com/?q={lat_s},{lon_s}"
                        except Exception:
                            pass
                try:
                    get_sms_provider().send(digits, msg)
                except Exception:
                    pass
        except Exception:
            pass
        return Response({
            'id': obj.id,
            'occurance_book_number': obj.occurance_book_number,
            'name_of_crime': obj.name_of_crime,
            'location_name': obj.location_name,
            'county': obj.county,
            'latitude': obj.latitude,
            'longitude': obj.longitude,
            'date_updated': obj.date_updated,
            'category_of_crime_name': obj.category_of_crime.crime_category,
        }, status=status.HTTP_201_CREATED)

class PublicSMSSubscribeView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        phone = str(request.data.get('phone') or '').strip()
        county = request.data.get('county')
        qhs = request.data.get('quiet_hours_start')
        qhe = request.data.get('quiet_hours_end')
        if not phone:
            return Response({'detail': 'phone is required'}, status=status.HTTP_400_BAD_REQUEST)
        digits = ''.join([c for c in phone if c.isdigit() or c == '+'])
        if digits.startswith('0'):
            digits = '+254' + digits[1:]
        if not digits.startswith('+'):
            digits = '+' + digits
        User = get_user_model()
        username = f"sms_{digits.replace('+','')[-10:]}"
        user, created = User.objects.get_or_create(username=username)
        if created:
            try:
                user.set_unusable_password()
                user.save(update_fields=['password'])
            except Exception:
                pass
        from .models import UserProfile, AlertSubscription
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.phone_number = digits
        if county:
            profile.county = county
        profile.sms_opt_in = True
        profile.save()
        sub, _ = AlertSubscription.objects.get_or_create(user=user, county=(county or None), channel=AlertSubscription.CHANNEL_SMS)
        sub.enabled = True
        if qhs:
            try:
                from datetime import time
                h, m = map(int, str(qhs).split(':'))
                sub.quiet_hours_start = time(h, m)
            except Exception:
                pass
        if qhe:
            try:
                from datetime import time
                h, m = map(int, str(qhe).split(':'))
                sub.quiet_hours_end = time(h, m)
            except Exception:
                pass
        sub.save()
        return Response({'detail': 'subscribed', 'phone': digits, 'county': sub.county, 'username': user.username})

class PublicSMSUnsubscribeView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        phone = str(request.data.get('phone') or '').strip()
        if not phone:
            return Response({'detail': 'phone is required'}, status=status.HTTP_400_BAD_REQUEST)
        digits = ''.join([c for c in phone if c.isdigit() or c == '+'])
        if digits.startswith('0'):
            digits = '+254' + digits[1:]
        if not digits.startswith('+'):
            digits = '+' + digits
        User = get_user_model()
        from .models import UserProfile, AlertSubscription
        try:
            profile = UserProfile.objects.get(phone_number=digits)
        except UserProfile.DoesNotExist:
            return Response({'detail': 'not found'}, status=status.HTTP_404_NOT_FOUND)
        subs = AlertSubscription.objects.filter(user=profile.user, channel=AlertSubscription.CHANNEL_SMS)
        for s in subs:
            s.enabled = False
            s.save(update_fields=['enabled'])
        profile.sms_opt_in = False
        profile.save(update_fields=['sms_opt_in'])
        return Response({'detail': 'unsubscribed'})
class CountyAliasesView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        import json
        import hashlib
        import os
        from django.conf import settings
        aliases = dict(COUNTY_ALIAS)
        def norm_county(name):
            if not name:
                return ''
            import re
            key = str(name).strip().lower()
            key = re.sub(r"\s+county$", "", key)
            base = key.replace('_', ' ').replace('-', ' ')
            base = re.sub(r"\s+", " ", base).strip()
            if base:
                v = COUNTY_ALIAS.get(base)
                if v:
                    return v
                dashed = base.replace(' ', '-')
                v = COUNTY_ALIAS.get(dashed)
                if v:
                    return v
            title = str(name).strip().title()
            return title if title.endswith('County') else f"{title} County"
        def clean_name(s):
            t = str(s or '').strip()
            t = t.replace('_', ' ').replace('-', ' ').strip()
            t = t.replace('SubCounty', '').replace('Sub-County', '').replace('Sub County', '')
            t = t.replace('Constituency', '').replace('Ward', '').replace('Division', '')
            t = t.strip()
            return t
        def extract_subcounty(props):
            if not isinstance(props, dict):
                return ''
            candidates = ['name','NAME','SubCounty','SUBCOUNTY','subcounty','SC_NAME','SCNAME','Sub_County','SUB_COUNTY','SUB_CNTY','ADM2_EN','ADM2_REF','ADM2_PCODE','DISTRICT','Constituency','CONSTITUENCY','Ward','WARD','Division','DIVISION']
            for k in candidates:
                v = props.get(k)
                if isinstance(v, str):
                    s = clean_name(v)
                    if s and s.lower() not in ('', 'subcounty', 'sub county', 'unknown', 'none', 'null'):
                        return s
            for k, v in (props.items() if isinstance(props, dict) else []):
                if isinstance(v, str):
                    s = clean_name(v)
                    kl = str(k).lower()
                    if s and (('name' in kl) or ('subcounty' in kl) or ('sub_county' in kl) or ('ward' in kl) or ('division' in kl)) and s.lower() not in ('', 'subcounty', 'sub county'):
                        return s
            return ''
        def extract_county(props):
            if not isinstance(props, dict):
                return ''
            candidates = ['COUNTY','County','COUNTY_NAM','COUNTY_NAME','ADM1_EN','ADM1_REF','ADM1_PCODE','ADMIN1','Adm1_name','ADMIN_L1','Province','PROVINCE']
            for k in candidates:
                v = props.get(k)
                if isinstance(v, str):
                    s = str(v).strip()
                    if s:
                        return s
            for k, v in (props.items() if isinstance(props, dict) else []):
                if isinstance(v, str):
                    s = str(v).strip()
                    kl = str(k).lower()
                    if s and ('county' in kl or 'adm1' in kl):
                        return s
            return ''
        try:
            persisted_path = os.path.join(getattr(settings, 'MEDIA_ROOT', settings.BASE_DIR), 'subcounties.geojson')
            data = None
            if os.path.exists(persisted_path):
                with open(persisted_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                try:
                    import requests
                    urls = [
                        'https://ckan.africadatahub.org/dataset/ebfdedaa-b9c4-442e-9144-72f2303105c5/resource/650999c2-c1f7-4acb-9bbb-d3af84a6a04b/download/kenya-subcounties-simplified.geojson',
                    ]
                    for url in urls:
                        try:
                            resp = requests.get(url, headers={'Accept': 'application/json'}, timeout=10)
                            resp.raise_for_status()
                            data = resp.json()
                            break
                        except Exception:
                            continue
                    if data is not None:
                        try:
                            os.makedirs(os.path.dirname(persisted_path), exist_ok=True)
                            with open(persisted_path, 'w', encoding='utf-8') as f:
                                json.dump(data, f)
                        except Exception:
                            pass
                except Exception:
                    data = None
            features = None
            if data:
                features = data.get('features') or (data.get('data') or {}).get('features')
            if isinstance(features, list):
                for ftr in features:
                    props = (ftr or {}).get('properties') or {}
                    sc = extract_subcounty(props)
                    parent = extract_county(props)
                    if sc and parent:
                        aliases[sc.lower()] = norm_county(parent)
                def point_in_ring(lon, lat, ring):
                    inside = False
                    j = len(ring) - 1
                    for i in range(len(ring)):
                        xi = float(ring[i][0]); yi = float(ring[i][1])
                        xj = float(ring[j][0]); yj = float(ring[j][1])
                        intersect = ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi)
                        if intersect:
                            inside = not inside
                        j = i
                    return inside
                def geometry_contains(geometry, lat, lon):
                    if not geometry or not geometry.get('type') or not geometry.get('coordinates'):
                        return False
                    if geometry['type'] == 'Polygon':
                        rings = geometry['coordinates']
                        if not isinstance(rings, list) or not rings:
                            return False
                        outer = rings[0]
                        if not point_in_ring(lon, lat, outer):
                            return False
                        for r in range(1, len(rings)):
                            if point_in_ring(lon, lat, rings[r]):
                                return False
                        return True
                    if geometry['type'] == 'MultiPolygon':
                        polys = geometry['coordinates']
                        for poly in polys:
                            rings = poly
                            if not isinstance(rings, list) or not rings:
                                continue
                            outer = rings[0]
                            if not point_in_ring(lon, lat, outer):
                                continue
                            in_hole = False
                            for r in range(1, len(rings)):
                                if point_in_ring(lon, lat, rings[r]):
                                    in_hole = True
                                    break
                            if not in_hole:
                                return True
                        return False
                    return False
                def geometry_centroid(geometry):
                    try:
                        if not geometry or not geometry.get('coordinates'):
                            return None
                        if geometry.get('type') == 'Polygon':
                            rings = geometry['coordinates']
                            outer = rings[0]
                            xs = [float(p[0]) for p in outer]; ys = [float(p[1]) for p in outer]
                            return (sum(ys) / len(ys), sum(xs) / len(xs))
                        if geometry.get('type') == 'MultiPolygon':
                            rings = geometry['coordinates'][0]
                            outer = rings[0]
                            xs = [float(p[0]) for p in outer]; ys = [float(p[1]) for p in outer]
                            return (sum(ys) / len(ys), sum(xs) / len(xs))
                        return None
                    except Exception:
                        return None
                counties = None
                try:
                    import requests
                    c_path = os.path.join(getattr(settings, 'MEDIA_ROOT', settings.BASE_DIR), 'counties.geojson')
                    if os.path.exists(c_path):
                        with open(c_path, 'r', encoding='utf-8') as f:
                            counties = json.load(f)
                    else:
                        url = 'https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/counties.geojson'
                        r = requests.get(url, headers={'Accept': 'application/json'}, timeout=10)
                        r.raise_for_status()
                        counties = r.json()
                        try:
                            os.makedirs(os.path.dirname(c_path), exist_ok=True)
                            with open(c_path, 'w', encoding='utf-8') as f:
                                json.dump(counties, f)
                        except Exception:
                            pass
                except Exception:
                    counties = None
                c_features = counties and (counties.get('features') or (counties.get('data') or {}).get('features'))
                if isinstance(c_features, list):
                    for ftr in features:
                        props = (ftr or {}).get('properties') or {}
                        sc = extract_subcounty(props)
                        if not sc:
                            continue
                        centroid = geometry_centroid((ftr or {}).get('geometry'))
                        if not centroid:
                            continue
                        lat, lon = centroid
                        parent_name = ''
                        for cf in c_features:
                            cprops = (cf or {}).get('properties') or {}
                            raw = cprops.get('COUNTY_NAM') or cprops.get('name') or ''
                            county_label = norm_county(raw)
                            if not county_label:
                                continue
                            if geometry_contains((cf or {}).get('geometry'), lat, lon):
                                parent_name = county_label
                                break
                        if parent_name:
                            aliases[sc.lower()] = parent_name
        except Exception:
            pass
        # Correct known county assignments from geo sources
        try:
            aliases['kuresoi north'] = 'Nakuru County'
            aliases['isiolo north'] = 'Isiolo County'
        except Exception:
            pass
        payload = json.dumps(aliases, sort_keys=True, separators=(",", ":"))
        etag = hashlib.md5(payload.encode("utf-8")).hexdigest()
        inm = request.headers.get("If-None-Match") or request.META.get("HTTP_IF_NONE_MATCH")
        if inm and inm == etag:
            return Response(status=status.HTTP_304_NOT_MODIFIED)
        resp = Response({"aliases": aliases})
        resp["ETag"] = etag
        return resp

# CRIME WITNESS API
class CrimeWitnessViewset(ModelViewSet):
    serializer_class = CrimeWitnessSerializer
    queryset = CrimeWitness.objects.all()
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PublicAnonRateThrottle]
    search_fields = ['name', 'contact_information', 'statement']
    ordering_fields = ['date_created', 'date_updated', 'name']
    filterset_fields = ['crime_report']

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        case_id = data.get('case_id') or data.get('occurance_book_number') or data.get('ob_number') or data.get('tracking_code')
        if case_id and not data.get('crime_report'):
            obj = None
            try:
                obj = CrimeReportBook.objects.get(occurance_book_number=str(case_id))
            except Exception:
                try:
                    obj = CrimeReportBook.objects.get(id=int(case_id))
                except Exception:
                    obj = None
            if obj:
                data['crime_report'] = obj.id
        name = str(data.get('name') or '').strip()
        if not name:
            data['name'] = 'Anonymous'
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class AuthMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        groups = list(user.groups.values_list('name', flat=True))
        org = get_user_organization(user)
        
        response_data = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'roles': groups
        }
        
        # Include organization information if user has one
        if org:
            response_data['organization'] = {
                'id': org.id,
                'name': org.organization_name,
                'type': org.organization_type
            }
        else:
            response_data['organization'] = None
        
        return Response(response_data)


class AlertEventViewSet(ModelViewSet):
    serializer_class = AlertEventSerializer
    queryset = AlertEvent.objects.all()
    from .permissions import IsAdminOrDispatcherOrReadOnly
    permission_classes = [permissions.IsAuthenticated, IsAdminOrDispatcherOrReadOnly]
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

    @action(detail=False, methods=['post'])
    def enqueue(self, request):
        from .tasks import send_notification_task
        incident_id = request.data.get('incident_id')
        event_type = request.data.get('event_type')
        note = request.data.get('note', '')

        if not incident_id or not event_type:
            return Response({'detail': 'incident_id and event_type are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Try asynchronous Celery dispatch
        event_id = None
        try:
            async_res = send_notification_task.delay(int(incident_id), str(event_type), str(note))
            event_id = async_res.get(timeout=10)
        except Exception:
            # Fallback to synchronous dispatch
            try:
                event_id = send_notification_task(int(incident_id), str(event_type), str(note))
            except Exception as e:
                return Response({'detail': f'Failed to enqueue: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'event_id': event_id}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='retry_failed')
    def retry_failed(self, request):
        from .tasks import retry_failed_alerts
        try:
            async_res = retry_failed_alerts.delay()
            msg = async_res.get(timeout=10)
            return Response({'detail': msg})
        except Exception:
            try:
                msg = retry_failed_alerts()
                return Response({'detail': msg})
            except Exception as e:
                return Response({'detail': f'Failed to retry: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class NeighborhoodViewSet(ModelViewSet):
    serializer_class = NeighborhoodSerializer
    queryset = Neighborhood.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ['name', 'invite_code']
    ordering_fields = ['created_at', 'name']
    filterset_fields = ['name']

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        user = request.user
        nb = self.get_object()
        # optional invite_code check
        code = request.data.get('invite_code')
        if nb.invite_code and code and code != nb.invite_code:
            return Response({'detail': 'Invalid invite code'}, status=status.HTTP_400_BAD_REQUEST)
        mem, _ = NeighborhoodMember.objects.get_or_create(neighborhood=nb, user=user)
        return Response(NeighborhoodMemberSerializer(mem).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def contains_point(self, request):
        try:
            lat = float(request.query_params.get('lat'))
            lon = float(request.query_params.get('lon'))
        except Exception:
            return Response({'detail': 'lat and lon are required'}, status=status.HTTP_400_BAD_REQUEST)
        matches = []
        for nb in Neighborhood.objects.exclude(polygon__isnull=True):
            try:
                poly = nb.polygon
                # naive point-in-polygon for simple Polygon coordinates [[lon, lat], ...]
                coords = poly.get('coordinates') if poly else None
                if not coords:
                    continue
                # handle Polygon (first ring)
                ring = coords[0]
                inside = False
                j = len(ring) - 1
                for i in range(len(ring)):
                    xi, yi = float(ring[i][0]), float(ring[i][1])
                    xj, yj = float(ring[j][0]), float(ring[j][1])
                    intersect = ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-9) + xi)
                    if intersect:
                        inside = not inside
                    j = i
                if inside:
                    matches.append(nb.id)
            except Exception:
                continue
        return Response({'neighborhood_ids': matches})

    @action(detail=False, methods=['get'], url_path='my')
    def my(self, request):
        qs = NeighborhoodMember.objects.filter(user=request.user)
        data = NeighborhoodMemberSerializer(qs, many=True).data
        return Response(data)

    @action(detail=True, methods=['get'])
    def alerts(self, request, pk=None):
        nb = self.get_object()
        points = []
        if nb.polygon and isinstance(nb.polygon, dict):
            coords = nb.polygon.get('coordinates')
            if coords:
                ring = coords[0]
                for obj in CrimeReportBook.objects.exclude(latitude__isnull=True).exclude(longitude__isnull=True):
                    lat = float(obj.latitude)
                    lon = float(obj.longitude)
                    inside = False
                    j = len(ring) - 1
                    for i in range(len(ring)):
                        xi = float(ring[i][0])
                        yi = float(ring[i][1])
                        xj = float(ring[j][0])
                        yj = float(ring[j][1])
                        intersect = ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-9) + xi)
                        if intersect:
                            inside = not inside
                        j = i
                    if inside:
                        points.append(obj)
        ser = PublicCrimeReportSerializer(points, many=True)
        return Response(ser.data)

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        nb = self.get_object()
        if request.method.lower() == 'get':
            show_all = False
            try:
                user_groups = set(request.user.groups.values_list('name', flat=True))
                if ROLE_ADMIN in user_groups or ROLE_SUPERADMIN in user_groups:
                    show_all = True
            except Exception:
                show_all = False
            qs = NeighborhoodMessage.objects.filter(neighborhood=nb)
            if not show_all:
                qs = qs.filter(approved=True)
            qs = qs.order_by('-created_at')
            ser = NeighborhoodMessageSerializer(qs, many=True)
            return Response(ser.data)
        text = str(request.data.get('text') or '').strip()
        if not text:
            return Response({'detail': 'text is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not NeighborhoodMember.objects.filter(neighborhood=nb, user=request.user).exists():
            return Response({'detail': 'not a member'}, status=status.HTTP_403_FORBIDDEN)
        msg = NeighborhoodMessage(neighborhood=nb, user=request.user, text=text)
        try:
            msg.approved = True
            msg.save()
        except Exception as e:
            return Response({'detail': f'Failed to save: {e}'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(NeighborhoodMessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='messages/approve')
    def approve_message(self, request, pk=None):
        nb = self.get_object()
        msg_id = request.data.get('message_id')
        approved = request.data.get('approved')
        try:
            approved_bool = True if approved in (None, '', True, 'true', 'True', 1, '1') else False
        except Exception:
            approved_bool = True
        # Admin-only
        try:
            user_groups = set(request.user.groups.values_list('name', flat=True))
            if ROLE_ADMIN not in user_groups and ROLE_SUPERADMIN not in user_groups:
                return Response({'detail': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            return Response({'detail': 'forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            msg = NeighborhoodMessage.objects.get(id=int(msg_id), neighborhood=nb)
        except Exception:
            return Response({'detail': 'message not found'}, status=status.HTTP_404_NOT_FOUND)
        msg.approved = approved_bool
        msg.save(update_fields=['approved'])
        return Response(NeighborhoodMessageSerializer(msg).data)

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        nb = self.get_object()
        NeighborhoodMember.objects.filter(neighborhood=nb, user=request.user).delete()
        return Response({'detail': 'left'})

    @action(detail=False, methods=['get'], url_path='alerts_counts')
    def alerts_counts(self, request):
        results = []
        days = request.query_params.get('days')
        since = None
        try:
            if days:
                since = timezone.now() - timedelta(days=int(days))
        except Exception:
            since = None
        for nb in Neighborhood.objects.all():
            count = 0
            try:
                poly = nb.polygon
                coords = poly.get('coordinates') if poly else None
                if coords:
                    ring = coords[0]
                    qs = CrimeReportBook.objects.exclude(latitude__isnull=True).exclude(longitude__isnull=True)
                    if since:
                        qs = qs.filter(date_updated__gte=since)
                    for obj in qs:
                        lat = float(obj.latitude)
                        lon = float(obj.longitude)
                        inside = False
                        j = len(ring) - 1
                        for i in range(len(ring)):
                            xi = float(ring[i][0])
                            yi = float(ring[i][1])
                            xj = float(ring[j][0])
                            yj = float(ring[j][1])
                            intersect = ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-9) + xi)
                            if intersect:
                                inside = not inside
                            j = i
                        if inside:
                            count += 1
            except Exception:
                pass
            results.append({'id': nb.id, 'count': count})
        return Response({'results': results})


class RegistrationView(APIView):
    """
    Registration is now restricted to SuperAdmin only.
    Security Org Users must be created by SuperAdmin through admin interface.
    Anonymous reporters do not need accounts.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Only SuperAdmin can create accounts
        if not request.user.is_authenticated:
            return Response({
                'detail': 'Authentication required. Only SuperAdmin can create accounts. Contact NAWA support for Security Org access.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        user_groups = set(request.user.groups.values_list('name', flat=True))
        if ROLE_SUPERADMIN not in user_groups:
            return Response({
                'detail': 'Only SuperAdmin can create accounts. Security Org Users must be whitelisted by SuperAdmin.'
            }, status=status.HTTP_403_FORBIDDEN)

        User = get_user_model()
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()
        email = request.data.get('email', '').strip()
        role = request.data.get('role', ROLE_SECURITY_ORG)

        if not username or not password:
            return Response({'detail': 'username and password are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Only allow SecurityOrgUser or SuperAdmin roles
        if role not in [ROLE_SUPERADMIN, ROLE_SECURITY_ORG]:
            role = ROLE_SECURITY_ORG

        if User.objects.filter(username=username).exists():
            return Response({'detail': 'username already exists'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, email=email or None, password=password)
        try:
            grp, _ = Group.objects.get_or_create(name=role)
            user.groups.add(grp)
        except Exception:
            pass

        # If creating SecurityOrgUser, create whitelist entry
        if role == ROLE_SECURITY_ORG:
            from .models import SecurityOrgWhitelist
            organization_name = request.data.get('organization_name', '').strip()
            organization_type = request.data.get('organization_type', 'other')
            contact_person = request.data.get('contact_person', '').strip() or None
            contact_email = request.data.get('contact_email', '').strip() or None
            contact_phone = request.data.get('contact_phone', '').strip() or None
            allowed_ip_ranges = request.data.get('allowed_ip_ranges', [])
            allowed_vpn_names = request.data.get('allowed_vpn_names', [])
            notes = request.data.get('notes', '').strip() or None
            
            if not organization_name:
                organization_name = f"Organization for {username}"
            
            # Validate organization_type
            valid_types = ['police', 'county_command', 'private_security', 'emergency', 'other']
            if organization_type not in valid_types:
                organization_type = 'other'
            
            # Ensure allowed_ip_ranges and allowed_vpn_names are lists
            if not isinstance(allowed_ip_ranges, list):
                allowed_ip_ranges = []
            if not isinstance(allowed_vpn_names, list):
                allowed_vpn_names = []
            
            SecurityOrgWhitelist.objects.create(
                user=user,
                organization_name=organization_name,
                organization_type=organization_type,
                contact_person=contact_person,
                contact_email=contact_email,
                contact_phone=contact_phone,
                allowed_ip_ranges=allowed_ip_ranges,
                allowed_vpn_names=allowed_vpn_names,
                notes=notes,
                created_by=request.user,
                is_active=True
            )

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


class SubscribeAlertsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        subs = AlertSubscription.objects.filter(user=request.user)
        rows = [
            {
                'id': s.id,
                'county': s.county,
                'channel': getattr(s, 'channel', 'sms'),
                'enabled': getattr(s, 'enabled', True),
                'quiet_hours_start': getattr(s, 'quiet_hours_start', None),
                'quiet_hours_end': getattr(s, 'quiet_hours_end', None),
            }
            for s in subs
        ]
        return Response({'results': rows})

    def post(self, request):
        county = request.data.get('county')
        channel = request.data.get('channel') or 'sms'
        sub, _ = AlertSubscription.objects.get_or_create(user=request.user, county=county or None, defaults={'channel': channel})
        sub.enabled = True
        sub.channel = channel
        sub.save()
        return Response({'id': sub.id, 'detail': 'subscribed'})

    def delete(self, request):
        sub_id = request.data.get('id')
        try:
            s = AlertSubscription.objects.get(id=int(sub_id), user=request.user)
            s.delete()
            return Response({'detail': 'unsubscribed'})
        except Exception:
            return Response({'detail': 'not found'}, status=status.HTTP_404_NOT_FOUND)
class UsersRolesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Only SuperAdmin can view users
        user_groups = set(request.user.groups.values_list('name', flat=True))
        if ROLE_SUPERADMIN not in user_groups:
            return Response({
                'detail': 'Only SuperAdmin can view users list.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        User = get_user_model()
        from .models import SecurityOrgWhitelist
        rows = []
        by_role = {}
        for u in User.objects.all().order_by('username'):
            roles = list(u.groups.values_list('name', flat=True))
            for r in roles:
                by_role[r] = by_role.get(r, 0) + 1
            
            # Get whitelist info if exists
            whitelist_info = None
            try:
                wl = SecurityOrgWhitelist.objects.get(user=u)
                whitelist_info = {
                    'organization_name': wl.organization_name,
                    'organization_type': wl.organization_type,
                    'is_active': wl.is_active,
                    'has_ip_restrictions': bool(wl.allowed_ip_ranges),
                    'has_vpn_restrictions': bool(wl.allowed_vpn_names),
                }
            except SecurityOrgWhitelist.DoesNotExist:
                pass
            
            rows.append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'roles': roles,
                'is_superuser': u.is_superuser,
                'is_staff': u.is_staff,
                'whitelist': whitelist_info,
            })
        return Response({'results': rows, 'total': len(rows), 'by_role': by_role})


class SecurityStatsView(APIView):
    """Stats endpoint for Security Org Users (org-specific)"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Q, Avg, F
        from django.utils import timezone
        from datetime import timedelta
        
        # Get user's organization if Security Org User
        user_groups = set(request.user.groups.values_list('name', flat=True))
        if ROLE_SECURITY_ORG not in user_groups and ROLE_SUPERADMIN not in user_groups:
            return Response({'detail': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Filter by organization if Security Org User (not SuperAdmin)
        org_filter = Q()
        if ROLE_SUPERADMIN not in user_groups:
            # For Security Org Users, filter by their organization's reports
            # This would need to be implemented based on how reports are associated with orgs
            # For now, return all reports (can be refined later)
            pass
        
        # Calculate stats
        total = CrimeReportBook.objects.filter(org_filter).count()
        pending = CrimeReportBook.objects.filter(org_filter, status=CrimeReportBook.STATUS_SUBMITTED).count()
        in_progress = CrimeReportBook.objects.filter(
            org_filter,
            status__in=[CrimeReportBook.STATUS_IN_PROGRESS, CrimeReportBook.STATUS_TRIAGED]
        ).count()
        resolved = CrimeReportBook.objects.filter(
            org_filter,
            status__in=[CrimeReportBook.STATUS_RESOLVED, CrimeReportBook.STATUS_CLOSED]
        ).count()
        
        # Calculate average response time (time from submitted to acknowledged/in_progress)
        # This is a simplified calculation
        avg_response_time = None
        try:
            resolved_reports = CrimeReportBook.objects.filter(
                org_filter,
                status__in=[CrimeReportBook.STATUS_RESOLVED, CrimeReportBook.STATUS_CLOSED],
                date_updated__isnull=False,
                date_created__isnull=False
            )
            if resolved_reports.exists():
                response_times = []
                for report in resolved_reports[:100]:  # Sample first 100 for performance
                    if report.date_created and report.date_updated:
                        delta = report.date_updated - report.date_created
                        response_times.append(delta.total_seconds() / 60)  # Convert to minutes
                if response_times:
                    avg_response_time = sum(response_times) / len(response_times)
        except Exception:
            pass
        
        # SLA compliance (simplified: % resolved within 24 hours)
        sla_compliance = None
        try:
            last_30_days = timezone.now() - timedelta(days=30)
            recent_resolved = CrimeReportBook.objects.filter(
                org_filter,
                status__in=[CrimeReportBook.STATUS_RESOLVED, CrimeReportBook.STATUS_CLOSED],
                date_updated__gte=last_30_days
            )
            if recent_resolved.exists():
                within_sla = 0
                total_recent = recent_resolved.count()
                for report in recent_resolved[:100]:
                    if report.date_created and report.date_updated:
                        delta = report.date_updated - report.date_created
                        if delta.total_seconds() <= 24 * 3600:  # 24 hours
                            within_sla += 1
                if total_recent > 0:
                    sla_compliance = (within_sla / min(total_recent, 100)) * 100
        except Exception:
            pass
        
        return Response({
            'total': total,
            'pending': pending,
            'in_progress': in_progress,
            'resolved': resolved,
            'avg_response_time': round(avg_response_time, 1) if avg_response_time else None,
            'sla_compliance': round(sla_compliance, 1) if sla_compliance else None,
        })


class GlobalStatsView(APIView):
    """Global stats endpoint for SuperAdmin"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        from .models import SecurityOrgWhitelist
        
        user_groups = set(request.user.groups.values_list('name', flat=True))
        if ROLE_SUPERADMIN not in user_groups:
            return Response({'detail': 'Only SuperAdmin can access global stats'}, status=status.HTTP_403_FORBIDDEN)
        
        total_reports = CrimeReportBook.objects.count()
        total_organizations = SecurityOrgWhitelist.objects.filter(is_active=True).count()
        active_incidents = CrimeReportBook.objects.filter(
            status__in=[CrimeReportBook.STATUS_SUBMITTED, CrimeReportBook.STATUS_TRIAGED, CrimeReportBook.STATUS_IN_PROGRESS]
        ).count()
        false_reports = CrimeReportBook.objects.filter(status='false_report').count()  # Assuming this status exists
        
        # Calculate average response time across all orgs
        avg_response_time = None
        try:
            resolved = CrimeReportBook.objects.filter(
                status__in=[CrimeReportBook.STATUS_RESOLVED, CrimeReportBook.STATUS_CLOSED],
                date_updated__isnull=False,
                date_created__isnull=False
            )[:100]
            if resolved.exists():
                response_times = []
                for report in resolved:
                    if report.date_created and report.date_updated:
                        delta = report.date_updated - report.date_created
                        response_times.append(delta.total_seconds() / 60)
                if response_times:
                    avg_response_time = sum(response_times) / len(response_times)
        except Exception:
            pass
        
        # System health (simplified: based on recent activity)
        system_health = 100  # Placeholder
        
        return Response({
            'total_reports': total_reports,
            'total_organizations': total_organizations,
            'active_incidents': active_incidents,
            'false_reports': false_reports,
            'avg_response_time': round(avg_response_time, 1) if avg_response_time else None,
            'system_health': system_health,
        })


class TriageRulesView(APIView):
    """Triage rules management for SuperAdmin"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_groups = set(request.user.groups.values_list('name', flat=True))
        if ROLE_SUPERADMIN not in user_groups:
            return Response({'detail': 'Only SuperAdmin can access triage rules'}, status=status.HTTP_403_FORBIDDEN)
        
        # For now, return placeholder rules
        # In production, these would be stored in a TriageRule model
        rules = [
            {
                'id': 1,
                'name': 'Critical Severity Threshold',
                'enabled': True,
                'threshold': 90,
                'county': None,
            },
            {
                'id': 2,
                'name': 'High Severity Threshold',
                'enabled': True,
                'threshold': 70,
                'county': None,
            },
            {
                'id': 3,
                'name': 'Nairobi County Critical',
                'enabled': True,
                'threshold': 85,
                'county': 'Nairobi',
            },
        ]
        return Response(rules)

    def post(self, request):
        user_groups = set(request.user.groups.values_list('name', flat=True))
        if ROLE_SUPERADMIN not in user_groups:
            return Response({'detail': 'Only SuperAdmin can modify triage rules'}, status=status.HTTP_403_FORBIDDEN)
        
        # Placeholder - in production, create/update TriageRule model
        return Response({'detail': 'Triage rule created/updated'}, status=status.HTTP_201_CREATED)


class OrgPerformanceView(APIView):
    """Organization performance metrics for SuperAdmin"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Avg
        from .models import SecurityOrgWhitelist
        
        user_groups = set(request.user.groups.values_list('name', flat=True))
        if ROLE_SUPERADMIN not in user_groups:
            return Response({'detail': 'Only SuperAdmin can access org performance'}, status=status.HTTP_403_FORBIDDEN)
        
        orgs = SecurityOrgWhitelist.objects.filter(is_active=True).select_related('user')
        performance_data = []
        
        for org in orgs:
            # Count incidents handled by this org (simplified - would need proper association)
            incidents_handled = CrimeReportBook.objects.filter(
                status__in=[CrimeReportBook.STATUS_RESOLVED, CrimeReportBook.STATUS_CLOSED]
            ).count()  # Placeholder - would filter by org
            
            # Calculate average response time (simplified)
            avg_response_time = 15.0  # Placeholder
            
            # SLA compliance (simplified)
            sla_compliance = 85.0  # Placeholder
            
            performance_data.append({
                'id': org.id,
                'name': org.organization_name,
                'type': org.organization_type,
                'incidents_handled': incidents_handled,
                'avg_response_time': avg_response_time,
                'sla_compliance': sla_compliance,
                'is_active': org.is_active,
            })
        
        return Response(performance_data)


class AnalyticsView(APIView):
    """Analytics endpoint for different models (false detection, hotspot, monetization)"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Q
        from django.utils import timezone
        from datetime import timedelta
        
        user_groups = set(request.user.groups.values_list('name', flat=True))
        if ROLE_SUPERADMIN not in user_groups:
            return Response({'detail': 'Only SuperAdmin can access analytics'}, status=status.HTTP_403_FORBIDDEN)
        
        model_type = request.query_params.get('model', 'false_detection')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        # Build date filter
        date_filter = Q()
        if date_from:
            try:
                date_from_obj = timezone.datetime.fromisoformat(date_from.replace('Z', '+00:00'))
                date_filter &= Q(date_created__gte=date_from_obj)
            except Exception:
                pass
        if date_to:
            try:
                date_to_obj = timezone.datetime.fromisoformat(date_to.replace('Z', '+00:00'))
                date_filter &= Q(date_created__lte=date_to_obj)
            except Exception:
                pass
        
        if model_type == 'false_detection':
            # False report detection model
            suspicious_reports = CrimeReportBook.objects.filter(
                date_filter,
                status='submitted'
            ).exclude(description__isnull=True).exclude(description='')
            
            false_detection_data = []
            for report in suspicious_reports[:50]:
                score = 0
                if report.description and len(report.description) < 10:
                    score += 20
                if report.location_name:
                    same_location_count = CrimeReportBook.objects.filter(
                        location_name=report.location_name,
                        date_created__gte=timezone.now() - timedelta(days=7)
                    ).count()
                    if same_location_count > 5:
                        score += 30
                if not report.upload_criminal_photo and not report.evidence_video:
                    score += 15
                
                false_detection_data.append({
                    'report_id': report.id,
                    'ob_number': report.occurance_book_number,
                    'suspicious_score': min(score, 100),
                    'location': report.location_name,
                    'date': report.date_created.isoformat() if report.date_created else None,
                })
            
            return Response({
                'model': 'false_detection',
                'data': false_detection_data,
                'summary': {
                    'total_analyzed': len(false_detection_data),
                    'high_risk': len([d for d in false_detection_data if d['suspicious_score'] > 70]),
                }
            })
        
        elif model_type == 'hotspot':
            # Hotspot prediction model
            hotspots = CrimeReportBook.objects.filter(
                combined_filter
            ).values('county', 'location_name').annotate(
                count=Count('id')
            ).order_by('-count')[:20]
            
            return Response({
                'model': 'hotspot',
                'data': list(hotspots),
                'summary': {
                    'total_hotspots': len(hotspots),
                    'top_hotspot': hotspots[0] if hotspots else None,
                }
            })
        
        elif model_type == 'monetization':
            # Monetization model
            from .models import SecurityOrgWhitelist
            
            # SuperAdmin can see all orgs, Security Org Users only see their own
            if is_superadmin(request.user):
                orgs = SecurityOrgWhitelist.objects.filter(is_active=True)
            else:
                user_org = get_user_organization(request.user)
                if user_org:
                    orgs = SecurityOrgWhitelist.objects.filter(id=user_org.id, is_active=True)
                else:
                    orgs = SecurityOrgWhitelist.objects.none()
            
            monetization_data = []
            
            for org in orgs:
                incidents_handled = CrimeReportBook.objects.filter(
                    date_filter,
                    assigned_organization=org,
                    status__in=[CrimeReportBook.STATUS_RESOLVED, CrimeReportBook.STATUS_CLOSED]
                ).count()
                
                cost_per_incident = 50.0
                revenue_per_org = 1000.0
                total_cost = incidents_handled * cost_per_incident
                roi = ((revenue_per_org - total_cost) / total_cost * 100) if total_cost > 0 else 0
                
                monetization_data.append({
                    'org_id': org.id,
                    'org_name': org.organization_name,
                    'incidents_handled': incidents_handled,
                    'cost_per_incident': cost_per_incident,
                    'total_cost': total_cost,
                    'revenue': revenue_per_org,
                    'roi': round(roi, 2),
                })
            
            return Response({
                'model': 'monetization',
                'data': monetization_data,
                'summary': {
                    'total_orgs': len(monetization_data),
                    'total_revenue': sum(d['revenue'] for d in monetization_data),
                    'total_cost': sum(d['total_cost'] for d in monetization_data),
                }
            })
        
        return Response({'detail': 'Invalid model type'}, status=status.HTTP_400_BAD_REQUEST)
