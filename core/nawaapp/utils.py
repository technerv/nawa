"""
Utility functions for NAWA
"""
import hashlib
import uuid
import uuid as uuid_lib
from django.utils import timezone
from django.db import models
from datetime import timedelta
from ipaddress import ip_address, ip_network
from typing import Optional, Tuple


def get_client_ip(request) -> Optional[str]:
    """Extract client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def generate_device_fingerprint(request) -> str:
    """
    Generate a privacy-safe device fingerprint hash.
    Combines user agent, language preferences, and encoding headers.
    Does NOT include PII.
    """
    components = []
    
    # User agent (browser/device type)
    ua = request.META.get('HTTP_USER_AGENT', '')
    if ua:
        components.append(ua)
    
    # Accept-Language header (language preferences)
    lang = request.META.get('HTTP_ACCEPT_LANGUAGE', '')
    if lang:
        components.append(lang)
    
    # Accept-Encoding (compression support)
    encoding = request.META.get('HTTP_ACCEPT_ENCODING', '')
    if encoding:
        components.append(encoding)
    
    # Combine and hash
    fingerprint_string = '|'.join(components)
    return hashlib.sha256(fingerprint_string.encode()).hexdigest()


def get_or_create_anonymous_session(request, session_id: Optional[str] = None):
    """
    Get or create an anonymous session for tracking public reports.
    Returns (session, created) tuple.
    """
    from .models import AnonymousSession, DeviceFingerprint
    
    # Generate or use provided session ID
    if not session_id:
        session_uuid = uuid_lib.uuid4()
    else:
        try:
            session_uuid = uuid_lib.UUID(str(session_id))
            # Try to get existing session
            try:
                session = AnonymousSession.objects.get(session_id=session_uuid)
                # Update last_seen
                session.last_seen = timezone.now()
                session.save(update_fields=['last_seen'])
                return session, False
            except AnonymousSession.DoesNotExist:
                pass
        except (ValueError, TypeError):
            # Invalid UUID format, generate new one
            session_uuid = uuid_lib.uuid4()
    
    # Get device fingerprint
    device_fp = generate_device_fingerprint(request)
    ip_addr = get_client_ip(request)
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    
    # Check if device is blocked
    try:
        device_record = DeviceFingerprint.objects.get(fingerprint_hash=device_fp)
        if device_record.is_blocked:
            raise ValueError(f"Device is blocked: {device_record.blocked_reason or 'Abuse detected'}")
    except DeviceFingerprint.DoesNotExist:
        # Create device fingerprint record
        device_record = DeviceFingerprint.objects.create(
            fingerprint_hash=device_fp,
            ip_address=ip_addr,
            user_agent=user_agent,
            metadata={'first_ip': ip_addr}
        )
    
    # Create anonymous session
    session = AnonymousSession.objects.create(
        session_id=session_uuid,
        device_fingerprint=device_fp,
        ip_address=ip_addr,
        user_agent=user_agent
    )
    
    return session, True


def check_rate_limit(session, max_per_hour: int = 10, max_per_day: int = 50) -> Tuple[bool, Optional[str]]:
    """
    Check if session has exceeded rate limits.
    Returns (allowed, reason) tuple.
    """
    from .models import AnonymousSession, DeviceFingerprint
    
    now = timezone.now()
    one_hour_ago = now - timedelta(hours=1)
    one_day_ago = now - timedelta(days=1)
    
    # Check session-level limits (using report_count from session itself)
    # For hourly limit, we check the session's report_count if it was updated in the last hour
    if session.last_seen >= one_hour_ago:
        # Session was active in last hour, check its report_count
        if session.report_count >= max_per_hour:
            return False, f"Rate limit exceeded: {max_per_hour} reports per hour"
    
    # Check device-level limits
    if session.device_fingerprint:
        try:
            device = DeviceFingerprint.objects.get(fingerprint_hash=session.device_fingerprint)
            if device.report_count >= max_per_day:
                return False, f"Device limit exceeded: {max_per_day} reports per day"
        except DeviceFingerprint.DoesNotExist:
            pass
    
    # Check IP-level limits (aggregate across all sessions from same IP)
    if session.ip_address:
        ip_reports_today = AnonymousSession.objects.filter(
            ip_address=session.ip_address,
            last_seen__gte=one_day_ago
        ).aggregate(total=models.Sum('report_count'))['total'] or 0
        
        if ip_reports_today >= max_per_day * 2:  # Allow 2x per IP (multiple devices)
            return False, f"IP limit exceeded: {max_per_day * 2} reports per day from this IP"
    
    return True, None


def is_ip_whitelisted(ip: str, whitelist_entry) -> bool:
    """Check if IP address is in the whitelist's allowed IP ranges"""
    if not ip or not whitelist_entry.allowed_ip_ranges:
        return False
    
    try:
        client_ip = ip_address(ip)
        for cidr in whitelist_entry.allowed_ip_ranges:
            try:
                network = ip_network(cidr, strict=False)
                if client_ip in network:
                    return True
            except ValueError:
                continue
    except ValueError:
        pass
    
    return False
