# 배포 가이드

## 개요

ISMS 관리 시스템의 운영 환경 배포를 위한 가이드입니다.

## 아키텍처 개요

```
                    ┌──────────────┐
                    │   Client     │
                    │  (Browser)   │
                    └──────┬───────┘
                           │ HTTPS (443)
                    ┌──────┴───────┐
                    │    Nginx     │
                    │   (Reverse   │
                    │    Proxy)    │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────┴───────┐ ┌─────┴──────┐ ┌──────┴───────┐
    │   Frontend   │ │  Backend   │ │   MinIO      │
    │   (React)    │ │  (FastAPI) │ │  (Storage)   │
    │  Port 3000   │ │  Port 8000 │ │  Port 9000   │
    └──────────────┘ └─────┬──────┘ └──────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────┴───────┐ ┌─────┴──────┐ ┌──────┴───────┐
    │  PostgreSQL  │ │   Redis    │ │   Celery     │
    │   (DB)       │ │  (Cache)   │ │  (Worker)    │
    │  Port 5432   │ │  Port 6379 │ │              │
    └──────────────┘ └────────────┘ └──────────────┘
```

## 배포 옵션

### 옵션 1: Docker Compose (권장)

소규모 ~ 중규모 환경에 적합합니다.

### 옵션 2: Kubernetes

대규모 환경 또는 고가용성이 필요한 경우에 적합합니다.

### 옵션 3: AWS/GCP/Azure 관리형 서비스

클라우드 환경에서 관리형 서비스를 활용하는 방식입니다.

---

## Docker Compose 배포

### 1. 서버 요구사항

| 항목 | 최소 | 권장 |
|------|-----|------|
| CPU | 4 Core | 8 Core |
| RAM | 8 GB | 16 GB |
| Storage | 50 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### 2. 사전 준비

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Compose 설치
sudo apt install docker-compose-plugin -y

# 로그아웃 후 재로그인
exit
```

### 3. 프로젝트 배포

```bash
# 프로젝트 클론
git clone https://github.com/your-org/isms-management.git
cd isms-management

# 운영 환경 설정 파일 생성
cp docker-compose.prod.yml docker-compose.override.yml
```

### 4. 환경 변수 설정

**backend/.env:**

```env
# Application
SECRET_KEY=<최소-32자-랜덤-문자열>
ENVIRONMENT=production
DEBUG=false

# Database
DATABASE_URL=postgresql://isms_user:<strong-password>@postgres:5432/isms_db

# Redis
REDIS_URL=redis://redis:6379/0

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=<minio-access-key>
MINIO_SECRET_KEY=<minio-secret-key>
MINIO_BUCKET_NAME=isms-evidences

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# SMTP
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=587
SMTP_USER=noreply@your-domain.com
SMTP_PASSWORD=<smtp-password>
SMTP_FROM_EMAIL=noreply@your-domain.com
SMTP_FROM_NAME=ISMS 관리 시스템

# CORS
BACKEND_CORS_ORIGINS=["https://isms.your-domain.com"]
```

**frontend/.env:**

```env
VITE_API_URL=https://isms.your-domain.com/api
VITE_WS_URL=wss://isms.your-domain.com/ws
```

### 5. docker-compose.prod.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: isms_postgres
    restart: always
    environment:
      POSTGRES_DB: isms_db
      POSTGRES_USER: isms_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backup:/backup
    networks:
      - isms_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U isms_user -d isms_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: isms_redis
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - isms_network

  minio:
    image: minio/minio:latest
    container_name: isms_minio
    restart: always
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    networks:
      - isms_network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: isms_backend
    restart: always
    env_file:
      - ./backend/.env
    volumes:
      - backend_logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - isms_network

  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: isms_celery_worker
    restart: always
    env_file:
      - ./backend/.env
    command: celery -A app.core.celery_app worker --loglevel=warning
    depends_on:
      - redis
      - postgres
    networks:
      - isms_network

  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: isms_celery_beat
    restart: always
    env_file:
      - ./backend/.env
    command: celery -A app.core.celery_app beat --loglevel=warning
    depends_on:
      - redis
    networks:
      - isms_network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    container_name: isms_frontend
    restart: always
    networks:
      - isms_network

  nginx:
    image: nginx:alpine
    container_name: isms_nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - backend
      - frontend
    networks:
      - isms_network

volumes:
  postgres_data:
  redis_data:
  minio_data:
  backend_logs:
  nginx_logs:

networks:
  isms_network:
    driver: bridge
```

### 6. Nginx 설정 (nginx.prod.conf)

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # 로깅
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # 성능 최적화
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip 압축
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript;

    # 보안 헤더
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # HTTP -> HTTPS 리다이렉트
    server {
        listen 80;
        server_name isms.your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS 서버
    server {
        listen 443 ssl http2;
        server_name isms.your-domain.com;

        # SSL 설정
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_session_tickets off;

        # Modern SSL Configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;

        # HSTS
        add_header Strict-Transport-Security "max-age=63072000" always;

        # Frontend
        location / {
            proxy_pass http://frontend:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Backend API
        location /api/ {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://backend:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # 타임아웃 설정
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # 로그인 엔드포인트 Rate Limiting
        location /api/v1/auth/login {
            limit_req zone=login burst=5 nodelay;

            proxy_pass http://backend:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://backend:8000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # API 문서 (운영 환경에서는 비활성화 권장)
        location /docs {
            # IP 화이트리스트
            # allow 10.0.0.0/8;
            # deny all;

            proxy_pass http://backend:8000;
        }

        # 파일 업로드 크기 제한
        client_max_body_size 100M;
    }
}
```

### 7. SSL 인증서 설정

**Let's Encrypt 사용:**

```bash
# Certbot 설치
sudo apt install certbot -y

# 인증서 발급
sudo certbot certonly --standalone -d isms.your-domain.com

# 인증서 복사
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/isms.your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/isms.your-domain.com/privkey.pem nginx/ssl/
sudo chmod 644 nginx/ssl/*.pem
```

### 8. 배포 실행

```bash
# 이미지 빌드 및 시작
docker-compose -f docker-compose.prod.yml up -d --build

# 데이터베이스 마이그레이션
docker-compose exec backend alembic upgrade head

# 초기 데이터 시드
docker-compose exec backend python -m app.db.init_db

# 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f
```

---

## 고가용성 구성

### 데이터베이스 복제

**PostgreSQL Primary-Replica 구성:**

```yaml
# docker-compose.ha.yml
services:
  postgres_primary:
    image: postgres:15-alpine
    environment:
      POSTGRES_REPLICATION_MODE: master
      POSTGRES_REPLICATION_USER: replication
      POSTGRES_REPLICATION_PASSWORD: ${REPLICATION_PASSWORD}
    volumes:
      - postgres_primary_data:/var/lib/postgresql/data

  postgres_replica:
    image: postgres:15-alpine
    environment:
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_MASTER_HOST: postgres_primary
      POSTGRES_MASTER_PORT: 5432
      POSTGRES_REPLICATION_USER: replication
      POSTGRES_REPLICATION_PASSWORD: ${REPLICATION_PASSWORD}
    volumes:
      - postgres_replica_data:/var/lib/postgresql/data
    depends_on:
      - postgres_primary
```

### Redis Sentinel

```yaml
services:
  redis_master:
    image: redis:7-alpine
    command: redis-server --appendonly yes

  redis_slave:
    image: redis:7-alpine
    command: redis-server --slaveof redis_master 6379

  redis_sentinel:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
    volumes:
      - ./redis/sentinel.conf:/etc/redis/sentinel.conf
```

### 로드 밸런서

```yaml
services:
  backend_1:
    build: ./backend
    # ...

  backend_2:
    build: ./backend
    # ...

  nginx:
    # upstream 설정
    # upstream backend {
    #   server backend_1:8000;
    #   server backend_2:8000;
    # }
```

---

## 모니터링 스택 (선택)

### Prometheus + Grafana

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
```

---

## 배포 체크리스트

### 배포 전

- [ ] 환경 변수 설정 완료
- [ ] SSL 인증서 준비
- [ ] 방화벽 규칙 설정 (80, 443 포트)
- [ ] DNS 설정
- [ ] 백업 전략 수립

### 배포 후

- [ ] 서비스 정상 작동 확인
- [ ] SSL 인증서 확인 (https://www.ssllabs.com/ssltest/)
- [ ] API 엔드포인트 테스트
- [ ] 로그인/로그아웃 테스트
- [ ] 파일 업로드/다운로드 테스트
- [ ] 이메일 발송 테스트
- [ ] 모니터링 알림 설정

---

## 업데이트 절차

### 1. 백업

```bash
# 데이터베이스 백업
docker-compose exec postgres pg_dump -U isms_user isms_db > backup_$(date +%Y%m%d).sql

# MinIO 데이터 백업
docker cp isms_minio:/data ./minio_backup
```

### 2. 코드 업데이트

```bash
# 최신 코드 가져오기
git pull origin main

# 마이그레이션 확인
docker-compose exec backend alembic current
docker-compose exec backend alembic history
```

### 3. 재배포

```bash
# 이미지 재빌드 및 재시작
docker-compose -f docker-compose.prod.yml up -d --build

# 마이그레이션 적용
docker-compose exec backend alembic upgrade head

# 상태 확인
docker-compose ps
docker-compose logs -f backend
```

### 4. 롤백 (필요시)

```bash
# 이전 버전으로 롤백
git checkout <previous-tag>
docker-compose -f docker-compose.prod.yml up -d --build

# 마이그레이션 롤백
docker-compose exec backend alembic downgrade -1
```
