# 프로젝트 정보
- Python 3.x + FastAPI (uvicorn ASGI 서버)
- DB: PostgreSQL, SQLAlchemy 2.0 ORM + Alembic 마이그레이션
- 인증: python-jose (JWT) + bcrypt + pyotp (MFA)
- 비동기 작업: Celery + Redis
- 파일 스토리지: MinIO
- 테스트: pytest + pytest-asyncio, backend/tests/ 디렉토리

# Python 보안 점검
- SQL: f-string, .format()으로 쿼리 조합 금지 → parameterized query
- XML: 외부 엔티티 비활성화, `defusedxml` 사용 권장
- 역직렬화: `pickle.load`, `yaml.load` 금지 → `yaml.safe_load`
- subprocess: `shell=True` 금지, 입력값을 리스트로 전달
- eval/exec: 외부 입력값에 대해 사용 금지
- assert: 보안 검증에 사용 금지 (최적화 시 제거됨)
- 임시 파일: `tempfile` 모듈 사용, /tmp에 수동 생성 금지

# Python 품질 규칙
- bare except 금지 → 구체적 예외 타입 지정
- 파일/DB 연결은 `with` (context manager) 필수
- 타입 힌트 적극 활용