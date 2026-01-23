# 사용자 관리 페이지

사용자 관리 모듈의 프론트엔드 구현입니다.

## 구현된 페이지

### 1. 사용자 목록 (`index.tsx`)

사용자 목록을 조회하고 관리하는 페이지입니다.

**주요 기능:**
- 사용자 목록 조회 (페이지네이션)
- 검색 기능 (이름, 이메일)
- 상태 필터링 (활성/비활성)
- 사용자 상세 보기
- 사용자 비활성화
- 사용자 추가 버튼

**사용된 컴포넌트:**
- DataTable: 데이터 테이블 컴포넌트
- SearchInput: 검색 입력 컴포넌트
- Ant Design: Table, Button, Tag, Modal, Select

### 2. 사용자 상세 (`UserDetail.tsx`)

개별 사용자의 상세 정보를 조회하고 수정하는 페이지입니다.

**주요 기능:**
- 사용자 정보 표시 (이름, 이메일, 부서, 상태, 2FA)
- 사용자 정보 수정
- 역할 목록 조회
- 역할 추가/제거
- 사용자 활성화/비활성화

**사용된 컴포넌트:**
- Ant Design: Card, Descriptions, Tag, Button, Modal, Form, Input, Select, Switch

### 3. 사용자 생성 (`UserCreate.tsx`)

새로운 사용자를 생성하는 페이지입니다.

**주요 기능:**
- 사용자 정보 입력 폼
- 이메일 형식 검증
- 비밀번호 정책 검증 (최소 8자, 대소문자, 숫자, 특수문자)
- 비밀번호 확인
- 다중 역할 선택
- 부서 선택

**검증 규칙:**
- 이름: 필수
- 이메일: 필수, 이메일 형식
- 비밀번호: 최소 8자, 대소문자, 숫자, 특수문자 포함
- 역할: 필수 (다중 선택 가능)

### 4. 심사원 계정 관리 (`AuditorAccounts.tsx`)

외부 심사원을 위한 임시 계정을 관리하는 페이지입니다.

**주요 기능:**
- 심사원 계정 목록 조회
- 계정 생성 (유효기간 설정)
- 접근 범위 지정 (증적관리, 감사관리 등)
- 다운로드 권한 설정
- 계정 수정
- 계정 만료/삭제
- 유효기간 만료 상태 표시

**접근 범위 옵션:**
- 증적관리
- 감사관리
- 통제항목
- 대시보드

## API 서비스

### `services/users.ts`
- `getUsers()`: 사용자 목록 조회
- `getUser(id)`: 사용자 상세 조회
- `createUser(data)`: 사용자 생성
- `updateUser(id, data)`: 사용자 수정
- `deleteUser(id)`: 사용자 비활성화
- `assignRoles(id, roleIds)`: 역할 할당
- `getRoles()`: 역할 목록 조회

### `services/auditorAccounts.ts`
- `getAuditorAccounts()`: 심사원 계정 목록 조회
- `getAuditorAccount(id)`: 심사원 계정 상세 조회
- `createAuditorAccount(data)`: 심사원 계정 생성
- `updateAuditorAccount(id, data)`: 심사원 계정 수정
- `deleteAuditorAccount(id)`: 심사원 계정 삭제

## 라우팅

```tsx
/users                    - 사용자 목록
/users/create            - 사용자 생성
/users/:id               - 사용자 상세
/users/auditor-accounts  - 심사원 계정 관리
```

## 테스트

TDD 방식으로 개발되었으며, 각 페이지에 대한 테스트가 작성되었습니다.

**테스트 파일:**
- `test/pages/Users/UserList.test.tsx`
- `test/pages/Users/UserDetail.test.tsx`
- `test/pages/Users/UserCreate.test.tsx`
- `test/pages/Users/AuditorAccounts.test.tsx`

**테스트 실행:**
```bash
npm test -- src/test/pages/Users
```

## 코드 품질

- TypeScript strict 모드 사용
- 불변성 유지 (스프레드 연산자 사용)
- 함수형 컴포넌트 및 훅 사용
- 적절한 오류 처리
- 사용자 친화적인 메시지

## 향후 개선 사항

- [ ] 부서 선택 드롭다운 구현 (현재는 부서 ID 직접 입력)
- [ ] 사용자 프로필 이미지 업로드
- [ ] 대량 사용자 가져오기 (CSV/Excel)
- [ ] 사용자 활동 로그 조회
- [ ] 고급 필터링 (부서별, 역할별 등)
