from django.db import migrations, models
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('nawaapp', '0011_neighborhood_phoneotp_incident_devicetoken'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='neighborhood',
            name='polygon',
            field=models.JSONField(null=True, blank=True),
        ),
        migrations.CreateModel(
            name='NeighborhoodMember',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(default='member', max_length=32)),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('neighborhood', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='memberships', to='nawaapp.neighborhood')),
                ('user', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='neighborhood_memberships', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-joined_at'],
                'unique_together': {('neighborhood', 'user')},
            },
        ),
    ]