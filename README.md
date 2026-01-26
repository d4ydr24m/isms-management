# ISMS Management System

ISMS-P (정보보호 및 개인정보보호 관리체계) 인증 준비 및 유지를 위한 통합 관리 시스템

## 프로젝트 개요

### Phase 1 MVP 주요 기능
- **증적 관리**: 80개 통제항목별 증적 등록, 버전 관리, 유효기간 관리
- **감사 지원**: 내부감사 계획, 체크리스트, 부적합 사항 관리, 심사원 계정
- **사용자 관리**: RBAC 기반 권한 관리, 부서 계층 구조, 2FA 인증
- **대시보드**: 인증 준비 진척률, 예정 활동, 만료 예정 증적, 부적합 현황

## 기술 스택

### Backend
- **Framework**: FastAPI 0.109+
- **Database**: PostgreSQL 15
- **Cache/Queue**: Redis 7
- **Task Queue**: Celery + Celery Beat
- **Storage**: MinIO
- **ORM**: SQLAlchemy 2.0
- **Migration**: Alembic

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **UI Library**: Ant Design 5
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Router**: React Router v6

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx (리버스 프록시)
- **CI/CD**: GitHub Actions

## 프로젝트 구조

```
isms-management/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # API 라우터
│   │   ├── core/            # 설정, 보안, Celery
│   │   ├── db/              # 데이터베이스 설정
│   │   ├── models/          # SQLAlchemy 모델
│   │   ├── schemas/         # Pydantic 스키마
│   │   ├── services/        # 비즈니스 로직
│   │   └── utils/           # 유틸리티
│   ├── tests/               # 테스트
│   ├── alembic/             # 마이그레이션
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           # 페이지 컴포넌트
│   │   ├── components/      # 재사용 컴포넌트
│   │   ├── services/        # API 서비스
│   │   ├── stores/          # Zustand 스토어
│   │   ├── types/           # TypeScript 타입
│   │   └── utils/           # 유틸리티
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 시작하기

### 사전 요구사항
- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (로컬 개발 시)
- Python 3.11+ (로컬 개발 시)

### 환경 설정

1. **환경 변수 파일 생성**
```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

2. **환경 변수 수정** (`backend/.env`)
```env
SECRET_KEY=your-secret-key-min-32-chars
DATABASE_URL=postgresql://isms_user:isms_password@postgres:5432/isms_db
# ... 기타 설정
```

### Docker Compose로 실행

전체 스택 실행:
```bash
docker-compose up -d
```

특정 서비스만 실행:
```bash
docker-compose up -d postgres redis minio
docker-compose up -d backend
docker-compose up -d frontend
```

서비스 상태 확인:
```bash
docker-compose ps
```

로그 확인:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 로컬 개발 환경

#### Backend
```bash
cd backend

# 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 데이터베이스 마이그레이션
alembic upgrade head

# 개발 서버 실행
uvicorn app.main:app --reload
```

#### Frontend
```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

## 접속 정보

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API 문서 (Swagger)**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001
  - Username: `minioadmin`
  - Password: `minioadmin123`

## 데이터베이스 마이그레이션

새 마이그레이션 생성:
```bash
cd backend
alembic revision --autogenerate -m "description"
```

마이그레이션 적용:
```bash
alembic upgrade head
```

롤백:
```bash
alembic downgrade -1
```

## 테스트

Backend 테스트:
```bash
cd backend
pytest
pytest --cov=app tests/  # 커버리지 포함
```

Frontend 테스트:
```bash
cd frontend
npm test
```

## 코드 품질

Backend:
```bash
cd backend
black .                    # 코드 포맷팅
flake8 .                   # 린팅
mypy app/                  # 타입 체킹
```

Frontend:
```bash
cd frontend
npm run lint               # ESLint
npm run format             # Prettier
```

## 주요 기능 상세

### 1. 증적 관리 (Evidence Management)
- 80개 ISMS-P 통제항목별 증적 등록
- 파일 업로드 (MinIO) 및 버전 관리
- 유효기간 관리 및 만료 알림 (30일/7일/1일 전)
- 통제항목 다대다 매핑
- 정기 활동 자동 생성 및 알림

### 2. 감사 지원 (Audit Support)
- 내부감사 계획 수립
- 체크리스트 자동 생성
- 부적합 사항 및 시정조치 관리
- 심사원 임시 계정 (읽기 전용, 기한 제한)
- 감사 추적 로그 (해시 체인 위변조 방지)

### 3. 사용자 관리 (User Management)
- 역할 기반 접근 제어 (RBAC)
- 부서 계층 구조
- 2FA (TOTP) 인증
- 비밀번호 정책 (복잡도, 90일 만료)
- 계정 잠금 (5회 실패 시)

### 4. 대시보드 (Dashboard)
- 인증 준비 진척률 (증적 확보율)
- 예정 보안 활동
- 만료 예정 증적
- 미완료 업무
- 부적합 현황

## 보안 고려사항

- JWT 기반 인증 (Access Token + Refresh Token)
- 2FA (TOTP) 지원
- 비밀번호 해싱 (bcrypt)
- SQL Injection 방지 (SQLAlchemy ORM)
- CORS 설정
- IP 화이트리스트
- 파일 업로드 검증
- 감사 로그 (해시 체인)

## 문서

상세 문서는 [docs/](./docs/) 디렉토리에서 확인하세요.

| 문서 | 설명 |
|------|------|
| [DEVELOPMENT.md](./docs/DEVELOPMENT.md) | 개발 환경 설정 가이드 |
| [API.md](./docs/API.md) | API 사용 가이드 |
| [DATABASE.md](./docs/DATABASE.md) | 데이터베이스 스키마 문서 |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | 배포 가이드 |
| [CONFIGURATION.md](./docs/CONFIGURATION.md) | 환경 설정 가이드 |
| [OPERATION.md](./docs/OPERATION.md) | 운영 매뉴얼 |
| [USER_MANUAL.md](./docs/USER_MANUAL.md) | 사용자 매뉴얼 |

## 테스트 현황

### Backend (pytest)
- **테스트**: 476개
- **커버리지**: 80%

### Frontend (vitest)
- **테스트 파일**: 64개
- **테스트**: 636개
- **커버리지**: 70.66%

```bash
# Backend 테스트 실행
cd backend && pytest --cov=app tests/

# Frontend 테스트 실행
cd frontend && npm test -- --coverage
```

## 라이선스

Proprietary - 모든 권리 보유

## 지원

이슈 및 기능 요청: GitHub Issues
