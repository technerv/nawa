"""
Django settings for core project.
"""
import os
from pathlib import Path
try:
	from dotenv import load_dotenv
except ImportError:
	def load_dotenv(*args, **kwargs):
		return False
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-only-insecure-secret-key')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DJANGO_DEBUG', 'True').lower() in ('1', 'true', 'yes')

ALLOWED_HOSTS = [h.strip() for h in os.getenv('DJANGO_ALLOWED_HOSTS', '*').split(',')]


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # MAIN APP    
    'nawaapp',
    
    # THIRD PARTY APPS
    'rest_framework',
	'django_filters',
	'corsheaders',
	'drf_spectacular',
]

REST_FRAMEWORK = {

    'DATETIME_FORMAT': '%d/%m/%Y %H:%M:%S',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
	'PAGE_SIZE': int(os.getenv('DJANGO_PAGE_SIZE', '10')),

    'DEFAULT_AUTHENTICATION_CLASSES': [
		'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.BasicAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ], 
    
    'DEFAULT_PERMISSION_CLASSES' : [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
	'DEFAULT_FILTER_BACKENDS': [
		'django_filters.rest_framework.DjangoFilterBackend',
		'rest_framework.filters.SearchFilter',
		'rest_framework.filters.OrderingFilter',
	],
	'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
	
 }

SPECTACULAR_SETTINGS = {
	'TITLE': 'Neighbourhood Alert Watch App API',
	'DESCRIPTION': 'API documentation for Neighbourhood Alert Watch App backend',
	'VERSION': '1.0.0',
	'SERVE_INCLUDE_SCHEMA': False,
}

from datetime import timedelta
from corsheaders.defaults import default_headers
SIMPLE_JWT = {
	'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.getenv('JWT_ACCESS_MINUTES', '60'))),
	'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.getenv('JWT_REFRESH_DAYS', '7'))),
	'ROTATE_REFRESH_TOKENS': False,
	'BLACKLIST_AFTER_ROTATION': False,
	'ALGORITHM': 'HS256',
	'SIGNING_KEY': SECRET_KEY,
	'VERIFYING_KEY': None,
	'AUTH_HEADER_TYPES': ('Bearer',),
 }

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
	'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'


# Database
# https://docs.djangoproject.com/en/3.2/ref/settings/#databases

DATABASES = {
    'default': {
		'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.sqlite3'),
		'NAME': os.getenv('DB_NAME', BASE_DIR / 'db.sqlite3'),
		'USER': os.getenv('DB_USER', ''),
		'PASSWORD': os.getenv('DB_PASSWORD', ''),
		'HOST': os.getenv('DB_HOST', ''),
		'PORT': os.getenv('DB_PORT', ''),
    }
}


# Password validation
# https://docs.djangoproject.com/en/3.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/3.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Africa/Nairobi'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/3.2/howto/static-files/

STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

STATIC_URL = '/static/'

MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

MEDIA_URL = '/media/'

# Default primary key field type
# https://docs.djangoproject.com/en/3.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL_ORIGINS', 'True').lower() in ('1', 'true', 'yes')
_cors_origins = os.getenv('CORS_ALLOWED_ORIGINS', '')
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(',') if o.strip()]
CORS_ALLOW_HEADERS = list(default_headers) + [
    'if-none-match',
]

# Role permissions enforcement (set to True in production to enforce group-based perms)
ENFORCE_ROLE_PERMS = os.getenv('ENFORCE_ROLE_PERMS', 'False').lower() in ('1', 'true', 'yes')

# Public site mode (controls rendering and public endpoints behavior)
PUBLIC_MODE = os.getenv('PUBLIC_MODE', 'False').lower() in ('1', 'true', 'yes')

# Throttle rates (used for public endpoints)
REST_FRAMEWORK_PUBLIC_THROTTLE_RATES = {
	'public': os.getenv('PUBLIC_THROTTLE_RATE', '60/min'),
}

# Celery Configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
	'check-sla-breaches': {
		'task': 'nawaapp.tasks.check_sla_breaches',
		'schedule': 600.0,  # Every 10 minutes
	},
	'send-daily-summary': {
		'task': 'nawaapp.tasks.send_daily_summary',
		'schedule': 86400.0,  # Daily at midnight (adjust with crontab_beat for 06:00)
	},
    'retry-failed-alerts': {
        'task': 'nawaapp.tasks.retry_failed_alerts',
        'schedule': 300.0,  # Every 5 minutes
    },
    'warm-subcounties-cache': {
        'task': 'nawaapp.tasks.warm_subcounties_cache',
        'schedule': 43200.0,  # Every 12 hours
    },
}
