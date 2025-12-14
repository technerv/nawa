"""
Middleware for Security Org User whitelist checking
"""
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from .models import SecurityOrgWhitelist
from .utils import get_client_ip, is_ip_whitelisted
from .roles import ROLE_SECURITY_ORG


class SecurityOrgWhitelistMiddleware(MiddlewareMixin):
    """
    Middleware to check if authenticated Security Org Users are whitelisted.
    Only applies to authenticated users with SecurityOrgUser role.
    """
    
    def process_request(self, request):
        # Skip for anonymous users
        if not request.user or not request.user.is_authenticated:
            return None
        
        # Check if user has SecurityOrgUser role
        user_groups = set(request.user.groups.values_list('name', flat=True))
        if ROLE_SECURITY_ORG not in user_groups:
            return None  # Not a Security Org User, skip check
        
        # Check if user is whitelisted
        try:
            whitelist = SecurityOrgWhitelist.objects.get(user=request.user)
            
            # Check if whitelist entry is active
            if not whitelist.is_active:
                return JsonResponse({
                    'detail': 'Your Security Org account is inactive. Contact SuperAdmin for access.'
                }, status=403)
            
            # Check IP whitelisting if configured
            if whitelist.allowed_ip_ranges:
                client_ip = get_client_ip(request)
                if client_ip and not is_ip_whitelisted(client_ip, whitelist):
                    return JsonResponse({
                        'detail': f'Access denied: IP address {client_ip} not in allowed ranges for {whitelist.organization_name}'
                    }, status=403)
            
        except SecurityOrgWhitelist.DoesNotExist:
            # Security Org User must be whitelisted
            return JsonResponse({
                'detail': 'Security Org User account not whitelisted. Contact SuperAdmin for access.'
            }, status=403)
        
        return None

