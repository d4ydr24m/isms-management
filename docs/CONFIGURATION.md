# 환경 설정 가이드

## 개요

ISMS 관리 시스템의 환경 변수 및 설정 옵션에 대한 상세 가이드입니다.

## 환경 변수

### Backend 환경 변수

#### 애플리케이션 설정

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `SECRET_KEY` | O | - | JWT 서명 키 (최소 32자) |
| `APP_NAME` | X | ISMS Management System | 애플리케이션 이름 |
| `APP_VERSION` | X | 1.0.0 | 애플리케이션 버전 |
| `ENVIRONMENT` | X | development | 환경 (development/staging/production) |
| `DEBUG` | X | true | 디버그 모드 |

**SECRET_KEY 생성 방법:**

```bash
# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# OpenSSL
openssl rand -base64 32
```

#### 데이터베이스 설정

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `DATABASE_URL` | O | - | PostgreSQL 연결 문자열 |

**형식:**
```
postgresql://<user>:<password>@<host>:<port>/<database>
```

**예시:**
```
postgresql://isms_user:password123@localhost:5432/isms_db
```

#### Redis 설정

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `REDIS_URL` | O | - | Redis 연결 문자열 |

**형식:**
```
redis://[[user]:[password]@]<host>:<port>/<db>
```

**예시:**
```
redis://localhost:6379/0
redis://:password@localhost:6379/0
```

#### MinIO 설정

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `MINIO_ENDPOINT` | O | - | MinIO 서버 주소 |
| `MINIO_ACCESS_KEY` | O | - | 액세스 키 |
| `MINIO_SECRET_KEY` | O | - | 시크릿 키 |
| `MINIO_BUCKET_NAME` | X | isms-evidences | 버킷 이름 |
| `MINIO_SECURE` | X | false | HTTPS 사용 여부 |

#### Celery 설정

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `CELERY_BROKER_URL` | O | - | 메시지 브로커 URL |
| `CELERY_RESULT_BACKEND` | O | - | 결과 백엔드 URL |

**예시:**
```
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

#### 이메일 (SMTP) 설정

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `SMTP_HOST` | X | - | SMTP 서버 호스트 |
| `SMTP_PORT` | X | 587 | SMTP 포트 |
| `SMTP_USER` | X | - | SMTP 사용자 |
| `SMTP_PASSWORD` | X | - | SMTP 비밀번호 |
| `SMTP_FROM_EMAIL` | X | - | 발신 이메일 |
| `SMTP_FROM_NAME` | X | - | 발신자 이름 |

**주요 이메일 서비스 설정:**

```env
# Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Amazon SES
SMTP_HOST=email-smtp.ap-northeast-2.amazonaws.com
SMTP_PORT=587
SMTP_USER=<aws-smtp-user>
SMTP_PASSWORD=<aws-smtp-password>

# Naver Works
SMTP_HOST=smtp.worksmobile.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASSWORD=your-password
```

#### 보안 설정

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `ALGORITHM` | X | HS256 | JWT 알고리즘 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | X | 30 | 액세스 토큰 만료 (분) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | X | 7 | 리프레시 토큰 만료 (일) |

#### 비밀번호 정책

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `PASSWORD_MIN_LENGTH` | X | 8 | 최소 길이 |
| `PASSWORD_REQUIRE_UPPERCASE` | X | true | 대문자 필수 |
| `PASSWORD_REQUIRE_LOWERCASE` | X | true | 소문자 필수 |
| `PASSWORD_REQUIRE_DIGIT` | X | true | 숫자 필수 |
| `PASSWORD_REQUIRE_SPECIAL` | X | true | 특수문자 필수 |
| `PASSWORD_EXPIRY_DAYS` | X | 90 | 비밀번호 유효기간 (일) |

#### 계정 보안

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `MAX_LOGIN_ATTEMPTS` | X | 5 | 최대 로그인 시도 횟수 |
| `ACCOUNT_LOCKOUT_DURATION_MINUTES` | X | 30 | 계정 잠금 기간 (분) |
| `SESSION_TIMEOUT_MINUTES` | X | 30 | 세션 타임아웃 (분) |

#### 파일 업로드

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `MAX_UPLOAD_SIZE_MB` | X | 100 | 최대 업로드 크기 (MB) |
| `ALLOWED_EXTENSIONS` | X | pdf,doc,docx,... | 허용 확장자 |

#### CORS 설정

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `BACKEND_CORS_ORIGINS` | X | ["http://localhost:3000"] | 허용 도메인 목록 |

**예시:**
```env
BACKEND_CORS_ORIGINS=["https://isms.example.com","https://admin.example.com"]
```

#### 로깅

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `LOG_LEVEL` | X | INFO | 로그 레벨 (DEBUG/INFO/WARNING/ERROR) |

---

### Frontend 환경 변수

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|-------|------|
| `VITE_API_URL` | O | - | Backend API URL |
| `VITE_WS_URL` | X | - | WebSocket URL |

**예시:**
```env
# 개발
VITE_API_URL=http://localhost:8000

# 운영
VITE_API_URL=https://isms.example.com/api
VITE_WS_URL=wss://isms.example.com/ws
```

---

## 환경별 설정

### 개발 환경

```env
# backend/.env.development
SECRET_KEY=dev-secret-key-for-local-development
ENVIRONMENT=development
DEBUG=true

DATABASE_URL=postgresql://isms_user:isms_password@localhost:5432/isms_db
REDIS_URL=redis://localhost:6379/0

MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123

CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

LOG_LEVEL=DEBUG
```

### 스테이징 환경

```env
# backend/.env.staging
SECRET_KEY=<staging-secret-key>
ENVIRONMENT=staging
DEBUG=false

DATABASE_URL=postgresql://isms_user:<password>@postgres:5432/isms_db
REDIS_URL=redis://:redis-password@redis:6379/0

MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=<staging-access-key>
MINIO_SECRET_KEY=<staging-secret-key>

CELERY_BROKER_URL=redis://:redis-password@redis:6379/0
CELERY_RESULT_BACKEND=redis://:redis-password@redis:6379/0

BACKEND_CORS_ORIGINS=["https://staging.isms.example.com"]
LOG_LEVEL=INFO
```

### 운영 환경

```env
# backend/.env.production
SECRET_KEY=<production-secret-key>
ENVIRONMENT=production
DEBUG=false

DATABASE_URL=postgresql://isms_user:<strong-password>@postgres:5432/isms_db
REDIS_URL=redis://:strong-redis-password@redis:6379/0

MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=<production-access-key>
MINIO_SECRET_KEY=<production-secret-key>
MINIO_SECURE=true

CELERY_BROKER_URL=redis://:strong-redis-password@redis:6379/0
CELERY_RESULT_BACKEND=redis://:strong-redis-password@redis:6379/0

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=<smtp-password>
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME=ISMS 관리 시스템

BACKEND_CORS_ORIGINS=["https://isms.example.com"]
LOG_LEVEL=WARNING

# 강화된 보안 설정
ACCESS_TOKEN_EXPIRE_MINUTES=15
PASSWORD_EXPIRY_DAYS=90
MAX_LOGIN_ATTEMPTS=3
ACCOUNT_LOCKOUT_DURATION_MINUTES=60
```

---

## Docker Compose 환경 변수

### .env 파일 (Docker Compose용)

```env
# Database
DB_PASSWORD=strong-database-password

# Redis
REDIS_PASSWORD=strong-redis-password

# MinIO
MINIO_ACCESS_KEY=minio-access-key
MINIO_SECRET_KEY=strong-minio-secret-key

# Grafana (모니터링 사용 시)
GRAFANA_PASSWORD=grafana-admin-password
```

### docker-compose.yml에서 사용

```yaml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  redis:
    command: redis-server --requirepass ${REDIS_PASSWORD}
```

---

## 시크릿 관리

### 방법 1: 환경 변수 파일 (.env)

```bash
# .env 파일 권한 설정
chmod 600 .env
```

### 방법 2: Docker Secrets (Docker Swarm)

```yaml
# docker-compose.yml
services:
  backend:
    secrets:
      - db_password
      - secret_key

secrets:
  db_password:
    external: true
  secret_key:
    external: true
```

```bash
# 시크릿 생성
echo "my-password" | docker secret create db_password -
```

### 방법 3: HashiCorp Vault

```python
# vault_config.py
import hvac

client = hvac.Client(url='http://vault:8200')
client.token = os.environ.get('VAULT_TOKEN')

secrets = client.secrets.kv.v2.read_secret_version(path='isms/config')
SECRET_KEY = secrets['data']['data']['secret_key']
```

### 방법 4: AWS Secrets Manager

```python
import boto3
import json

def get_secret(secret_name):
    client = boto3.client('secretsmanager', region_name='ap-northeast-2')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

secrets = get_secret('isms/production')
SECRET_KEY = secrets['secret_key']
```

---

## 설정 검증

### Backend 설정 검증 스크립트

```python
# check_config.py
from app.core.config import settings

def validate_config():
    errors = []

    # 필수 설정 검증
    if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
        errors.append("SECRET_KEY must be at least 32 characters")

    if not settings.DATABASE_URL:
        errors.append("DATABASE_URL is required")

    if settings.ENVIRONMENT == "production":
        if settings.DEBUG:
            errors.append("DEBUG must be False in production")

        if "localhost" in settings.DATABASE_URL:
            errors.append("DATABASE_URL should not use localhost in production")

    if errors:
        print("Configuration errors:")
        for error in errors:
            print(f"  - {error}")
        return False

    print("Configuration is valid!")
    return True

if __name__ == "__main__":
    validate_config()
```

### 실행

```bash
python check_config.py
```

---

## 설정 우선순위

1. 환경 변수 (최우선)
2. .env 파일
3. 기본값 (코드에 정의)

```python
# 예시: SECRET_KEY 로드 순서
# 1. os.environ.get('SECRET_KEY')  -> 환경 변수
# 2. .env 파일의 SECRET_KEY        -> pydantic-settings가 자동 로드
# 3. Settings 클래스의 기본값       -> 없으면 에러
```

---

## 트러블슈팅

### 환경 변수가 로드되지 않음

```bash
# .env 파일 위치 확인
ls -la backend/.env

# 환경 변수 직접 확인
docker-compose exec backend env | grep SECRET_KEY

# pydantic-settings 디버깅
python -c "from app.core.config import settings; print(settings.dict())"
```

### 데이터베이스 연결 실패

```bash
# 연결 문자열 확인
echo $DATABASE_URL

# PostgreSQL 연결 테스트
psql $DATABASE_URL -c "SELECT 1"

# Docker 네트워크 확인
docker network inspect isms_network
```

### Redis 연결 실패

```bash
# Redis 연결 테스트
redis-cli -u $REDIS_URL ping

# Docker 내에서 테스트
docker-compose exec redis redis-cli ping
```
