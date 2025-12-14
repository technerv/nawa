"""
Utility functions for sending WebSocket messages
"""
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import CrimeReportBook


def send_alert_to_websocket(alert_data, report=None):
    """
    Send alert to all connected WebSocket clients.
    Only SuperAdmins receive alerts from 'alerts_all' channel.
    Organization-specific alerts go to their org channel.
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    
    # If report is provided, send to organization-specific channel
    if report and hasattr(report, 'assigned_organization') and report.assigned_organization:
        org_id = report.assigned_organization.id
        async_to_sync(channel_layer.group_send)(
            f'alerts_org_{org_id}',
            {
                'type': 'alert_message',
                'data': alert_data
            }
        )
    
    # Also send to 'alerts_all' for SuperAdmins
    async_to_sync(channel_layer.group_send)(
        'alerts_all',
        {
            'type': 'alert_message',
            'data': alert_data
        }
    )


def send_alert_to_org(org_id, alert_data):
    """Send alert to organization-specific WebSocket channel"""
    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f'alerts_org_{org_id}',
            {
                'type': 'alert_message',
                'data': alert_data
            }
        )

