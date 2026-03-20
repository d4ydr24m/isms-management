# ISMS-P 통합 관리 시스템 - PRD (Product Requirements Document)

## 1. 개요

### 1.1 프로젝트 명
ISMS-P (정보보호 및 개인정보보호 관리체계) 통합 관리 시스템

### 1.2 목적
ISMS-P 인증 취득 및 유지를 위한 통합 관리 플랫폼 구축. 통제항목 관리, 증적 수집/관리, 위험 평가, 내부 감사, 자산 관리 등 인증 전 과정을 체계적으로 지원한다.

### 1.3 범위
- 80개 ISMS-P 통제항목 관리
- 증적 문서 관리 및 버전 관리
- 정보자산 분류/평가/관리
- 위험 평가 및 처리 계획
- 내부 감사 및 부적합 관리
- 대시보드 및 실시간 알림
- 사용자/역할 기반 접근 제어

### 1.4 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | FastAPI 0.109, Python 3.11+, SQLAlchemy 2.0, Alembic |
| Frontend | React 18, TypeScript 5.3, Vite 5, Ant Design 5, Zustand |
| Database | PostgreSQL 15 |
| Cache/Queue | Redis 7, Celery |
| Storage | MinIO (S3-compatible) |
| Infra | Docker Compose, Nginx, GitHub Actions CI/CD |

---

## 2. 사용자 역할 (Roles)

| 역할 | 설명 | 주요 권한 |
|------|------|-----------|
| Admin | 시스템 관리자 | 전체 시스템 설정, 사용자/역할 관리, 감사 로그 조회 |
| Manager | ISMS 담당자 | 증적 관리, 감사 계획, 위험 평가, 자산 관리, 부적합 관리 |
| User | 일반 사용자 | 증적 조회/등록, 할당된 업무 수행 |
| Auditor | 외부 감사원 | 임시 계정, 제한된 범위 조회, 증적 다운로드 |

---

## 3. 기능 요구사항

### Phase 1: Foundation (MVP)

#### FR-100: 인증 및 접근 제어

| ID | 기능 | 설명 |
|----|------|------|
| FR-101 | 로그인/로그아웃 | 이메일/비밀번호 인증, JWT Access/Refresh 토큰 |
| FR-102 | MFA (2단계 인증) | TOTP 기반, QR코드 연동 (Google Authenticator 등) |
| FR-103 | 비밀번호 정책 | 8자 이상, 대소문자/숫자/특수문자 필수, 90일 만료 |
| FR-104 | 계정 잠금 | 로그인 5회 실패 시 30분 잠금 |
| FR-105 | 세션 관리 | 30분 비활성 타임아웃, Redis 기반 세션 |
| FR-106 | RBAC | 역할 기반 접근 제어, 권한 문자열 기반 세밀한 제어 |
| FR-107 | 감사원 임시 계정 | 유효기간/접근범위 제한, 다운로드 권한 별도 설정 |

#### FR-200: 통제항목 관리

| ID | 기능 | 설명 |
|----|------|------|
| FR-201 | 통제항목 구조 | 영역(Domain) → 분류(Category) → 항목(Item) 3단계 |
| FR-202 | 80개 통제항목 | ISMS-P 표준 80개 항목 시드 데이터 |
| FR-203 | 증적 매핑 | 통제항목-증적 다대다 매핑 |
| FR-204 | 이행 현황 | 영역별/전체 증적 커버리지 통계 |

#### FR-300: 증적 관리

| ID | 기능 | 설명 |
|----|------|------|
| FR-301 | 증적 등록 | 파일 업로드 (MinIO), 메타데이터 관리, 드래그앤드롭 |
| FR-302 | 버전 관리 | 증적 버전 이력, 변경 사유, 이전 버전 롤백 |
| FR-303 | 유효기간 | 유효기간 설정, 만료 임박 알림 (N일 전) |
| FR-304 | 무결성 검증 | SHA-256 해시 기반 파일 무결성 확인 |
| FR-305 | 통제항목 매핑 | 증적 ↔ 통제항목 다대다 연결 |
| FR-306 | 검토 워크플로우 | 상태 관리 (draft → active → expired → archived) |
| FR-307 | 템플릿 | 시스템/사용자 정의 증적 템플릿 제공 |

#### FR-400: 감사 관리

| ID | 기능 | 설명 |
|----|------|------|
| FR-401 | 감사 계획 | 내부/외부/인증 감사 유형, 범위, 감사팀 구성 |
| FR-402 | 체크리스트 | 통제항목 기반 체크리스트 자동 생성 |
| FR-403 | 감사 결과 | 적합/부적합/관찰사항/해당없음 기록 |
| FR-404 | 부적합 관리 | 유형(중대/경미/관찰), 심각도(Critical/High/Medium/Low) |
| FR-405 | 시정 조치 | 근본 원인 분석, 시정 계획, 완료 추적, 검증 |
| FR-406 | 부적합 종결 | 시정 조치 검증 후 종결, 재개방 가능 |

#### FR-500: 대시보드

| ID | 기능 | 설명 |
|----|------|------|
| FR-501 | 인증 준비 현황 | 전체 통제항목 대비 증적 커버리지 게이지 |
| FR-502 | 만료 임박 증적 | 만료 예정 증적 목록 (색상 코딩) |
| FR-503 | 부적합 현황 | 심각도별 부적합 요약 |
| FR-504 | 예정 활동 | 타임라인 형태의 예정 활동 목록 |
| FR-505 | 대기 업무 | 할당된 업무 및 마감일 |

#### FR-600: 사용자 관리

| ID | 기능 | 설명 |
|----|------|------|
| FR-601 | 사용자 CRUD | 생성/조회/수정/비활성화 (소프트 삭제) |
| FR-602 | 부서 관리 | 계층형 부서 구조, 부서장 지정 |
| FR-603 | 역할 할당 | 다중 역할 할당, 권한 관리 |

#### FR-700: 시스템 기능

| ID | 기능 | 설명 |
|----|------|------|
| FR-701 | 감사 로그 | 전체 사용자 행위 기록, 해시 체이닝 위변조 방지 |
| FR-702 | 감사 로그 내보내기 | Excel 형식 내보내기 |
| FR-703 | 실시간 알림 | WebSocket 기반 실시간 알림 |
| FR-704 | 알림 설정 | 유형별 이메일/앱 알림, 빈도 설정 (실시간/일간/주간) |
| FR-705 | 정기 활동 | Cron 기반 정기 보안 활동 스케줄링 및 실행 추적 |
| FR-706 | 통합 검색 | 통제항목/증적/사용자 통합 검색 (Ctrl+K) |
| FR-707 | 다크 모드 | 라이트/다크/시스템 테마 지원 |
| FR-708 | 데이터 마이그레이션 | 데이터 임포트/익스포트 유틸리티 |

---

### Phase 2: 자산 및 위험 관리

#### FR-800: 정보자산 관리

| ID | 기능 | 설명 |
|----|------|------|
| FR-801 | 자산 분류 체계 | 자산유형(8종: 서버/네트워크/보안장비/DB/앱/PC/문서/인력) + 카테고리(3단계 계층) |
| FR-802 | 자산 등록/관리 | 자산코드 자동생성, 상세 속성(IP, MAC, OS, 시리얼 등), 상태 관리 |
| FR-803 | 자산 평가 (CIA) | 기밀성/무결성/가용성 3점 척도 평가, 중요도 자동 산출 (MAX(C,I,A)) |
| FR-804 | 자산 이력 관리 | 변경 이력 추적 (변경 전/후 값), 상태 전이 (도입→운영→변경→폐기) |
| FR-805 | 자산 담당자 | 소유자/관리자/사용자 다중 할당, 인수인계 체크리스트 |
| FR-806 | 자산 폐기 | 폐기 절차, 데이터 삭제 증적, 승인 프로세스 |
| FR-807 | 일괄 임포트/익스포트 | Excel 템플릿 기반 대량 등록, 필터링 내보내기 |
| FR-808 | 자산 통계 | 유형별/부서별/중요도별 통계 대시보드 |

#### FR-900: 위험 관리

| ID | 기능 | 설명 |
|----|------|------|
| FR-901 | 위협 DB | 위협 카테고리/정의, 위협 수준(1~3), 자산유형별 위협 매핑 |
| FR-902 | 취약점 DB | 취약점 카테고리/정의, 취약점 수준(1~3), 취약점 평가 기록 |
| FR-903 | 위험 시나리오 | 위험 평가 시나리오 (연간/반기/특별), 상태 관리 |
| FR-904 | 위험 평가 | 자산가치 × 위협수준 × 취약점수준 = DoR (1~27점) |
| FR-905 | DoA (수용기준) | 수용기준 임계값 설정, 변경 이력/승인, 초과 위험 식별 |
| FR-906 | 위험 처리 계획 | 처리 전략 (감소/회피/전가/수용), 예산/일정, 실행 결과, 잔여 위험 |
| FR-907 | SOA (적용성 보고서) | 통제항목별 적용 여부, 구현 상태, 관련 자산/위험 연계 |
| FR-908 | 위험 보고서 | 위험 매트릭스, 수준별 분포, DoA 초과 목록, 시나리오 비교 |
| FR-909 | 위험-통제 연계 | 처리계획-통제항목 연결, 통제 효과성 평가 |
| FR-910 | Excel 내보내기 | 위험 평가 결과 Excel 내보내기 |

---

## 4. 비기능 요구사항

### 4.1 보안

| ID | 요구사항 | 설명 |
|----|----------|------|
| NFR-101 | 전송 암호화 | HTTPS/TLS 1.2+ (운영환경) |
| NFR-102 | 비밀번호 암호화 | bcrypt 해싱 |
| NFR-103 | 파일 무결성 | SHA-256 해시 검증 |
| NFR-104 | 감사 로그 위변조 방지 | 해시 체이닝 |
| NFR-105 | Rate Limiting | API 10r/s, 로그인 5r/min |
| NFR-106 | 보안 헤더 | X-Frame-Options, X-Content-Type-Options, HSTS |
| NFR-107 | CORS | 명시적 오리진 허용 |
| NFR-108 | SQL Injection 방지 | SQLAlchemy ORM 사용 |
| NFR-109 | 업로드 제한 | 파일 크기 100MB, MIME 타입 검증 |

### 4.2 성능

| ID | 요구사항 | 목표 |
|----|----------|------|
| NFR-201 | API 응답 시간 | 1초 이내 |
| NFR-202 | 동시 사용자 | 최대 1,000명 (Docker Compose 기준) |
| NFR-203 | 파일 업로드 | 100MB까지 프로그레스 바 지원 |

### 4.3 가용성

| ID | 요구사항 | 설명 |
|----|----------|------|
| NFR-301 | 데이터 백업 | 일일 자동 백업, 30일 보관 |
| NFR-302 | 복구 절차 | DB 복원 및 서비스 복구 절차 문서화 |
| NFR-303 | 헬스체크 | 전 서비스 Docker 헬스체크 |

### 4.4 테스트

| ID | 요구사항 | 목표 |
|----|----------|------|
| NFR-401 | Backend 커버리지 | 80% 이상 (476 tests) |
| NFR-402 | Frontend 커버리지 | 70% 이상 (636 tests) |
| NFR-403 | CI/CD | GitHub Actions 파이프라인 (lint, type-check, test, build, security scan) |

---

## 5. 데이터 모델 (핵심)

### 5.1 사용자/접근 제어
- **User**: 이메일, 해시 비밀번호, MFA, 로그인 추적, 부서 연결
- **Role**: 역할명, 권한 문자열 (comma-separated)
- **Department**: 계층형 부서 (self-referential)
- **AuditorAccount**: 임시 감사원 계정 (유효기간, 접근범위)

### 5.2 통제/증적
- **ControlDomain → ControlCategory → ControlItem**: ISMS-P 80개 항목
- **Evidence**: 파일(MinIO), 해시, 버전, 상태, 유효기간
- **EvidenceVersion**: 버전 이력
- **ControlItemEvidence**: 통제항목-증적 매핑 (M:N)

### 5.3 감사
- **AuditPlan**: 감사 유형/범위/팀
- **AuditChecklist → AuditChecklistResult**: 체크리스트 및 결과
- **NonConformity → CorrectiveAction**: 부적합 및 시정조치

### 5.4 자산 (Phase 2)
- **AssetType / AssetCategory**: 분류 체계
- **Asset**: 자산 코드, 상세 속성, 상태
- **AssetValuation**: CIA 평가 (C/I/A 1~3점)
- **AssetHistory / AssetDisposal / AssetAssignment / AssetHandover**: 이력/폐기/할당/인수인계

### 5.5 위험 (Phase 2)
- **Threat / ThreatCategory**: 위협 DB
- **Vulnerability / VulnerabilityCategory / VulnerabilityAssessment**: 취약점 DB/평가
- **RiskScenario / RiskAssessment**: 위험 시나리오/평가 (DoR = 자산가치 × 위협 × 취약점)
- **DoAConfig / DoAHistory**: 수용기준 설정/이력
- **RiskTreatmentPlan / RiskTreatmentAction**: 위험 처리 계획/실행
- **SOARecord**: 적용성 보고서

### 5.6 시스템
- **Notification / NotificationSetting**: 알림 및 설정
- **AuditLog**: 감사 로그 (해시 체이닝)
- **ScheduledTask / TaskExecution**: 정기 활동
- **EvidenceTemplate**: 증적 템플릿

---

## 6. API 설계

### 6.1 인증
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/v1/auth/login | 로그인 |
| POST | /api/v1/auth/logout | 로그아웃 |
| POST | /api/v1/auth/refresh | 토큰 갱신 |
| POST | /api/v1/auth/password/change | 비밀번호 변경 |
| POST | /api/v1/auth/mfa/setup | MFA 설정 |
| POST | /api/v1/auth/mfa/verify | MFA 검증 |
| GET | /api/v1/auth/me | 현재 사용자 |

### 6.2 사용자/역할/부서
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET/POST | /api/v1/users | 사용자 목록/생성 |
| GET/PUT/DELETE | /api/v1/users/{id} | 사용자 상세/수정/비활성화 |
| PUT | /api/v1/users/{id}/roles | 역할 할당 |
| CRUD | /api/v1/roles | 역할 관리 |
| CRUD | /api/v1/departments | 부서 관리 |
| CRUD | /api/v1/auditor-accounts | 감사원 계정 관리 |

### 6.3 통제항목
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/v1/controls/domains | 전체 통제항목 트리 |
| GET | /api/v1/controls/progress | 이행 현황 통계 |
| GET | /api/v1/controls/{id} | 통제항목 상세 |

### 6.4 증적
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET/POST | /api/v1/evidences | 증적 목록/등록 |
| GET/PUT/DELETE | /api/v1/evidences/{id} | 증적 상세/수정/삭제 |
| GET/POST | /api/v1/evidences/{id}/versions | 버전 이력/롤백 |
| POST | /api/v1/evidences/{id}/map-controls | 통제항목 매핑 |
| GET | /api/v1/evidences/{id}/download | 파일 다운로드 |
| GET | /api/v1/evidences/expiring | 만료 임박 목록 |

### 6.5 감사
| Method | Endpoint | 설명 |
|--------|----------|------|
| CRUD | /api/v1/audits/plans | 감사 계획 관리 |
| POST/GET | /api/v1/audits/plans/{id}/checklists | 체크리스트 관리 |
| POST | /api/v1/audits/plans/{id}/complete | 감사 완료 |
| CRUD | /api/v1/non-conformities | 부적합 관리 |
| POST | /api/v1/non-conformities/{id}/corrective-actions | 시정조치 등록 |
| POST | /api/v1/non-conformities/{id}/close | 부적합 종결 |

### 6.6 자산 (Phase 2)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET/POST | /api/v1/assets | 자산 목록/등록 |
| GET/PUT/DELETE | /api/v1/assets/{id} | 자산 상세/수정/삭제 |
| POST/GET | /api/v1/assets/{id}/valuations | CIA 평가 |
| POST/GET | /api/v1/assets/{id}/assignments | 담당자 할당 |
| POST | /api/v1/assets/{id}/handover | 인수인계 |
| POST | /api/v1/assets/{id}/dispose | 폐기 처리 |

### 6.7 위험 (Phase 2)
| Method | Endpoint | 설명 |
|--------|----------|------|
| CRUD | /api/v1/risks/scenarios | 위험 시나리오 관리 |
| CRUD | /api/v1/risks/assessments | 위험 평가 |
| GET/PUT | /api/v1/risks/doa | DoA 설정 |
| CRUD | /api/v1/risks/treatment-plans | 처리계획 관리 |
| GET/PUT | /api/v1/soa | SOA 관리 |
| GET | /api/v1/threats | 위협 DB |
| GET | /api/v1/vulnerabilities | 취약점 DB |

### 6.8 대시보드/알림/시스템
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/v1/dashboard/* | 대시보드 통계 |
| GET/PUT | /api/v1/notifications | 알림 관리 |
| WS | /ws/notifications | 실시간 알림 WebSocket |
| GET | /api/v1/audit-logs | 감사 로그 조회 |
| GET | /api/v1/audit-logs/export | 감사 로그 내보내기 |
| GET/POST | /api/v1/templates | 증적 템플릿 |

---

## 7. 인프라 아키텍처

```
Client (Browser)
    ↓ HTTPS/443
Nginx (Reverse Proxy, Rate Limiting, Security Headers)
    ├── /          → Frontend (React SPA, Port 3000)
    ├── /api/*     → Backend (FastAPI, Port 8000)
    ├── /ws/*      → Backend WebSocket
    └── /docs      → API Documentation (Swagger/ReDoc)

Backend Services:
    ├── PostgreSQL 15  (Port 5432) — Primary Database
    ├── Redis 7        (Port 6379) — Cache, Session, Message Broker
    ├── MinIO          (Port 9000) — Object Storage (증적 파일)
    ├── Celery Worker  — Background Task Processing
    └── Celery Beat    — Scheduled Task Scheduling
```

---

## 8. 배포 환경

| 환경 | 설명 |
|------|------|
| Development | docker-compose.yml, DEBUG=true, 로컬 엔드포인트 |
| Staging | docker-compose.prod.yml, 스테이징 도메인 |
| Production | docker-compose.prod.yml, HTTPS, 강화된 보안 설정 |

### 운영 환경 권장 사양
- CPU: 4코어 이상 (권장 8코어)
- RAM: 8GB 이상 (권장 16GB)
- Storage: 50GB SSD 이상 (권장 100GB)
- OS: Ubuntu 22.04 LTS

---

## 9. 향후 확장 계획

| Phase | 내용 | 비고 |
|-------|------|------|
| Phase 3 | 자동화 및 고급 분석 | 위험 자동 산출, 증적 자동 수집, AI 기반 분석 |
| Phase 4 | 외부 연동 | SIEM 연동, 취약점 스캐너 연동, CMDB 연동 |
| Phase 5 | 멀티 테넌시 | 다중 조직 지원, SaaS 모델 |
