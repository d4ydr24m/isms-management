# 개발 환경 설정 가이드

## 개요

ISMS 관리 시스템 개발 환경 설정을 위한 가이드입니다.

## 사전 요구사항

### 필수 소프트웨어

| 소프트웨어 | 최소 버전 | 권장 버전 | 비고 |
|-----------|----------|----------|------|
| Python | 3.11 | 3.11+ | Backend |
| Node.js | 18 | 20 LTS | Frontend |
| Docker | 20.10 | 최신 | 컨테이너 |
| Docker Compose | 2.0 | 최신 | 오케스트레이션 |
| Git | 2.30 | 최신 | 버전 관리 |

### IDE/Editor 권장

- **VSCode** (권장)
  - Python Extension
  - ESLint
  - Prettier
  - Docker Extension
- PyCharm (Python 개발)
- WebStorm (Frontend 개발)

## 빠른 시작

### 1. 저장소 클론

```bash
git clone https://github.com/your-org/isms-management.git
cd isms-management
```

### 2. Docker Compose로 전체 스택 실행 (권장)

```bash
# 전체 서비스 시작
docker-compose up -d

# 서비스 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f
```

### 3. 접속 확인

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API 문서 (Swagger): http://localhost:8000/docs
- API 문서 (ReDoc): http://localhost:8000/redoc
- MinIO Console: http://localhost:9001

## 로컬 개발 환경 설정 (상세)

### Backend 설정

#### 1. Python 가상환경 설정

```bash
cd backend

# 가상환경 생성
python -m venv venv

# 가상환경 활성화
# Windows
venv\Scripts\activate

# Linux/macOS
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt
pip install -r requirements-dev.txt  # 개발 의존성
```

#### 2. 환경 변수 설정

```bash
# .env.example을 복사하여 .env 생성
cp .env.example .env
```

`.env` 파일 편집:

```env
# Application
SECRET_KEY=your-super-secret-key-min-32-characters
ENVIRONMENT=development
DEBUG=true

# Database
DATABASE_URL=postgresql://isms_user:isms_password@localhost:5432/isms_db

# Redis
REDIS_URL=redis://localhost:6379/0

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=isms-evidences

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# SMTP (선택)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
```

#### 3. 데이터베이스 마이그레이션

```bash
# 마이그레이션 적용
alembic upgrade head

# 초기 데이터 시드 (선택)
python -m app.db.init_db
```

#### 4. 개발 서버 실행

```bash
# FastAPI 개발 서버
uvicorn app.main:app --reload --port 8000

# Celery Worker (별도 터미널)
celery -A app.core.celery_app worker --loglevel=info

# Celery Beat Scheduler (별도 터미널)
celery -A app.core.celery_app beat --loglevel=info
```

### Frontend 설정

#### 1. 의존성 설치

```bash
cd frontend

# npm 사용
npm install

# 또는 pnpm 사용 (권장)
pnpm install
```

#### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

#### 3. 개발 서버 실행

```bash
npm run dev
# 또는
pnpm dev
```

## 코드 품질 도구

### Backend

```bash
cd backend

# 코드 포맷팅
black .
isort .

# 린팅
flake8 .
mypy app/

# 테스트
pytest
pytest --cov=app tests/  # 커버리지 포함
pytest -x  # 첫 실패 시 중단
pytest -v  # 상세 출력
```

### Frontend

```bash
cd frontend

# 린팅
npm run lint
npm run lint:fix  # 자동 수정

# 포맷팅
npm run format

# 타입 체크
npm run type-check

# 테스트
npm test
npm run test:coverage  # 커버리지 포함
```

## Git 워크플로우

### 브랜치 전략

```
main                 # 프로덕션 브랜치
├── develop         # 개발 브랜치
│   ├── feature/xxx # 기능 개발
│   ├── fix/xxx     # 버그 수정
│   └── refactor/xxx # 리팩토링
└── release/x.x.x   # 릴리스 브랜치
```

### 커밋 컨벤션

```
<type>: <description>

<optional body>
```

**타입:**
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `refactor`: 리팩토링
- `docs`: 문서 수정
- `test`: 테스트 추가/수정
- `chore`: 빌드/설정 변경
- `perf`: 성능 개선
- `ci`: CI/CD 변경

**예시:**
```bash
git commit -m "feat: 증적 버전 히스토리 기능 추가"
git commit -m "fix: 로그인 토큰 만료 처리 오류 수정"
```

## 디버깅

### Backend 디버깅

**VSCode launch.json:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI Debug",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload", "--port", "8000"],
      "cwd": "${workspaceFolder}/backend",
      "env": {
        "PYTHONPATH": "${workspaceFolder}/backend"
      }
    }
  ]
}
```

### Frontend 디버깅

React DevTools 및 브라우저 개발자 도구 사용

## 문제 해결

### 일반적인 문제

#### 1. 포트 충돌

```bash
# 사용 중인 포트 확인
# Windows
netstat -ano | findstr :8000

# Linux/macOS
lsof -i :8000

# 프로세스 종료
# Windows
taskkill /PID <pid> /F

# Linux/macOS
kill -9 <pid>
```

#### 2. Docker 볼륨 문제

```bash
# 볼륨 초기화
docker-compose down -v
docker-compose up -d
```

#### 3. 데이터베이스 연결 실패

```bash
# PostgreSQL 상태 확인
docker-compose ps postgres
docker-compose logs postgres

# 연결 테스트
psql -h localhost -U isms_user -d isms_db
```

#### 4. MinIO 연결 실패

```bash
# MinIO 상태 확인
docker-compose ps minio
docker-compose logs minio

# 버킷 생성 확인
mc alias set myminio http://localhost:9000 minioadmin minioadmin123
mc ls myminio
```

## 참고 자료

- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
- [React 공식 문서](https://react.dev/)
- [Ant Design 컴포넌트](https://ant.design/components/overview)
- [SQLAlchemy 2.0 문서](https://docs.sqlalchemy.org/)
- [Zustand 상태 관리](https://zustand-demo.pmnd.rs/)
