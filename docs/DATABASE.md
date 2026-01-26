# 데이터베이스 스키마 문서

## 개요

ISMS 관리 시스템은 PostgreSQL 15를 사용하며, SQLAlchemy 2.0 ORM과 Alembic 마이그레이션을 사용합니다.

### ERD 개요

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   departments   │     │     users       │     │     roles       │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │◄────│ department_id   │     │ id              │
│ name            │     │ email           │────►│ name            │
│ parent_id       │     │ name            │     │ permissions     │
└─────────────────┘     │ hashed_password │     └─────────────────┘
                        │ is_mfa_enabled  │              ▲
                        └─────────────────┘              │
                                 │                       │
                                 ▼              ┌────────┴────────┐
                        ┌─────────────────┐     │   user_roles    │
                        │   evidences     │     └─────────────────┘
                        ├─────────────────┤
                        │ id              │     ┌─────────────────┐
                        │ title           │     │ control_items   │
                        │ file_path       │     ├─────────────────┤
                        │ uploader_id     │────►│ id              │
                        │ valid_until     │     │ domain_id       │
                        └─────────────────┘     │ code            │
                                 │              │ name            │
                                 ▼              └─────────────────┘
                        ┌─────────────────┐              │
                        │evidence_versions│              │
                        └─────────────────┘              ▼
                                                ┌─────────────────┐
┌─────────────────┐                             │  audit_plans    │
│ notifications   │                             ├─────────────────┤
├─────────────────┤                             │ id              │
│ id              │                             │ title           │
│ user_id         │                             │ audit_type      │
│ type            │                             │ lead_auditor_id │
│ message         │                             └─────────────────┘
│ is_read         │                                      │
└─────────────────┘                                      ▼
                                                ┌─────────────────┐
                                                │non_conformities │
                                                └─────────────────┘
```

## 테이블 상세

### 사용자 관리

#### users (사용자)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| email | VARCHAR(255) | NO | | 이메일 (UNIQUE) |
| hashed_password | VARCHAR(255) | NO | | 암호화된 비밀번호 |
| name | VARCHAR(100) | NO | | 이름 |
| phone | VARCHAR(20) | YES | | 전화번호 |
| department_id | INTEGER | YES | | 부서 FK |
| is_active | BOOLEAN | NO | true | 활성 상태 |
| is_superuser | BOOLEAN | NO | false | 슈퍼유저 여부 |
| is_mfa_enabled | BOOLEAN | NO | false | 2FA 활성화 |
| mfa_secret | VARCHAR(255) | YES | | TOTP 시크릿 |
| failed_login_attempts | INTEGER | NO | 0 | 로그인 실패 횟수 |
| locked_until | TIMESTAMP | YES | | 계정 잠금 해제 시간 |
| password_changed_at | TIMESTAMP | NO | now() | 비밀번호 변경 시간 |
| last_login_at | TIMESTAMP | YES | | 마지막 로그인 |
| last_login_ip | VARCHAR(45) | YES | | 마지막 로그인 IP |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

**인덱스:**
- `ix_users_email` (email) - UNIQUE

#### roles (역할)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| name | VARCHAR(50) | NO | | 역할명 (UNIQUE) |
| description | VARCHAR(255) | YES | | 역할 설명 |
| permissions | TEXT | NO | | 권한 (쉼표 구분) |
| is_system_role | BOOLEAN | NO | false | 시스템 기본 역할 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

**기본 역할:**
- `admin`: 시스템 관리자
- `manager`: 부서장/관리자
- `user`: 일반 사용자
- `auditor`: 심사원

#### user_roles (사용자-역할 연결)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| user_id | INTEGER | NO | | 사용자 FK |
| role_id | INTEGER | NO | | 역할 FK |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |

**PK:** (user_id, role_id)

#### departments (부서)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| name | VARCHAR(100) | NO | | 부서명 |
| code | VARCHAR(20) | YES | | 부서 코드 |
| parent_id | INTEGER | YES | | 상위 부서 FK |
| level | INTEGER | NO | 0 | 계층 레벨 |
| sort_order | INTEGER | NO | 0 | 정렬 순서 |
| is_active | BOOLEAN | NO | true | 활성 상태 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

#### auditor_accounts (심사원 임시 계정)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| user_id | INTEGER | NO | | 사용자 FK |
| audit_plan_id | INTEGER | NO | | 감사 계획 FK |
| valid_from | TIMESTAMP | NO | | 유효 시작일 |
| valid_until | TIMESTAMP | NO | | 유효 만료일 |
| access_scope | TEXT | YES | | 접근 범위 JSON |
| allow_download | BOOLEAN | NO | false | 다운로드 허용 |
| is_active | BOOLEAN | NO | true | 활성 상태 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

---

### 통제항목 관리

#### control_domains (통제영역)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| code | VARCHAR(10) | NO | | 영역 코드 (예: 1, 2, 3) |
| name | VARCHAR(100) | NO | | 영역명 |
| description | TEXT | YES | | 영역 설명 |
| sort_order | INTEGER | NO | 0 | 정렬 순서 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

**ISMS-P 통제영역 (3개):**
1. 관리체계 수립 및 운영
2. 보호대책 요구사항
3. 개인정보 처리 단계별 요구사항

#### control_items (통제항목)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| domain_id | INTEGER | NO | | 통제영역 FK |
| code | VARCHAR(20) | NO | | 항목 코드 (예: 1.1.1) |
| name | VARCHAR(255) | NO | | 항목명 |
| description | TEXT | YES | | 항목 설명 |
| category | VARCHAR(100) | YES | | 카테고리 |
| required_evidence_types | TEXT | YES | | 필요 증적 유형 JSON |
| weight | INTEGER | NO | 1 | 가중치 |
| is_mandatory | BOOLEAN | NO | true | 필수 여부 |
| sort_order | INTEGER | NO | 0 | 정렬 순서 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

**인덱스:**
- `ix_control_items_code` (code) - UNIQUE
- `ix_control_items_domain_id` (domain_id)

---

### 증적 관리

#### evidences (증적)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| title | VARCHAR(255) | NO | | 증적 제목 |
| description | TEXT | YES | | 증적 설명 |
| file_path | VARCHAR(500) | NO | | MinIO 파일 경로 |
| file_name | VARCHAR(255) | NO | | 원본 파일명 |
| file_size | INTEGER | NO | | 파일 크기 (bytes) |
| file_hash | VARCHAR(64) | NO | | SHA256 해시 |
| mime_type | VARCHAR(100) | YES | | MIME 타입 |
| version | VARCHAR(20) | NO | 1.0 | 버전 |
| status | VARCHAR(20) | NO | active | 상태 |
| valid_from | DATE | YES | | 유효 시작일 |
| valid_until | DATE | YES | | 유효 만료일 |
| uploader_id | INTEGER | NO | | 업로더 FK |
| author | VARCHAR(100) | YES | | 작성자 |
| reviewed_by | INTEGER | YES | | 검토자 FK |
| reviewed_at | TIMESTAMP | YES | | 검토 일시 |
| review_comment | TEXT | YES | | 검토 의견 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

**상태 값:**
- `active`: 활성
- `expired`: 만료
- `archived`: 보관

**인덱스:**
- `ix_evidences_status` (status)
- `ix_evidences_valid_until` (valid_until)

#### evidence_versions (증적 버전)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| evidence_id | INTEGER | NO | | 증적 FK |
| version | VARCHAR(20) | NO | | 버전 |
| file_path | VARCHAR(500) | NO | | 파일 경로 |
| file_name | VARCHAR(255) | NO | | 파일명 |
| file_size | INTEGER | NO | | 파일 크기 |
| file_hash | VARCHAR(64) | NO | | 파일 해시 |
| uploaded_by | INTEGER | NO | | 업로더 FK |
| change_description | TEXT | YES | | 변경 설명 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |

#### control_item_evidences (통제항목-증적 연결)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| control_item_id | INTEGER | NO | | 통제항목 FK |
| evidence_id | INTEGER | NO | | 증적 FK |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| created_by | INTEGER | YES | | 생성자 FK |

**PK:** (control_item_id, evidence_id)

---

### 감사 관리

#### audit_plans (감사 계획)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| title | VARCHAR(255) | NO | | 감사 제목 |
| description | TEXT | YES | | 감사 설명 |
| audit_type | VARCHAR(50) | NO | | 감사 유형 |
| start_date | DATE | NO | | 시작일 |
| end_date | DATE | NO | | 종료일 |
| scope | TEXT | NO | | 감사 범위 |
| control_domains | TEXT | YES | | 대상 통제영역 |
| lead_auditor_id | INTEGER | NO | | 수감사인 FK |
| team_members | TEXT | YES | | 팀 구성원 ID JSON |
| status | VARCHAR(20) | NO | planning | 상태 |
| overall_result | VARCHAR(20) | YES | | 전체 결과 |
| final_report_path | VARCHAR(500) | YES | | 최종 보고서 경로 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

**감사 유형:**
- `internal`: 내부감사
- `external`: 외부감사
- `certification`: 인증심사

**상태:**
- `planning`: 계획 수립
- `in_progress`: 진행 중
- `completed`: 완료
- `cancelled`: 취소

#### audit_checklists (감사 체크리스트)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| audit_plan_id | INTEGER | NO | | 감사 계획 FK |
| control_item_id | INTEGER | NO | | 통제항목 FK |
| question | TEXT | NO | | 점검 질문 |
| sort_order | INTEGER | NO | 0 | 정렬 순서 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

#### audit_checklist_results (체크리스트 결과)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| checklist_id | INTEGER | NO | | 체크리스트 FK |
| result | VARCHAR(20) | YES | | 결과 |
| finding | TEXT | YES | | 발견사항 |
| evidence_references | TEXT | YES | | 참조 증적 ID JSON |
| auditor_comment | TEXT | YES | | 심사원 의견 |
| assessed_by | INTEGER | NO | | 평가자 FK |
| assessed_at | TIMESTAMP | NO | | 평가 일시 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

**결과 값:**
- `conformity`: 적합
- `non_conformity`: 부적합
- `observation`: 관찰사항
- `not_applicable`: 해당없음

#### non_conformities (부적합)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| audit_plan_id | INTEGER | YES | | 감사 계획 FK |
| control_item_id | INTEGER | NO | | 통제항목 FK |
| nc_type | VARCHAR(20) | NO | | 부적합 유형 |
| title | VARCHAR(255) | NO | | 제목 |
| description | TEXT | NO | | 부적합 내용 |
| root_cause | TEXT | YES | | 근본 원인 |
| impact | TEXT | YES | | 영향도 |
| responsible_department_id | INTEGER | YES | | 담당 부서 FK |
| responsible_user_id | INTEGER | YES | | 담당자 FK |
| due_date | DATE | YES | | 시정 기한 |
| status | VARCHAR(20) | NO | open | 상태 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

**부적합 유형:**
- `major`: 중결함
- `minor`: 경결함

**상태:**
- `open`: 미조치
- `in_progress`: 조치 중
- `resolved`: 조치 완료
- `closed`: 종결
- `overdue`: 기한 초과

#### corrective_actions (시정조치)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| non_conformity_id | INTEGER | NO | | 부적합 FK |
| action_type | VARCHAR(20) | NO | | 조치 유형 |
| description | TEXT | NO | | 조치 내용 |
| evidence_path | VARCHAR(500) | YES | | 조치 증적 경로 |
| implemented_by | INTEGER | NO | | 조치자 FK |
| implemented_at | TIMESTAMP | YES | | 조치 일시 |
| verified_by | INTEGER | YES | | 검증자 FK |
| verified_at | TIMESTAMP | YES | | 검증 일시 |
| verification_result | VARCHAR(20) | YES | | 검증 결과 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |
| updated_at | TIMESTAMP | NO | now() | 수정 시간 |

---

### 알림

#### notifications (알림)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| user_id | INTEGER | NO | | 수신자 FK |
| type | VARCHAR(50) | NO | | 알림 유형 |
| title | VARCHAR(255) | NO | | 알림 제목 |
| message | TEXT | NO | | 알림 내용 |
| data | TEXT | YES | | 추가 데이터 JSON |
| is_read | BOOLEAN | NO | false | 읽음 여부 |
| read_at | TIMESTAMP | YES | | 읽은 시간 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |

**알림 유형:**
- `evidence_expiring`: 증적 만료 예정
- `evidence_expired`: 증적 만료
- `task_assigned`: 업무 할당
- `task_due`: 업무 기한 임박
- `audit_scheduled`: 감사 일정
- `nc_assigned`: 부적합 할당
- `nc_due`: 시정조치 기한

**인덱스:**
- `ix_notifications_user_id` (user_id)
- `ix_notifications_is_read` (is_read)

---

### 감사 로그

#### audit_logs (감사 추적 로그)

| 컬럼 | 타입 | NULL | 기본값 | 설명 |
|------|------|------|-------|------|
| id | INTEGER | NO | auto | PK |
| user_id | INTEGER | YES | | 사용자 FK |
| action | VARCHAR(50) | NO | | 액션 유형 |
| resource_type | VARCHAR(50) | NO | | 리소스 유형 |
| resource_id | INTEGER | YES | | 리소스 ID |
| old_value | TEXT | YES | | 변경 전 값 JSON |
| new_value | TEXT | YES | | 변경 후 값 JSON |
| ip_address | VARCHAR(45) | YES | | 클라이언트 IP |
| user_agent | VARCHAR(500) | YES | | User Agent |
| hash | VARCHAR(64) | NO | | 무결성 해시 |
| prev_hash | VARCHAR(64) | YES | | 이전 로그 해시 |
| created_at | TIMESTAMP | NO | now() | 생성 시간 |

**액션 유형:**
- `create`, `read`, `update`, `delete`
- `login`, `logout`, `login_failed`
- `download`, `upload`

**인덱스:**
- `ix_audit_logs_user_id` (user_id)
- `ix_audit_logs_action` (action)
- `ix_audit_logs_resource_type` (resource_type)
- `ix_audit_logs_created_at` (created_at)

---

## 마이그레이션

### Alembic 명령어

```bash
# 현재 마이그레이션 상태 확인
alembic current

# 마이그레이션 히스토리 확인
alembic history

# 새 마이그레이션 생성
alembic revision --autogenerate -m "설명"

# 마이그레이션 적용
alembic upgrade head

# 특정 버전으로 마이그레이션
alembic upgrade <revision>

# 롤백
alembic downgrade -1

# 특정 버전으로 롤백
alembic downgrade <revision>
```

### 초기 데이터 시드

```bash
# 초기 데이터 생성
python -m app.db.init_db
```

초기 데이터:
- 기본 역할 (admin, manager, user, auditor)
- ISMS-P 80개 통제항목
- 시스템 관리자 계정

---

## 백업 및 복구

### PostgreSQL 백업

```bash
# 전체 백업
pg_dump -h localhost -U isms_user -d isms_db > backup_$(date +%Y%m%d).sql

# 압축 백업
pg_dump -h localhost -U isms_user -d isms_db | gzip > backup_$(date +%Y%m%d).sql.gz

# 특정 테이블 백업
pg_dump -h localhost -U isms_user -d isms_db -t evidences > evidences_backup.sql
```

### PostgreSQL 복구

```bash
# 전체 복구
psql -h localhost -U isms_user -d isms_db < backup.sql

# 압축 파일 복구
gunzip -c backup.sql.gz | psql -h localhost -U isms_user -d isms_db
```

---

## 성능 최적화

### 인덱스 권장사항

주요 쿼리 패턴에 따른 인덱스:

```sql
-- 증적 검색 최적화
CREATE INDEX ix_evidences_title_gin ON evidences USING gin(to_tsvector('korean', title));

-- 통제항목별 증적 조회
CREATE INDEX ix_control_item_evidences_control_id ON control_item_evidences(control_item_id);

-- 알림 조회 최적화
CREATE INDEX ix_notifications_user_unread ON notifications(user_id) WHERE is_read = false;

-- 감사 로그 날짜 범위 조회
CREATE INDEX ix_audit_logs_created_at_brin ON audit_logs USING brin(created_at);
```

### 파티셔닝 (대용량 데이터)

감사 로그 테이블 월별 파티셔닝:

```sql
-- 파티션 테이블 생성
CREATE TABLE audit_logs (
    id SERIAL,
    created_at TIMESTAMP NOT NULL,
    ...
) PARTITION BY RANGE (created_at);

-- 월별 파티션 생성
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```
