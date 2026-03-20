# ISMS-P 통합 관리 시스템 - Tasks

> 커밋 이력 및 코드 분석 기반으로 재구성한 작업 목록입니다.
> 상태: ✅ 완료 | 🔄 진행중 | ⬚ 미착수

---

## Phase 1: Foundation (MVP)

### 1.0 프로젝트 초기화 및 인프라 설정
> Commit: `41835fc`, `e3eed54`

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 1.1 | 프로젝트 디렉토리 구조 생성 (backend/frontend/nginx/docs) | ✅ | |
| 1.2 | Backend 초기 설정 (FastAPI, uvicorn, 프로젝트 구조) | ✅ | |
| 1.3 | Frontend 초기 설정 (React, Vite, TypeScript) | ✅ | |
| 1.4 | Docker Compose 구성 (PostgreSQL, Redis, MinIO, Backend, Frontend) | ✅ | |
| 1.5 | Nginx 리버스 프록시 설정 (라우팅, Rate Limiting, 보안 헤더) | ✅ | |
| 1.6 | GitHub Actions CI/CD 파이프라인 구성 | ✅ | lint, type-check, test, build, security scan |
| 1.7 | 환경 설정 파일 (.env.example, .env.test) | ✅ | |
| 1.8 | Dockerfile 작성 (backend, frontend, production 별도) | ✅ | |

### 2.0 데이터베이스 스키마 설계 및 구현
> Commit: `774a030`

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 2.1 | SQLAlchemy Base, Session 설정 | ✅ | async 지원 |
| 2.2 | User 모델 (이메일, 해시 비밀번호, MFA, 로그인 추적) | ✅ | |
| 2.3 | Role 모델 (역할명, 권한 문자열) | ✅ | |
| 2.4 | UserRole 모델 (M:N 관계) | ✅ | |
| 2.5 | Department 모델 (계층형 self-referential) | ✅ | |
| 2.6 | ControlDomain / ControlCategory / ControlItem 모델 | ✅ | |
| 2.7 | Evidence / EvidenceVersion 모델 | ✅ | |
| 2.8 | ControlItemEvidence 모델 (M:N 매핑) | ✅ | |
| 2.9 | AuditPlan / AuditChecklist / AuditChecklistResult 모델 | ✅ | |
| 2.10 | NonConformity / CorrectiveAction 모델 | ✅ | |
| 2.11 | AuditorAccount 모델 (임시 감사원 계정) | ✅ | |
| 2.12 | Notification / NotificationSetting 모델 | ✅ | |
| 2.13 | AuditLog 모델 (해시 체이닝) | ✅ | |
| 2.14 | ScheduledTask / TaskExecution 모델 | ✅ | |
| 2.15 | EvidenceTemplate 모델 | ✅ | |
| 2.16 | Alembic 초기 마이그레이션 생성 | ✅ | `20260122_0603-initial_schema.py` |
| 2.17 | 시드 데이터 (ISMS-P 80개 통제항목) | ✅ | `isms_controls.json` |
| 2.18 | DB 초기화 스크립트 (init_db.py) | ✅ | |

### 3.0 사용자 인증 및 RBAC 구현
> Commit: `75c7c96`

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 3.1 | JWT Access/Refresh 토큰 발급/검증 | ✅ | 30분/7일 |
| 3.2 | bcrypt 비밀번호 해싱 | ✅ | |
| 3.3 | 로그인 API (이메일/비밀번호 + OTP) | ✅ | |
| 3.4 | 로그아웃 API | ✅ | |
| 3.5 | 토큰 갱신 API | ✅ | |
| 3.6 | MFA 설정 API (TOTP, QR코드 생성) | ✅ | pyotp, qrcode |
| 3.7 | MFA 검증 API | ✅ | |
| 3.8 | 비밀번호 변경 API | ✅ | |
| 3.9 | 비밀번호 정책 검증 (8자, 대소문자/숫자/특수문자) | ✅ | |
| 3.10 | 계정 잠금 (5회 실패, 30분) | ✅ | |
| 3.11 | 비밀번호 만료 추적 (90일) | ✅ | |
| 3.12 | RBAC 의존성 주입 (권한 기반 엔드포인트 보호) | ✅ | |
| 3.13 | 사용자 CRUD API | ✅ | 소프트 삭제 |
| 3.14 | 역할 관리 API | ✅ | |
| 3.15 | 부서 관리 API | ✅ | |
| 3.16 | 감사원 임시 계정 API | ✅ | |
| 3.17 | IP 화이트리스트 미들웨어 | ✅ | |
| 3.18 | 감사 로그 미들웨어 (전체 요청 로깅) | ✅ | |
| 3.19 | 세션 타임아웃 미들웨어 (Redis) | ✅ | |
| 3.20 | AuthService 비즈니스 로직 | ✅ | |
| 3.21 | SessionService (Redis 세션 관리) | ✅ | |

### 4.0 증적 관리 모듈 구현
> Commit: `93b9166`

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 4.1 | 증적 등록 API (파일 업로드 + 메타데이터) | ✅ | MinIO |
| 4.2 | 증적 조회/수정/삭제 API | ✅ | |
| 4.3 | 증적 파일 다운로드 API | ✅ | |
| 4.4 | 버전 관리 API (이력 조회, 롤백) | ✅ | |
| 4.5 | 통제항목 매핑 API | ✅ | M:N |
| 4.6 | 만료 임박 증적 조회 API | ✅ | |
| 4.7 | SHA-256 파일 무결성 검증 | ✅ | |
| 4.8 | FileService (MinIO 파일 작업) | ✅ | |
| 4.9 | EvidenceService 비즈니스 로직 | ✅ | |
| 4.10 | 증적 템플릿 API (조회/등록/다운로드) | ✅ | |
| 4.11 | 정기 활동 API (스케줄링, 실행 추적) | ✅ | |
| 4.12 | 감사 관리 API (감사계획, 체크리스트, 결과) | ✅ | |
| 4.13 | 부적합 관리 API (등록, 시정조치, 종결) | ✅ | |
| 4.14 | 감사 로그 API (조회, Excel 내보내기) | ✅ | |
| 4.15 | 알림 API (조회, 읽음, 설정) | ✅ | |
| 4.16 | 데이터 마이그레이션 API | ✅ | |

### 5.0 통제항목 및 대시보드 API
> Commit: `a1466ad`

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 5.1 | 통제항목 도메인/카테고리/항목 조회 API | ✅ | |
| 5.2 | 이행 현황 통계 API (영역별 커버리지) | ✅ | |
| 5.3 | 대시보드 요약 API (전체 인증 준비 현황) | ✅ | |
| 5.4 | 대시보드 진행률 API | ✅ | |
| 5.5 | 대시보드 활동 API (기간별) | ✅ | |
| 5.6 | 만료 임박 증적 API | ✅ | |
| 5.7 | 대기 업무 API | ✅ | |
| 5.8 | 부적합 요약 API | ✅ | |
| 5.9 | DashboardService 비즈니스 로직 | ✅ | |

### 6.0 WebSocket 실시간 알림
> Commit: `a1466ad` (Backend), `26a4afa` (Frontend)

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 6.1 | WebSocket 엔드포인트 (/ws/notifications) | ✅ | |
| 6.2 | ConnectionManager (사용자별 연결 관리) | ✅ | |
| 6.3 | Redis Pub/Sub 연동 | ✅ | |
| 6.4 | NotificationService (생성/전달/설정) | ✅ | |
| 6.5 | EmailService (SMTP 이메일 발송) | ✅ | aiosmtplib |

### 7.0 Backend 테스트
> Commit: `40f4d05`

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 7.1 | pytest 환경 설정 (conftest.py, 픽스처) | ✅ | |
| 7.2 | Auth API 테스트 (로그인, 토큰, MFA, 비밀번호) | ✅ | |
| 7.3 | Users API 테스트 | ✅ | |
| 7.4 | Controls API 테스트 | ✅ | |
| 7.5 | Evidences API 테스트 | ✅ | |
| 7.6 | Audits API 테스트 | ✅ | |
| 7.7 | 서비스 레이어 테스트 | ✅ | |
| 7.8 | 모델/스키마 테스트 | ✅ | |
| 7.9 | RBAC/권한 테스트 | ✅ | |
| 7.10 | 시드 데이터 로딩 테스트 | ✅ | |
| 7.11 | 커버리지 80% 달성 | ✅ | 476 tests |

### 8.0 Frontend 구현
> Commits: `be56666` ~ `b222b10`

| # | Task | 상태 | 커밋 |
|---|------|------|------|
| 8.1 | TypeScript 타입 정의 (auth, user, control, evidence, audit, asset, risk, notification, dashboard, search, settings) | ✅ | `fc00d73` |
| 8.2 | API 서비스 레이어 (Axios 인스턴스, 인터셉터, 14개 서비스 모듈) | ✅ | `f48dc8e` |
| 8.3 | 상태 관리 (Zustand: authStore, notificationStore, themeStore) | ✅ | `6242b3e` |
| 8.4 | 레이아웃 (MainLayout, AuthLayout, Header, Sidebar) | ✅ | `8cffd35` |
| 8.5 | 공통 UI 컴포넌트 (DataTable, LoadingSpinner, SearchInput, StatusBadge, FileUpload, ConfirmModal, ErrorBoundary, ThemeToggle) | ✅ | `cbc9c2e` |
| 8.6 | 라우팅 설정 (AppRouter, PrivateRoute, RoleRoute) | ✅ | `2bcc7a9` |
| 8.7 | 인증 페이지 (LoginPage, MFAVerifyPage, PasswordChangePage) | ✅ | `3c78349` |
| 8.8 | 대시보드 페이지 (ProgressGauge, ActivityList, ExpiringEvidences, PendingTasks, NonConformityStatus) | ✅ | `cabac5a` |
| 8.9 | 증적 관리 페이지 (EvidenceCreate, EvidenceDetail, EvidenceTable, ControlMapping) | ✅ | `2b099f1` |
| 8.10 | 통제항목 페이지 (ControlTree, ControlDetail, 진행률 표시) | ✅ | `b24aa9b` |
| 8.11 | 감사 관리 페이지 (AuditCreate, AuditDetail, Checklist, NonConformities, NonConformityDetail) | ✅ | `3769088` |
| 8.12 | 사용자 관리 페이지 (UserCreate, UserDetail, AuditorAccounts) | ✅ | `1d3ee06` |
| 8.13 | 설정 페이지 (프로필, 알림 설정) | ✅ | `c246c30` |
| 8.14 | 알림 컴포넌트 (NotificationBell, NotificationDropdown, NotificationItem, NotificationList) | ✅ | `26a4afa` |
| 8.15 | useWebSocket 훅 (자동 재연결, 지수 백오프) | ✅ | `26a4afa` |
| 8.16 | 다크 모드 (ThemeToggle, themeStore, 시스템 감지) | ✅ | `be56666` |
| 8.17 | 통합 검색 (GlobalSearch, SearchResults) | ✅ | `b222b10` |

### 9.0 Frontend 테스트
> Commits: `33a5187`, `c8eae24`

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 9.1 | Vitest + React Testing Library 설정 | ✅ | |
| 9.2 | MSW (Mock Service Worker) API 모킹 설정 | ✅ | |
| 9.3 | 컴포넌트 테스트 (common, notification, layout) | ✅ | |
| 9.4 | 페이지 테스트 (dashboard, evidence, controls, audits, users) | ✅ | |
| 9.5 | 훅 테스트 (useWebSocket) | ✅ | |
| 9.6 | 스토어 테스트 (auth, notification, theme) | ✅ | |
| 9.7 | 커버리지 70% 달성 | ✅ | 636 tests |

### 10.0 문서화 및 배포 준비
> Commit: `de38958`

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 10.1 | README.md (프로젝트 개요, 빠른 시작) | ✅ | |
| 10.2 | API 문서 (API.md) | ✅ | |
| 10.3 | 데이터베이스 문서 (DATABASE.md) | ✅ | |
| 10.4 | 개발 가이드 (DEVELOPMENT.md) | ✅ | |
| 10.5 | 배포 가이드 (DEPLOYMENT.md) | ✅ | |
| 10.6 | 설정 가이드 (CONFIGURATION.md) | ✅ | |
| 10.7 | 운영 가이드 (OPERATION.md) | ✅ | |
| 10.8 | 사용자 매뉴얼 (USER_MANUAL.md) | ✅ | |

---

## Phase 2: 자산 및 위험 관리

### 11.0 자산 관리 모델 및 API
> Commits: `c686d65`, `28d80a1`, `8d8aa21`, `0256054`

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 11.1 | AssetType / AssetCategory 모델 | ✅ | |
| 11.2 | Asset 모델 (상세 속성: IP, MAC, OS, 시리얼 등) | ✅ | |
| 11.3 | AssetValuation 모델 (CIA 1~3점) | ✅ | |
| 11.4 | AssetHistory / AssetDisposal 모델 | ✅ | |
| 11.5 | AssetAssignment / AssetHandover 모델 | ✅ | |
| 11.6 | Alembic 마이그레이션 (`20260126_1540-add_asset_models_phase2.py`) | ✅ | |
| 11.7 | 시드 데이터 (asset_categories.json, asset_types.json) | ✅ | |
| 11.8 | 자산 CRUD API (자산코드 자동생성) | ✅ | |
| 11.9 | CIA 평가 API (중요도 자동 산출) | ✅ | |
| 11.10 | 자산 이력 API (변경 전/후 값 추적) | ✅ | |
| 11.11 | 자산 담당자 할당/인수인계 API | ✅ | |
| 11.12 | 자산 폐기 API (데이터 삭제 증적) | ✅ | |
| 11.13 | 자산 담당자 변경 시 알림 발송 연동 | ✅ | `8d8aa21` |
| 11.14 | AssetService 비즈니스 로직 | ✅ | |
| 11.15 | 자산 API 테스트 | ✅ | |

### 12.0 위험 관리 모델 및 API
> Commits: `c686d65`, `28d80a1`, `0256054`

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 12.1 | ThreatCategory / Threat 모델 | ✅ | |
| 12.2 | AssetTypeThreat 모델 (자산유형-위협 매핑) | ✅ | |
| 12.3 | VulnerabilityCategory / Vulnerability 모델 | ✅ | |
| 12.4 | VulnerabilityAssessment 모델 | ✅ | |
| 12.5 | RiskScenario / RiskAssessment 모델 (DoR 계산) | ✅ | |
| 12.6 | DoAConfig / DoAHistory 모델 | ✅ | |
| 12.7 | RiskTreatmentPlan / RiskTreatmentAction 모델 | ✅ | |
| 12.8 | RiskTreatmentControlLink 모델 | ✅ | |
| 12.9 | SOARecord 모델 | ✅ | |
| 12.10 | Alembic 마이그레이션 (`20260126_1834-add_risk_models_phase2.py`) | ✅ | |
| 12.11 | 시드 데이터 (threats.json, vulnerabilities.json) | ✅ | |
| 12.12 | 위협 API (CRUD, 자산유형 연결) | ✅ | |
| 12.13 | 취약점 API (CRUD, 평가 기록) | ✅ | |
| 12.14 | 위험 시나리오 API (생성/조회/수정/완료) | ✅ | |
| 12.15 | 위험 평가 API (DoR 자동 계산) | ✅ | DoR = 자산가치 × 위협 × 취약점 |
| 12.16 | DoA 설정 API (임계값 설정/이력) | ✅ | |
| 12.17 | 위험 처리 계획 API (전략, 실행, 잔여위험) | ✅ | |
| 12.18 | SOA API (통제항목별 적용 여부) | ✅ | |
| 12.19 | 위험 보고서 API (매트릭스, 분포, 비교) | ✅ | |
| 12.20 | 위험-통제 연계 API (효과성 평가) | ✅ | |
| 12.21 | 자산-위험 매핑 API | ✅ | |
| 12.22 | 자산 영향도 분석 API | ✅ | |
| 12.23 | 위험 평가 Excel 내보내기 | ✅ | |
| 12.24 | RiskService / RiskCalculationService 비즈니스 로직 | ✅ | |
| 12.25 | AssetRiskMappingService / AssetImpactService | ✅ | |
| 12.26 | RiskControlLinkageService | ✅ | |
| 12.27 | 위험 관리 API 테스트 | ✅ | |

### 13.0 Phase 2 Frontend
> 자산 관리 프론트엔드 구현 완료, 위험 관리 프론트엔드 진행중

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 13.1 | Asset 타입 정의 (asset.ts - 전체 타입) | ✅ | |
| 13.2 | Asset API 서비스 (assetService.ts - 전체 CRUD + 평가 + 이력 + 임포트/익스포트) | ✅ | |
| 13.3 | 자산 목록 페이지 (Assets/index.tsx) | ✅ | 필터, 페이지네이션 |
| 13.4 | 자산 등록/수정 페이지 (AssetCreate.tsx, AssetForm.tsx) | ✅ | |
| 13.5 | 자산 상세 페이지 (AssetDetail.tsx) | ✅ | |
| 13.6 | CIA 평가 컴포넌트 (CIAEvaluation.tsx) | ✅ | |
| 13.7 | 자산 이력 컴포넌트 (AssetHistory.tsx) | ✅ | |
| 13.8 | 자산 통계 위젯 (AssetStatsWidgets.tsx) | ✅ | |
| 13.9 | 자산 필터 컴포넌트 (AssetFilter.tsx) | ✅ | |
| 13.10 | 자산 임포트 페이지 (AssetImport.tsx) | ✅ | |
| 13.11 | Risk 타입 정의 (risk.ts - 전체 타입 + 헬퍼 함수) | ✅ | |
| 13.12 | 위험 관리 페이지 전체 구현 (라우터, 사이드바, Risk/index.tsx, RiskScenarioDetail.tsx) | ✅ | 라우트 등록, 사이드바 메뉴 추가 |
| 13.13 | 위험 시나리오 관리 UI (상세페이지 탭, 상태 워크플로우, 시나리오 비교, Excel 내보내기) | ✅ | |
| 13.14 | 위험 평가 UI (위험 매트릭스 시각화) | ✅ | RiskMatrix 히트맵, RiskDistributionChart 분포 차트 |
| 13.15 | DoA 설정 UI | ✅ | 임계값 설정, 변경 이력 타임라인, DoA 초과 위험 목록, 위험점수 가이드 |
| 13.16 | 위험 처리 계획 UI | ✅ | 처리 계획 목록/수정, 조치 등록, 진행률 통계, 잔여 위험 시각화 |
| 13.17 | SOA 관리 UI | ✅ | 적용성 보고서 목록/수정, 구현상태 분포, SOA 생성/내보내기 |
| 13.18 | 위험 보고서/대시보드 UI | ✅ | 시나리오별 보고서, 핵심지표, 매트릭스/분포, 처리현황, 경영진요약, Top위험, 내보내기 |
| 13.19 | 위협/취약점 DB 관리 UI | ✅ | 통계/레벨분포, 상세Drawer, 카테고리 표시, 취약점 점검결과 등록/조회 |

---

## Phase 3: 고급 기능 (미착수)

### 14.0 자동화 및 연동

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 14.1 | 증적 자동 수집 (시스템 로그, 설정 스냅샷) | ⬚ | |
| 14.2 | 위험 자동 재평가 (자산/위협 변경 시) | ⬚ | |
| 14.3 | SIEM 연동 (보안 이벤트 수집) | ⬚ | |
| 14.4 | 취약점 스캐너 연동 | ⬚ | |
| 14.5 | CMDB 연동 (자산 자동 동기화) | ⬚ | |
| 14.6 | 이메일 알림 고도화 (다이제스트, 에스컬레이션) | ⬚ | |
| 14.7 | AI 기반 위험 분석/추천 | ⬚ | |

### 15.0 보고서 및 분석 고도화

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 15.1 | 인증 심사 보고서 자동 생성 | ⬚ | |
| 15.2 | 위험 트렌드 분석 (시나리오 간 비교) | ⬚ | |
| 15.3 | 컴플라이언스 갭 분석 | ⬚ | |
| 15.4 | 경영진 보고서 (요약 대시보드) | ⬚ | |
| 15.5 | PDF 보고서 내보내기 | ⬚ | |

### 16.0 운영 고도화

| # | Task | 상태 | 비고 |
|---|------|------|------|
| 16.1 | Kubernetes 배포 지원 | ⬚ | |
| 16.2 | Prometheus/Grafana 모니터링 | ⬚ | |
| 16.3 | 멀티 테넌시 (다중 조직 지원) | ⬚ | |
| 16.4 | SSO 연동 (SAML/OIDC) | ⬚ | |
| 16.5 | 국제화 (i18n) | ⬚ | |

---

## 요약

| Phase | 총 Task | 완료 | 진행중 | 미착수 |
|-------|---------|------|--------|--------|
| Phase 1 (MVP) | 89 | 89 | 0 | 0 |
| Phase 2 (자산/위험) | 46 | 46 | 0 | 0 |
| Phase 3 (고급 기능) | 17 | 0 | 0 | 17 |
| **합계** | **152** | **135** | **0** | **17** |

### 현재 진행 상태
- **Phase 1**: 완료 (Backend + Frontend + 테스트 + 문서화)
- **Phase 2**: ✅ **완료** (Backend + Frontend 자산관리 + 위험관리 전체)
- **Phase 3**: 미착수

### 다음 우선순위
1. Phase 2 Frontend 테스트 보강
2. Phase 3 기획 및 착수
