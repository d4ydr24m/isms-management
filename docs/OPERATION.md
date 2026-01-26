# 운영 매뉴얼

## 개요

ISMS 관리 시스템의 일상 운영, 모니터링, 백업/복구, 트러블슈팅에 대한 가이드입니다.

---

## 시스템 상태 확인

### Docker 서비스 상태

```bash
# 전체 서비스 상태 확인
docker-compose ps

# 특정 서비스 상태 확인
docker-compose ps backend

# 서비스 리소스 사용량 확인
docker stats

# 컨테이너 상세 정보
docker inspect isms_backend
```

### 헬스 체크

```bash
# Backend 헬스 체크
curl -s http://localhost:8000/health
# 예상 응답: {"status":"healthy"}

# PostgreSQL 상태
docker-compose exec postgres pg_isready -U isms_user -d isms_db

# Redis 상태
docker-compose exec redis redis-cli ping

# MinIO 상태
curl -s http://localhost:9000/minio/health/live
```

### 로그 확인

```bash
# 전체 로그
docker-compose logs

# 특정 서비스 로그
docker-compose logs backend
docker-compose logs -f backend  # 실시간 로그

# 최근 100줄
docker-compose logs --tail=100 backend

# 특정 시간 이후 로그
docker-compose logs --since="2024-01-20T10:00:00" backend

# 로그 파일 직접 확인
docker-compose exec backend cat /app/logs/app.log
```

---

## 일상 운영 작업

### 서비스 재시작

```bash
# 전체 재시작
docker-compose restart

# 특정 서비스 재시작
docker-compose restart backend

# 서비스 중지 후 시작
docker-compose stop backend
docker-compose start backend

# 컨테이너 재생성 (설정 변경 시)
docker-compose up -d --force-recreate backend
```

### 스케일링

```bash
# Backend 인스턴스 증가
docker-compose up -d --scale backend=3

# 인스턴스 수 확인
docker-compose ps backend
```

### 사용자 관리

```bash
# 관리자 비밀번호 재설정 (Django-style)
docker-compose exec backend python -c "
from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

db = SessionLocal()
user = db.query(User).filter(User.email == 'admin@example.com').first()
user.hashed_password = get_password_hash('NewPassword123!')
db.commit()
print('Password updated')
"

# 계정 잠금 해제
docker-compose exec backend python -c "
from app.db.session import SessionLocal
from app.models.user import User

db = SessionLocal()
user = db.query(User).filter(User.email == 'user@example.com').first()
user.failed_login_attempts = 0
user.locked_until = None
db.commit()
print('Account unlocked')
"
```

---

## 백업 및 복구

### 자동 백업 스크립트

**backup.sh:**

```bash
#!/bin/bash

# 설정
BACKUP_DIR="/backup/isms"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# 디렉토리 생성
mkdir -p $BACKUP_DIR/{db,minio,config}

# PostgreSQL 백업
echo "Backing up PostgreSQL..."
docker-compose exec -T postgres pg_dump -U isms_user isms_db | gzip > $BACKUP_DIR/db/isms_db_$DATE.sql.gz

# MinIO 백업
echo "Backing up MinIO..."
docker cp isms_minio:/data $BACKUP_DIR/minio/minio_$DATE

# 설정 파일 백업
echo "Backing up config files..."
cp -r ./backend/.env $BACKUP_DIR/config/backend_env_$DATE
cp -r ./frontend/.env $BACKUP_DIR/config/frontend_env_$DATE
cp -r ./nginx $BACKUP_DIR/config/nginx_$DATE

# 오래된 백업 삭제
echo "Cleaning old backups..."
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -type d -empty -delete

# 백업 목록 출력
echo "Backup completed. Recent backups:"
ls -lht $BACKUP_DIR/db | head -5

# 백업 검증
echo "Verifying backup..."
gunzip -t $BACKUP_DIR/db/isms_db_$DATE.sql.gz && echo "Backup verification: OK"
```

**cron 설정 (매일 새벽 3시):**

```bash
# crontab -e
0 3 * * * /opt/isms/backup.sh >> /var/log/isms_backup.log 2>&1
```

### 수동 백업

```bash
# 데이터베이스 전체 백업
docker-compose exec postgres pg_dump -U isms_user -d isms_db > backup_$(date +%Y%m%d).sql

# 압축 백업
docker-compose exec postgres pg_dump -U isms_user -d isms_db | gzip > backup_$(date +%Y%m%d).sql.gz

# 특정 테이블만 백업
docker-compose exec postgres pg_dump -U isms_user -d isms_db -t evidences -t evidence_versions > evidences_backup.sql

# 스키마만 백업
docker-compose exec postgres pg_dump -U isms_user -d isms_db --schema-only > schema_backup.sql
```

### 복구 절차

#### 데이터베이스 복구

```bash
# 1. 서비스 중지
docker-compose stop backend celery_worker celery_beat

# 2. 기존 데이터베이스 삭제 및 재생성
docker-compose exec postgres dropdb -U isms_user isms_db
docker-compose exec postgres createdb -U isms_user isms_db

# 3. 백업 복구
gunzip -c backup_20240120.sql.gz | docker-compose exec -T postgres psql -U isms_user -d isms_db

# 4. 서비스 재시작
docker-compose start backend celery_worker celery_beat

# 5. 복구 확인
docker-compose exec postgres psql -U isms_user -d isms_db -c "SELECT COUNT(*) FROM evidences;"
```

#### MinIO 데이터 복구

```bash
# 1. MinIO 서비스 중지
docker-compose stop minio

# 2. 데이터 복구
docker cp ./minio_backup/data isms_minio:/

# 3. 서비스 재시작
docker-compose start minio
```

### 재해 복구 체크리스트

- [ ] 백업 파일 확인
- [ ] 인프라 준비 (서버, 네트워크)
- [ ] Docker 환경 설정
- [ ] 환경 변수 복원
- [ ] 데이터베이스 복구
- [ ] MinIO 데이터 복구
- [ ] 서비스 시작 및 확인
- [ ] DNS 설정 (필요시)
- [ ] SSL 인증서 확인
- [ ] 기능 테스트

---

## 모니터링

### 시스템 모니터링

```bash
# 디스크 사용량
df -h

# 메모리 사용량
free -h

# CPU 사용량
top -bn1 | head -20

# Docker 볼륨 사용량
docker system df -v
```

### 애플리케이션 모니터링

#### Prometheus 메트릭 설정 (선택)

```python
# backend/app/utils/metrics.py
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)
```

#### 모니터링 대시보드 항목

| 메트릭 | 설명 | 임계값 |
|--------|------|--------|
| CPU 사용률 | 서버 CPU | > 80% 경고 |
| 메모리 사용률 | 서버 메모리 | > 85% 경고 |
| 디스크 사용률 | 스토리지 | > 80% 경고 |
| API 응답 시간 | 평균 응답 시간 | > 1초 경고 |
| 에러율 | 5xx 에러 비율 | > 1% 경고 |
| 활성 연결 수 | DB 연결 | > 80 경고 |

### 알림 설정

**Slack 웹훅 알림 예시:**

```bash
#!/bin/bash
# alert.sh

WEBHOOK_URL="https://hooks.slack.com/services/xxx/yyy/zzz"

send_alert() {
    local message="$1"
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚨 ISMS Alert: $message\"}" \
        $WEBHOOK_URL
}

# 디스크 사용량 체크
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    send_alert "Disk usage is ${DISK_USAGE}%"
fi

# Backend 헬스 체크
if ! curl -s http://localhost:8000/health | grep -q "healthy"; then
    send_alert "Backend health check failed"
fi
```

---

## 로그 관리

### 로그 위치

| 서비스 | 로그 위치 |
|--------|----------|
| Backend | `/app/logs/app.log` |
| Nginx | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |
| PostgreSQL | Docker 로그 |
| Redis | Docker 로그 |

### 로그 로테이션

**logrotate 설정 (/etc/logrotate.d/isms):**

```
/var/log/isms/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker-compose exec backend kill -USR1 1
    endscript
}
```

### 로그 분석

```bash
# 에러 로그 필터링
docker-compose logs backend | grep -i error

# 특정 사용자 활동 추적
docker-compose logs backend | grep "user@example.com"

# API 응답 시간 분석
docker-compose logs nginx | awk '{print $10}' | sort -n | tail -20

# 시간대별 요청 수
docker-compose logs nginx | awk '{print $4}' | cut -d: -f2 | sort | uniq -c
```

---

## 트러블슈팅

### 일반적인 문제

#### 1. 서비스가 시작되지 않음

```bash
# 로그 확인
docker-compose logs --tail=50 backend

# 컨테이너 상태 확인
docker inspect isms_backend | grep -A 10 "State"

# 포트 충돌 확인
netstat -tlnp | grep :8000

# 리소스 확인
docker system df
```

#### 2. 데이터베이스 연결 실패

```bash
# PostgreSQL 상태 확인
docker-compose ps postgres

# 연결 테스트
docker-compose exec postgres psql -U isms_user -d isms_db -c "SELECT 1"

# 연결 수 확인
docker-compose exec postgres psql -U isms_user -d isms_db -c "SELECT count(*) FROM pg_stat_activity"

# 연결 대기 프로세스 확인
docker-compose exec postgres psql -U isms_user -d isms_db -c "SELECT * FROM pg_stat_activity WHERE state = 'idle'"
```

#### 3. Redis 연결 실패

```bash
# Redis 상태 확인
docker-compose exec redis redis-cli ping

# 메모리 사용량
docker-compose exec redis redis-cli info memory

# 연결 수
docker-compose exec redis redis-cli info clients
```

#### 4. MinIO 파일 업로드 실패

```bash
# MinIO 상태 확인
docker-compose logs minio

# 버킷 확인
docker-compose exec minio mc ls local

# 디스크 공간 확인
docker-compose exec minio df -h /data
```

#### 5. Celery 태스크 실행 안됨

```bash
# Worker 상태 확인
docker-compose logs celery_worker

# Beat 상태 확인
docker-compose logs celery_beat

# 대기 중인 태스크 확인
docker-compose exec redis redis-cli llen celery

# Worker 재시작
docker-compose restart celery_worker celery_beat
```

### 성능 문제

#### 느린 쿼리 분석

```sql
-- PostgreSQL 느린 쿼리 로깅 활성화
ALTER SYSTEM SET log_min_duration_statement = '1000';  -- 1초 이상
SELECT pg_reload_conf();

-- 느린 쿼리 확인
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';
```

#### 인덱스 사용 확인

```sql
-- 인덱스 사용 통계
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 사용되지 않는 인덱스
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

#### 메모리 누수 확인

```bash
# Python 메모리 프로파일링
docker-compose exec backend pip install memory_profiler
docker-compose exec backend python -m memory_profiler app/main.py
```

---

## 보안 운영

### 정기 보안 점검

#### 주간 점검

- [ ] 로그인 실패 기록 검토
- [ ] 비정상 접근 패턴 확인
- [ ] 백업 상태 확인
- [ ] 디스크 사용량 확인

#### 월간 점검

- [ ] 사용자 계정 검토 (비활성 계정)
- [ ] 권한 설정 검토
- [ ] 보안 패치 적용
- [ ] SSL 인증서 만료일 확인
- [ ] 감사 로그 검토

#### 분기별 점검

- [ ] 비밀번호 정책 준수 확인
- [ ] 접근 권한 전체 검토
- [ ] 취약점 스캔
- [ ] 재해 복구 테스트

### 보안 이벤트 대응

```bash
# 특정 IP 차단 (Nginx)
# nginx.conf에 추가
# deny 192.168.1.100;

# 의심스러운 활동 확인
docker-compose logs backend | grep "401\|403"

# 감사 로그 확인
docker-compose exec postgres psql -U isms_user -d isms_db -c "
SELECT user_id, action, ip_address, created_at
FROM audit_logs
WHERE action = 'login_failed'
ORDER BY created_at DESC
LIMIT 50;
"
```

---

## 유지보수 창

### 계획된 유지보수 절차

1. **사전 공지** (최소 24시간 전)
2. **백업 수행**
3. **서비스 중지**
4. **유지보수 작업 수행**
5. **서비스 재시작**
6. **기능 테스트**
7. **모니터링 강화** (1시간)

### 유지보수 모드 활성화

```bash
# Nginx에서 유지보수 페이지 표시
# nginx.conf에 추가
# if (-f /etc/nginx/maintenance.flag) {
#     return 503;
# }
# error_page 503 /maintenance.html;

# 유지보수 모드 활성화
touch /etc/nginx/maintenance.flag
docker-compose exec nginx nginx -s reload

# 유지보수 모드 해제
rm /etc/nginx/maintenance.flag
docker-compose exec nginx nginx -s reload
```
