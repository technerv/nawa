# Generated migration for new models: AnonymousSession, SecurityOrgWhitelist, DeviceFingerprint

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('nawaapp', '0015_neighborhoodmessage'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeviceFingerprint',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fingerprint_hash', models.CharField(db_index=True, max_length=64, unique=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, db_index=True, null=True)),
                ('user_agent', models.TextField(blank=True, null=True)),
                ('first_seen', models.DateTimeField(auto_now_add=True)),
                ('last_seen', models.DateTimeField(auto_now=True)),
                ('report_count', models.IntegerField(default=0)),
                ('abuse_score', models.FloatField(default=0.0, help_text='ML/rule-based abuse score')),
                ('is_blocked', models.BooleanField(default=False)),
                ('blocked_reason', models.TextField(blank=True, null=True)),
                ('blocked_at', models.DateTimeField(blank=True, null=True)),
                ('metadata', models.JSONField(default=dict, help_text='Additional device metadata')),
            ],
            options={
                'ordering': ['-last_seen'],
            },
        ),
        migrations.CreateModel(
            name='AnonymousSession',
            fields=[
                ('session_id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('device_fingerprint', models.CharField(blank=True, db_index=True, max_length=64, null=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, db_index=True, null=True)),
                ('user_agent', models.TextField(blank=True, null=True)),
                ('first_seen', models.DateTimeField(auto_now_add=True)),
                ('last_seen', models.DateTimeField(auto_now=True)),
                ('report_count', models.IntegerField(default=0)),
                ('is_blocked', models.BooleanField(default=False)),
                ('blocked_reason', models.TextField(blank=True, null=True)),
                ('blocked_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'ordering': ['-last_seen'],
            },
        ),
        migrations.CreateModel(
            name='SecurityOrgWhitelist',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('organization_name', models.CharField(max_length=200, verbose_name='Organization Name')),
                ('organization_type', models.CharField(choices=[('police', 'National Police Service'), ('county_command', 'County Command Center'), ('private_security', 'Private Security Firm'), ('emergency', 'Emergency Responder'), ('other', 'Other')], default='other', max_length=50)),
                ('contact_person', models.CharField(blank=True, max_length=200, null=True)),
                ('contact_email', models.EmailField(blank=True, max_length=254, null=True)),
                ('contact_phone', models.CharField(blank=True, max_length=20, null=True)),
                ('allowed_ip_ranges', models.JSONField(default=list, help_text='List of IP ranges (CIDR notation) allowed for this org')),
                ('allowed_vpn_names', models.JSONField(default=list, help_text='List of VPN names/identifiers allowed')),
                ('is_active', models.BooleanField(default=True)),
                ('notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='whitelisted_orgs', to=settings.AUTH_USER_MODEL)),
                ('user', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='security_org_whitelist', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Security Org Whitelist',
                'verbose_name_plural': 'Security Org Whitelists',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='devicefingerprint',
            index=models.Index(fields=['fingerprint_hash', 'is_blocked'], name='nawaapp_dev_fp_hash_idx'),
        ),
        migrations.AddIndex(
            model_name='devicefingerprint',
            index=models.Index(fields=['ip_address', 'is_blocked'], name='nawaapp_dev_fp_ip_idx'),
        ),
        migrations.AddIndex(
            model_name='anonymoussession',
            index=models.Index(fields=['device_fingerprint', 'last_seen'], name='nawaapp_anon_dev_fp_idx'),
        ),
        migrations.AddIndex(
            model_name='anonymoussession',
            index=models.Index(fields=['ip_address', 'last_seen'], name='nawaapp_anon_ip_addr_idx'),
        ),
    ]
