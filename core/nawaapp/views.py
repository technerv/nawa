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
from rest_framework.pagination import PageNumberPagination
from .alerting import create_alert_event
from .models import Neighborhood, NeighborhoodMember, AlertSubscription
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
            if not title.endswith('County') and title not in ('Unknown',):
                return f"{title} County"
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

class PublicReportsView(APIView):
    throttle_classes = [PublicAnonRateThrottle]
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = CrimeReportBook.objects.all()
        search = request.query_params.get('search')
        ordering = request.query_params.get('ordering') or '-date_updated'
        county = request.query_params.get('county')

        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(name_of_crime__icontains=search) |
                Q(description__icontains=search) |
                Q(location_name__icontains=search)
            )
        if county:
            from django.db.models import Q
            qs = qs.filter(Q(county__icontains=county) | Q(location_name__icontains=county))

        if ordering:
            try:
                qs = qs.order_by(ordering)
            except Exception:
                pass

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        rows = []
        for obj in page:
            rows.append({
                'id': obj.id,
                'name_of_crime': obj.name_of_crime,
                'description': obj.description,
                'location_name': obj.location_name,
                'county': obj.county,
                'date_updated': obj.date_updated,
                'category_of_crime_name': obj.category_of_crime.crime_category if obj.category_of_crime_id else None,
                'occurance_book_number': obj.occurance_book_number,
            })
        return paginator.get_paginated_response(rows)

    def post(self, request):
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
        # Persist (skip full_clean to avoid blank-string validation on optional fields)
        try:
            obj.save()
        except Exception as e:
            return Response({'detail': f'Failed to save: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            create_alert_event(obj, 'created', note='Report created anonymously')
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
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        User = get_user_model()
        rows = []
        by_role = {}
        for u in User.objects.all().order_by('username'):
            roles = list(u.groups.values_list('name', flat=True))
            for r in roles:
                by_role[r] = by_role.get(r, 0) + 1
            rows.append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'roles': roles,
                'is_superuser': u.is_superuser,
                'is_staff': u.is_staff,
            })
        return Response({'results': rows, 'total': len(rows), 'by_role': by_role})
