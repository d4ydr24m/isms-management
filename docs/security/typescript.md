# 프로젝트 정보
- React 18 + TypeScript + Vite 기반 SPA
- UI 라이브러리: Ant Design 5 + Recharts
- 상태관리: Zustand, HTTP 클라이언트: Axios
- 라우팅: React Router DOM v6
- 패키지 매니저: npm
- 테스트: Vitest + @testing-library/react

# JavaScript/TypeScript 보안 점검
- XSS: `innerHTML`, `document.write()`, `dangerouslySetInnerHTML` 사용 시 새니타이징 필수
- Prototype Pollution: 사용자 입력 병합 시 `__proto__`, `constructor` 키 필터링
- eval 계열: `eval()`, `Function()`, `setTimeout(string)` 에 외부 입력 금지
- ReDoS: 사용자 입력에 적용되는 정규식의 백트래킹 가능성 점검
- JWT: 클라이언트 측 디코딩만으로 인가 판단 금지, 서버 검증 필수
- 쿠키: `httpOnly`, `secure`, `sameSite` 속성 확인
- CORS: 와일드카드(*) 지양, 허용 도메인 명시
- 의존성: `npm audit`으로 취약 패키지 점검

# TypeScript 추가
- `any` 사용 최소화 → `unknown` 또는 구체적 타입
- 타입 단언(`as`) 남발 금지 → 타입 가드 사용
- tsconfig.json에 `"strict": true` 확인

# 품질 규칙
- async/await에서 try/catch 또는 .catch() 누락 점검
- `===` 사용, `==` 지양
- Promise 반환 함수에 await 누락 점검