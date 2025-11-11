"""
Channel providers for sending alerts via SMS, Email, and Push notifications.
Supports Africa's Talking, Twilio (SMS), SendGrid (Email), and FCM (Push).
"""
import logging
import os
from typing import Optional, Dict, Any
from django.conf import settings
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


class SMSProvider:
    """Base SMS provider interface"""
    def send(self, to: str, message: str) -> bool:
        raise NotImplementedError


class AfricasTalkingSMS(SMSProvider):
    """Africa's Talking SMS provider (Kenya-focused)"""
    def __init__(self):
        self.api_key = os.getenv('AFRICAS_TALKING_API_KEY', '')
        self.username = os.getenv('AFRICAS_TALKING_USERNAME', 'sandbox')
        self.from_shortcode = os.getenv('AFRICAS_TALKING_SHORTCODE', '')
        self.enabled = bool(self.api_key and self.username)

    def send(self, to: str, message: str) -> bool:
        if not self.enabled:
            logger.warning("Africa's Talking SMS not configured, skipping send to %s", to)
            return False

        try:
            # Remove + prefix if present, ensure starts with country code
            phone = to.lstrip('+')
            if not phone.startswith('254'):  # Kenya country code
                phone = '254' + phone.lstrip('0')

            # Use Africa's Talking SDK if available, otherwise HTTP API
            try:
                import africastalking
                africastalking.initialize(self.username, self.api_key)
                sms = africastalking.SMS
                response = sms.send(message, [f"+{phone}"], sender_id=self.from_shortcode or None)
                logger.info("Africa's Talking SMS sent to %s: %s", phone, response)
                return True
            except ImportError:
                # Fallback to HTTP API
                import requests
                url = 'https://api.africastalking.com/version1/messaging'
                headers = {
                    'ApiKey': self.api_key,
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
                data = {
                    'username': self.username,
                    'to': f"+{phone}",
                    'message': message,
                }
                if self.from_shortcode:
                    data['from'] = self.from_shortcode
                resp = requests.post(url, headers=headers, data=data, timeout=10)
                resp.raise_for_status()
                logger.info("Africa's Talking SMS sent to %s via HTTP", phone)
                return True
        except Exception as e:
            logger.error("Failed to send Africa's Talking SMS to %s: %s", to, e)
            return False


class TwilioSMS(SMSProvider):
    """Twilio SMS provider (fallback/international)"""
    def __init__(self):
        self.account_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
        self.auth_token = os.getenv('TWILIO_AUTH_TOKEN', '')
        self.from_number = os.getenv('TWILIO_FROM_NUMBER', '')
        self.enabled = bool(self.account_sid and self.auth_token and self.from_number)

    def send(self, to: str, message: str) -> bool:
        if not self.enabled:
            logger.warning("Twilio SMS not configured, skipping send to %s", to)
            return False

        try:
            from twilio.rest import Client
            client = Client(self.account_sid, self.auth_token)
            message_obj = client.messages.create(
                body=message,
                from_=self.from_number,
                to=to
            )
            logger.info("Twilio SMS sent to %s: %s", to, message_obj.sid)
            return True
        except ImportError:
            logger.warning("Twilio SDK not installed, skipping SMS to %s", to)
            return False
        except Exception as e:
            logger.error("Failed to send Twilio SMS to %s: %s", to, e)
            return False


class EmailProvider:
    """Email provider using SendGrid"""
    def __init__(self):
        self.api_key = os.getenv('SENDGRID_API_KEY', '')
        self.from_email = os.getenv('SENDGRID_FROM_EMAIL', 'noreply@nawa.local')
        self.from_name = os.getenv('SENDGRID_FROM_NAME', 'Neighbourhood Alert Watch App')
        self.enabled = bool(self.api_key)

    def send(self, to: str, subject: str, message: str, html_message: Optional[str] = None) -> bool:
        if not self.enabled:
            logger.warning("SendGrid not configured, skipping email to %s", to)
            return False

        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail, Email, To, Content

            sg = sendgrid.SendGridAPIClient(api_key=self.api_key)
            from_email = Email(self.from_email, self.from_name)
            to_email = To(to)
            content = Content("text/html", html_message or message)
            mail = Mail(from_email, to_email, subject, content)

            response = sg.client.mail.send.post(request_body=mail.get())
            logger.info("SendGrid email sent to %s: %s", to, response.status_code)
            return True
        except ImportError:
            # Fallback to Django email backend
            try:
                from django.core.mail import send_mail
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=f"{self.from_name} <{self.from_email}>",
                    recipient_list=[to],
                    html_message=html_message,
                    fail_silently=False,
                )
                logger.info("Email sent via Django backend to %s", to)
                return True
            except Exception as e:
                logger.error("Failed to send email via Django backend to %s: %s", to, e)
                return False
        except Exception as e:
            logger.error("Failed to send SendGrid email to %s: %s", to, e)
            return False


class PushProvider:
    """Push notification provider using Firebase Cloud Messaging (FCM)"""
    def __init__(self):
        self.server_key = os.getenv('FCM_SERVER_KEY', '')
        self.project_id = os.getenv('FCM_PROJECT_ID', '')
        self.enabled = bool(self.server_key)

    def send(self, to_token: str, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> bool:
        if not self.enabled:
            logger.warning("FCM not configured, skipping push to token %s", to_token[:10])
            return False

        try:
            import requests
            url = 'https://fcm.googleapis.com/v1/projects/{}/messages:send'.format(self.project_id or 'default')
            headers = {
                'Authorization': f'Bearer {self._get_access_token()}',
                'Content-Type': 'application/json',
            }
            payload = {
                'message': {
                    'token': to_token,
                    'notification': {
                        'title': title,
                        'body': body,
                    },
                    'data': data or {},
                }
            }
            resp = requests.post(url, headers=headers, json=payload, timeout=10)
            resp.raise_for_status()
            logger.info("FCM push sent to token %s", to_token[:10])
            return True
        except Exception as e:
            logger.error("Failed to send FCM push to %s: %s", to_token[:10], e)
            return False

    def _get_access_token(self) -> str:
        """Get OAuth2 access token for FCM (simplified - use service account in production)"""
        # In production, use google-auth library with service account JSON
        # For now, return server key as bearer token (legacy FCM)
        return self.server_key


# Singleton instances
_sms_provider = None
_email_provider = None
_push_provider = None


def get_sms_provider() -> SMSProvider:
    """Get configured SMS provider (prefers Africa's Talking, falls back to Twilio)"""
    global _sms_provider
    if _sms_provider is None:
        at = AfricasTalkingSMS()
        if at.enabled:
            _sms_provider = at
        else:
            _sms_provider = TwilioSMS()
    return _sms_provider


def get_email_provider() -> EmailProvider:
    """Get configured email provider"""
    global _email_provider
    if _email_provider is None:
        _email_provider = EmailProvider()
    return _email_provider


def get_push_provider() -> PushProvider:
    """Get configured push provider"""
    global _push_provider
    if _push_provider is None:
        _push_provider = PushProvider()
    return _push_provider


def get_user_contact(user: User, channel: str) -> Optional[str]:
    """Get user's contact info for a channel (phone for SMS, email for email, FCM token for push)"""
    if channel == 'sms':
        # Try to get phone from user profile
        profile = getattr(user, 'profile', None)
        if profile and profile.phone_number:
            return profile.phone_number
        # Fallback: check if user.email looks like a phone (unlikely but possible)
        if user.email and user.email.replace('+', '').replace('-', '').isdigit():
            return user.email
        return None
    elif channel == 'email':
        return user.email
    elif channel == 'push':
        # Get FCM token from UserProfile
        profile = getattr(user, 'profile', None)
        if profile and profile.fcm_token:
            return profile.fcm_token
        return None
    return None

