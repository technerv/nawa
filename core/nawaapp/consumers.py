import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from jwt import decode as jwt_decode
from django.conf import settings

User = get_user_model()


class AlertConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time alerts (SuperAdmin only)"""
    
    async def connect(self):
        try:
            # Authenticate user
            user = await self.authenticate_user()
            if not user or not user.is_authenticated:
                await self.close(code=4001)  # Unauthorized
                return
            
            # Check if user is SuperAdmin
            from .org_access import is_superadmin
            is_admin = await database_sync_to_async(is_superadmin)(user)
            if not is_admin:
                # Only SuperAdmin can connect to alerts_all
                await self.close(code=4003)  # Forbidden - SuperAdmin only
                return
            
            self.user = user
            self.room_group_name = 'alerts_all'
            
            # Join room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            await self.accept()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in AlertConsumer.connect: {e}", exc_info=True)
            try:
                await self.close(code=4006)  # Internal server error
            except:
                pass
    
    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))
        except json.JSONDecodeError:
            pass
    
    async def alert_message(self, event):
        """Receive message from room group"""
        await self.send(text_data=json.dumps({
            'type': 'alert',
            'data': event['data']
        }))
    
    @database_sync_to_async
    def authenticate_user(self):
        """Authenticate user from WebSocket token"""
        try:
            # Get token from query string or headers
            token = None
            query_string = self.scope.get('query_string', b'').decode()
            if 'token=' in query_string:
                token = query_string.split('token=')[1].split('&')[0]
            
            if not token:
                # Try to get from subprotocol
                subprotocols = self.scope.get('subprotocols', [])
                for sub in subprotocols:
                    if sub.startswith('token.'):
                        token = sub.replace('token.', '')
                        break
            
            if not token:
                return AnonymousUser()
            
            # Decode JWT token
            try:
                UntypedToken(token)
            except (InvalidToken, TokenError):
                return AnonymousUser()
            
            decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = decoded_data.get('user_id')
            if user_id:
                return User.objects.get(id=user_id)
        except Exception:
            pass
        return AnonymousUser()


class OrgAlertConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for organization-specific alerts"""
    
    async def connect(self):
        try:
            user = await self.authenticate_user()
            if not user or not user.is_authenticated:
                await self.close(code=4001)  # Unauthorized
                return
            
            self.user = user
            
            # Get user's organization and role
            from .org_access import get_user_organization, is_superadmin, is_security_org_user
            import logging
            logger = logging.getLogger(__name__)
            
            try:
                is_admin = await database_sync_to_async(is_superadmin)(user)
                is_security_org = await database_sync_to_async(is_security_org_user)(user)
                user_org = await database_sync_to_async(get_user_organization)(user)
            except Exception as e:
                # Log error but don't expose to client
                logger.error(f"Error getting user organization/role: {e}", exc_info=True)
                await self.close(code=4002)  # Internal error
                return
            
            # Get org_id from URL
            try:
                org_id = self.scope['url_route']['kwargs'].get('org_id')
                if not org_id:
                    logger.warning(f"Missing org_id in URL for user {user.id}")
                    await self.close(code=4003)  # Bad request
                    return
            except (KeyError, AttributeError) as e:
                logger.warning(f"Error getting org_id from URL: {e}")
                await self.close(code=4003)  # Bad request
                return
            
            # Authorization checks
            # SuperAdmin can connect to any org channel
            if is_admin:
                # SuperAdmin allowed - proceed
                pass
            elif is_security_org:
                # Security Org Users must have an organization
                if not user_org:
                    logger.warning(f"Security org user {user.id} has no organization whitelist")
                    await self.close(code=4004)  # Forbidden - no organization
                    return
                
                # Security Org Users can only connect to their own org
                if str(user_org.id) != str(org_id):
                    logger.warning(f"User {user.id} org {user_org.id} doesn't match requested org {org_id}")
                    await self.close(code=4005)  # Forbidden - org mismatch
                    return
            else:
                # Non-security org users cannot connect to org channels
                logger.warning(f"Non-security org user {user.id} attempted to connect to org channel")
                await self.close(code=4003)  # Forbidden
                return
            
            self.room_group_name = f'alerts_org_{org_id}'
            
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            await self.accept()
        except Exception as e:
            # Log unexpected errors
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Unexpected error in OrgAlertConsumer.connect: {e}", exc_info=True)
            try:
                await self.close(code=4006)  # Internal server error
            except:
                pass
    
    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))
        except json.JSONDecodeError:
            pass
    
    async def alert_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'alert',
            'data': event['data']
        }))
    
    @database_sync_to_async
    def authenticate_user(self):
        """Authenticate user from WebSocket token"""
        try:
            token = None
            query_string = self.scope.get('query_string', b'').decode()
            if 'token=' in query_string:
                token = query_string.split('token=')[1].split('&')[0]
            
            if not token:
                return AnonymousUser()
            
            try:
                UntypedToken(token)
            except (InvalidToken, TokenError):
                return AnonymousUser()
            
            decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            user_id = decoded_data.get('user_id')
            if user_id:
                return User.objects.get(id=user_id)
        except Exception:
            pass
        return AnonymousUser()

