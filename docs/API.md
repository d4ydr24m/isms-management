# API 사용 가이드

## 개요

ISMS 관리 시스템 API는 REST 아키텍처를 따르며, JSON 형식으로 데이터를 주고받습니다.

### 기본 URL

- 개발: `http://localhost:8000/api/v1`
- 운영: `https://your-domain.com/api/v1`

### API 문서

- Swagger UI: `/docs`
- ReDoc: `/redoc`
- OpenAPI JSON: `/openapi.json`

## 인증

### JWT 토큰 인증

모든 보호된 엔드포인트는 Bearer 토큰 인증이 필요합니다.

```
Authorization: Bearer <access_token>
```

### 로그인

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password",
  "otp_code": "123456"  // MFA 활성화 시 필요
}
```

**응답:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

### 토큰 갱신

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## 공통 응답 형식

### 성공 응답

```json
{
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### 에러 응답

```json
{
  "detail": "에러 메시지",
  "error_code": "ERROR_CODE"
}
```

### HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 204 | 삭제 성공 (본문 없음) |
| 400 | 잘못된 요청 |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 422 | 유효성 검사 실패 |
| 500 | 서버 오류 |

## 페이지네이션

목록 조회 API는 페이지네이션을 지원합니다.

### 요청 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|-------|------|
| skip | int | 0 | 건너뛸 항목 수 |
| limit | int | 20 | 조회할 항목 수 (최대 100) |

### 예시

```http
GET /api/v1/users?skip=0&limit=20
```

## API 엔드포인트

### 인증 (Authentication)

| 메서드 | 엔드포인트 | 설명 | 인증 |
|--------|-----------|------|------|
| POST | `/auth/login` | 로그인 | X |
| POST | `/auth/logout` | 로그아웃 | O |
| POST | `/auth/refresh` | 토큰 갱신 | X |
| POST | `/auth/password/change` | 비밀번호 변경 | O |
| POST | `/auth/mfa/setup` | MFA 설정 | O |
| POST | `/auth/mfa/verify` | MFA 검증 | O |
| GET | `/auth/me` | 현재 사용자 정보 | O |

### 사용자 (Users)

| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|-----------|------|------|
| GET | `/users` | 사용자 목록 | admin |
| POST | `/users` | 사용자 생성 | admin |
| GET | `/users/{id}` | 사용자 상세 | admin |
| PUT | `/users/{id}` | 사용자 수정 | admin |
| DELETE | `/users/{id}` | 사용자 삭제 | admin |

**사용자 생성 예시:**

```http
POST /api/v1/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "department_id": 1,
  "role_ids": [2]
}
```

### 증적 (Evidences)

| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|-----------|------|------|
| GET | `/evidences` | 증적 목록 | 인증 |
| POST | `/evidences` | 증적 생성 | 인증 |
| GET | `/evidences/{id}` | 증적 상세 | 인증 |
| PUT | `/evidences/{id}` | 증적 수정 | 인증 |
| DELETE | `/evidences/{id}` | 증적 삭제 | 인증 |
| POST | `/evidences/{id}/files` | 파일 업로드 | 인증 |
| GET | `/evidences/{id}/files/{file_id}` | 파일 다운로드 | 인증 |
| GET | `/evidences/{id}/versions` | 버전 히스토리 | 인증 |

**증적 생성 예시:**

```http
POST /api/v1/evidences
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "정보보호 정책서",
  "description": "2024년 정보보호 정책서",
  "control_ids": [1, 2, 3],
  "valid_from": "2024-01-01",
  "valid_until": "2024-12-31",
  "is_periodic": true,
  "period_months": 12
}
```

**파일 업로드 예시:**

```http
POST /api/v1/evidences/1/files
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
```

### 통제항목 (Controls)

| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|-----------|------|------|
| GET | `/controls` | 통제항목 목록 | 인증 |
| GET | `/controls/{id}` | 통제항목 상세 | 인증 |
| GET | `/controls/tree` | 통제항목 트리 구조 | 인증 |
| GET | `/controls/{id}/evidences` | 통제항목별 증적 | 인증 |

### 감사 (Audits)

| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|-----------|------|------|
| GET | `/audits` | 감사 계획 목록 | 인증 |
| POST | `/audits` | 감사 계획 생성 | admin/manager |
| GET | `/audits/{id}` | 감사 계획 상세 | 인증 |
| PUT | `/audits/{id}` | 감사 계획 수정 | admin/manager |
| DELETE | `/audits/{id}` | 감사 계획 삭제 | admin |
| GET | `/audits/{id}/checklist` | 체크리스트 조회 | 인증 |
| PUT | `/audits/{id}/checklist` | 체크리스트 업데이트 | 인증 |

**감사 계획 생성 예시:**

```http
POST /api/v1/audits
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "2024년 상반기 내부감사",
  "audit_type": "internal",
  "start_date": "2024-06-01",
  "end_date": "2024-06-15",
  "lead_auditor_id": 1,
  "scope": "전사 정보보호 관리체계",
  "objectives": "ISMS-P 인증 갱신 준비"
}
```

### 부적합 (Nonconformities)

| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|-----------|------|------|
| GET | `/nonconformities` | 부적합 목록 | 인증 |
| POST | `/nonconformities` | 부적합 생성 | 인증 |
| GET | `/nonconformities/{id}` | 부적합 상세 | 인증 |
| PUT | `/nonconformities/{id}` | 부적합 수정 | 인증 |
| POST | `/nonconformities/{id}/corrective-actions` | 시정조치 추가 | 인증 |

### 알림 (Notifications)

| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|-----------|------|------|
| GET | `/notifications` | 알림 목록 | 인증 |
| PUT | `/notifications/{id}/read` | 읽음 처리 | 인증 |
| PUT | `/notifications/read-all` | 전체 읽음 | 인증 |
| GET | `/notifications/settings` | 알림 설정 조회 | 인증 |
| PUT | `/notifications/settings` | 알림 설정 변경 | 인증 |

### 대시보드 (Dashboard)

| 메서드 | 엔드포인트 | 설명 | 권한 |
|--------|-----------|------|------|
| GET | `/dashboard/summary` | 전체 요약 | 인증 |
| GET | `/dashboard/progress` | 진척률 | 인증 |
| GET | `/dashboard/activities` | 예정 활동 | 인증 |
| GET | `/dashboard/expiring-evidences` | 만료 예정 증적 | 인증 |
| GET | `/dashboard/pending-tasks` | 미완료 업무 | 인증 |
| GET | `/dashboard/nonconformities` | 부적합 현황 | 인증 |

## WebSocket

### 실시간 알림

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/notifications?token=<access_token>');

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('새 알림:', notification);
};
```

**알림 메시지 형식:**

```json
{
  "id": 1,
  "type": "evidence_expiring",
  "title": "증적 만료 예정",
  "message": "정보보호 정책서가 7일 후 만료됩니다.",
  "data": {
    "evidence_id": 1,
    "days_until_expiry": 7
  },
  "created_at": "2024-01-20T10:00:00Z"
}
```

## 에러 처리

### 인증 에러

```json
{
  "detail": "유효하지 않은 인증 정보입니다.",
  "error_code": "INVALID_CREDENTIALS"
}
```

### 유효성 검사 에러

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "유효한 이메일 주소를 입력하세요.",
      "type": "value_error.email"
    }
  ]
}
```

### 권한 에러

```json
{
  "detail": "이 작업을 수행할 권한이 없습니다.",
  "error_code": "PERMISSION_DENIED"
}
```

## Rate Limiting

API는 요청 수를 제한합니다.

- 인증된 사용자: 1000 요청/분
- 비인증 사용자: 100 요청/분

Rate limit 초과 시 `429 Too Many Requests` 응답을 반환합니다.

## SDK 예시

### Python

```python
import requests

class ISMSClient:
    def __init__(self, base_url, email, password):
        self.base_url = base_url
        self.token = self._login(email, password)

    def _login(self, email, password):
        response = requests.post(
            f"{self.base_url}/auth/login",
            json={"email": email, "password": password}
        )
        return response.json()["access_token"]

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def get_evidences(self, skip=0, limit=20):
        response = requests.get(
            f"{self.base_url}/evidences",
            params={"skip": skip, "limit": limit},
            headers=self._headers()
        )
        return response.json()

# 사용 예시
client = ISMSClient("http://localhost:8000/api/v1", "user@example.com", "password")
evidences = client.get_evidences()
```

### JavaScript/TypeScript

```typescript
class ISMSClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async login(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    this.token = data.access_token;
  }

  async getEvidences(skip = 0, limit = 20): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/evidences?skip=${skip}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${this.token}` }
      }
    );
    return response.json();
  }
}

// 사용 예시
const client = new ISMSClient('http://localhost:8000/api/v1');
await client.login('user@example.com', 'password');
const evidences = await client.getEvidences();
```
