"""
FastAPI 미들웨어
IP 화이트리스트, 감사 로깅, Rate Limiting 등
"""
import json
import logging
import time
from datetime import datetime
from typing import Callable, List, Optional, Set

import redis
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings


logger = logging.getLogger(__name__)


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """
    IP 화이트리스트 미들웨어

    system_settings 테이블에서 설정을 동적으로 읽어 IP를 제한합니다.
    CIDR 표기법(예: 10.0.0.0/8)도 지원합니다.
    """

    def __init__(
        self,
        app: FastAPI,
        exempt_paths: Optional[List[str]] = None,
    ):
        super().__init__(app)
        self.exempt_paths = exempt_paths or [
            "/health", "/docs", "/redoc", "/openapi.json",
        ]
        # 캐시: (enabled, whitelist_entries, timestamp)
        self._cache: Optional[tuple] = None
        self._cache_ttl = 10  # 10초마다 DB 재조회

    def _load_settings(self) -> tuple:
        """DB에서 IP 화이트리스트 설정 로드 (캐시 적용)"""
        now = time.time()
        if self._cache and (now - self._cache[2]) < self._cache_ttl:
            return self._cache[0], self._cache[1]

        try:
            from app.core.deps import SessionLocal
            from app.models.system_setting import SystemSetting

            db = SessionLocal()
            try:
                enabled_row = db.query(SystemSetting).filter(
                    SystemSetting.key == "ip_whitelist_enabled"
                ).first()
                whitelist_row = db.query(SystemSetting).filter(
                    SystemSetting.key == "ip_whitelist"
                ).first()

                enabled = enabled_row.value == "true" if enabled_row else False
                raw = whitelist_row.value if whitelist_row else ""
                entries = [e.strip() for e in raw.split(",") if e.strip()] if raw else []
            finally:
                db.close()

            self._cache = (enabled, entries, now)
            return enabled, entries
        except Exception as e:
            logger.error(f"IP 화이트리스트 설정 로드 실패: {e}")
            # 설정 로드 실패 시 접근 허용 (안전 장치)
            return False, []

    def _ip_matches(self, client_ip: str, entry: str) -> bool:
        """IP가 항목과 일치하는지 확인 (CIDR 지원)"""
        import ipaddress
        try:
            client = ipaddress.ip_address(client_ip)
            if "/" in entry:
                return client in ipaddress.ip_network(entry, strict=False)
            else:
                return client == ipaddress.ip_address(entry)
        except ValueError:
            return False

    def is_allowed(self, client_ip: str, enabled: bool, entries: List[str]) -> bool:
        """IP 허용 여부 확인"""
        if not enabled:
            return True
        if not entries:
            return True

        # 로컬호스트는 항상 허용
        if client_ip in ("127.0.0.1", "localhost", "::1"):
            return True

        for entry in entries:
            if self._ip_matches(client_ip, entry):
                return True

        return False

    def _check_user_ip(self, client_ip: str, request: Request) -> Optional[Response]:
        """사용자별 IP 제한 확인. 차단 시 Response 반환, 허용 시 None."""
        try:
            from jose import jwt as jose_jwt
            from app.core.config import settings as app_settings
            from app.core.deps import SessionLocal
            from app.models.user import User

            # JWT 토큰 추출 (쿠키 또는 헤더)
            token = request.cookies.get("access_token")
            if not token:
                auth_header = request.headers.get("Authorization", "")
                if auth_header.startswith("Bearer "):
                    token = auth_header[7:]
            if not token:
                return None  # 인증 없는 요청은 여기서 차단하지 않음

            # 토큰 디코딩 (검증은 auth에서 수행)
            try:
                payload = jose_jwt.decode(token, app_settings.SECRET_KEY, algorithms=[app_settings.ALGORITHM])
                user_id = payload.get("user_id")
                if not user_id:
                    return None
            except Exception:
                return None

            # DB에서 사용자 IP 제한 확인
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == int(user_id)).first()
                if not user or not user.ip_whitelist_enabled or not user.allowed_ips:
                    return None

                allowed = [ip.strip() for ip in user.allowed_ips.split(",") if ip.strip()]
                if not allowed:
                    return None

                for entry in allowed:
                    if self._ip_matches(client_ip, entry):
                        return None  # 허용

                logger.warning(f"사용자별 IP 차단: user_id={user_id}, ip={client_ip}")
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"이 사용자에게 허용되지 않은 IP 주소입니다. ({client_ip})"}
                )
            finally:
                db.close()

        except Exception as e:
            logger.error(f"사용자별 IP 확인 실패: {e}")
            return None  # 실패 시 허용

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 제외 경로 확인
        path = request.url.path
        if any(path.startswith(exempt) for exempt in self.exempt_paths):
            return await call_next(request)

        # 설정 API 자체는 항상 허용 (잠금 방지)
        if path.startswith("/api/v1/system-settings"):
            return await call_next(request)

        # 로그인 경로는 글로벌 IP만 체크 (사용자별 체크 불가)
        is_login = path.startswith("/api/v1/auth/login")

        # 클라이언트 IP 확인
        client_ip = self._get_client_ip(request)

        # 1. 글로벌 IP 화이트리스트 체크
        enabled, entries = self._load_settings()
        if not self.is_allowed(client_ip, enabled, entries):
            logger.warning(f"글로벌 IP 차단: {client_ip}, 경로: {path}")
            return JSONResponse(
                status_code=403,
                content={"detail": f"접근이 허용되지 않은 IP 주소입니다. ({client_ip})"}
            )

        # 2. 사용자별 IP 화이트리스트 체크 (로그인 제외)
        if not is_login:
            user_block = self._check_user_ip(client_ip, request)
            if user_block:
                return user_block

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """클라이언트 IP 주소 추출"""
        # X-Forwarded-For 헤더 확인 (프록시 뒤)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        # X-Real-IP 헤더 확인
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # 직접 연결된 클라이언트 IP
        return request.client.host if request.client else "unknown"


class AuditLogMiddleware(BaseHTTPMiddleware):
    """
    감사 로그 미들웨어

    모든 API 요청을 로깅합니다.
    """

    def __init__(
        self,
        app: FastAPI,
        log_request_body: bool = False,
        log_response_body: bool = False,
        exempt_paths: Optional[List[str]] = None,
    ):
        super().__init__(app)
        self.log_request_body = log_request_body
        self.log_response_body = log_response_body
        self.exempt_paths = exempt_paths or ["/health", "/docs", "/redoc", "/openapi.json"]

    # 감사 로그 대상: 데이터 변경 요청만 DB에 기록
    AUDIT_METHODS = {"POST", "PUT", "DELETE", "PATCH"}

    def _extract_user_info(self, request: Request) -> dict:
        """JWT 토큰에서 사용자 정보 추출 (감사 로그용 - 만료된 토큰도 디코딩)"""
        try:
            from jose import jwt as jose_jwt
            from app.core.config import settings as app_settings

            token = request.cookies.get("access_token")
            if not token:
                auth_header = request.headers.get("Authorization", "")
                if auth_header.startswith("Bearer "):
                    token = auth_header[7:]
            if not token:
                return {}

            # 감사 로그 목적으로 만료된 토큰도 디코딩 (서명은 검증)
            payload = jose_jwt.decode(
                token,
                app_settings.SECRET_KEY,
                algorithms=[app_settings.ALGORITHM],
                options={"verify_exp": False},
            )
            return {
                "user_id": payload.get("user_id"),
                "user_email": payload.get("sub"),
            }
        except Exception:
            return {}

    def _get_action(self, method: str, path: str) -> str:
        """HTTP 메서드와 경로에서 액션 이름 추출"""
        if method == "POST" and "login" in path:
            return "login"
        if method == "POST" and "logout" in path:
            return "logout"
        action_map = {"POST": "create", "PUT": "update", "DELETE": "delete", "PATCH": "update"}
        return action_map.get(method, method.lower())

    def _get_resource_type(self, path: str) -> str:
        """경로에서 리소스 타입 추출"""
        parts = path.replace("/api/v1/", "").split("/")
        return parts[0] if parts else "unknown"

    # 리소스별 이름/식별 필드 매핑 (PUT/PATCH/DELETE 대상 정보 표시용)
    _TARGET_MODEL_MAP = {
        "departments": ("app.models.department", "Department", ["name", "code"]),
        "users": ("app.models.user", "User", ["name", "email"]),
        "assets": ("app.models.asset", "Asset", ["name", "asset_code"]),
        "personnel": ("app.models.personnel", "Personnel", ["name", "email"]),
        "roles": ("app.models.user", "Role", ["name"]),
        "controls": ("app.models.control", "ControlItem", ["code", "title"]),
        "evidences": ("app.models.evidence", "Evidence", ["title"]),
        "audits": ("app.models.audit", "AuditPlan", ["title"]),
        "nonconformities": ("app.models.audit", "NonConformity", ["title"]),
    }

    @staticmethod
    def _parse_resource_and_id(path: str) -> tuple[Optional[str], Optional[int]]:
        """
        경로에서 (리소스 타입, 리소스 ID) 추출.

        숫자 ID가 나오는 마지막 세그먼트의 바로 앞 세그먼트를 리소스 타입으로 사용한다.
        예) /api/v1/isms-scope/personnel/54 → ("personnel", 54)
            /api/v1/departments/27 → ("departments", 27)
            /api/v1/audits/3/nonconformities/12 → ("nonconformities", 12)
        """
        import re

        api_match = re.match(r"/api/v1/(.+)$", path)
        if not api_match:
            return None, None

        segments = [s for s in api_match.group(1).split("/") if s]
        for idx in range(len(segments) - 1, -1, -1):
            seg = segments[idx]
            if seg.isdigit() and idx > 0:
                return segments[idx - 1], int(seg)
        return None, None

    def _lookup_target_info(self, resource_type: str, resource_id: int) -> Optional[dict]:
        """resource_type + id에 해당하는 엔티티의 표시용 필드 조회"""
        mapping = self._TARGET_MODEL_MAP.get(resource_type)
        if not mapping:
            return None

        module_path, class_name, fields = mapping
        try:
            import importlib
            from app.core.deps import SessionLocal

            mod = importlib.import_module(module_path)
            model_class = getattr(mod, class_name)
            db = SessionLocal()
            try:
                obj = db.query(model_class).filter(model_class.id == resource_id).first()
                if not obj:
                    return None
                info = {"id": resource_id}
                for f in fields:
                    val = getattr(obj, f, None)
                    if val is not None:
                        info[f] = str(val)
                return info
            finally:
                db.close()
        except Exception:
            return None

    async def _read_and_rewrap_response(self, response: Response) -> tuple[Response, Optional[dict]]:
        """
        스트리밍 응답 바디를 읽어 JSON으로 파싱하고, 동일 내용으로 응답을 재구성한다.
        파싱 실패 또는 비-JSON 응답이면 원본 응답을 그대로 돌려준다.

        주의: raw_headers를 그대로 보존해 Set-Cookie 등 동일 키 다중 값 헤더를 유지한다.
        """
        from starlette.responses import Response as StarletteResponse

        body_iterator = getattr(response, "body_iterator", None)
        if body_iterator is None:
            return response, None

        try:
            chunks: list[bytes] = []
            total = 0
            async for chunk in body_iterator:
                chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode("utf-8"))
                total += len(chunks[-1])
                if total > 100_000:  # 100KB 초과 시 파싱 포기 (바이너리/대용량 방지)
                    break
            # 남은 청크가 있으면 드레인
            async for chunk in body_iterator:
                chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode("utf-8"))
            body = b"".join(chunks)
        except Exception:
            return response, None

        # 새 Response는 빈 headers로 만들고, 원본 raw_headers를 직접 복사해서
        # Set-Cookie 같이 동일 키가 여러 번 등장하는 헤더를 손실 없이 보존한다.
        new_response = StarletteResponse(
            content=body,
            status_code=response.status_code,
            media_type=response.media_type,
        )
        # Content-Length는 새 Response가 설정한 값을 유지하고, 나머지 헤더만 덮어쓴다
        original_raw = getattr(response, "raw_headers", [])
        preserved: list[tuple[bytes, bytes]] = []
        # 새 Response가 이미 설정한 content-type / content-length 유지
        for k, v in new_response.raw_headers:
            preserved.append((k, v))
        existing_keys = {k.lower() for k, _ in preserved}
        for k, v in original_raw:
            # bytes 키/값 처리
            key_bytes = k if isinstance(k, bytes) else str(k).encode("latin-1")
            val_bytes = v if isinstance(v, bytes) else str(v).encode("latin-1")
            kl = key_bytes.lower()
            if kl == b"content-length":
                continue  # 새 응답이 자동 설정
            if kl == b"content-type" and b"content-type" in existing_keys:
                continue  # 이미 media_type 기반으로 설정됨
            preserved.append((key_bytes, val_bytes))
        new_response.raw_headers = preserved

        parsed: Optional[dict] = None
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type and body:
            try:
                data = json.loads(body.decode("utf-8", errors="ignore"))
                if isinstance(data, dict):
                    parsed = data
            except Exception:
                parsed = None

        return new_response, parsed

    def _capture_delete_target(self, path: str) -> dict | None:
        """DELETE 요청 전 삭제 대상 리소스 정보를 캡처"""
        resource_type, resource_id = self._parse_resource_and_id(path)
        if resource_type is None or resource_id is None:
            return None
        info = self._lookup_target_info(resource_type, resource_id)
        if info:
            return info
        return {"id": resource_id, "resource": resource_type}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 제외 경로 확인
        path = request.url.path
        if any(path.startswith(exempt) for exempt in self.exempt_paths):
            return await call_next(request)

        # 요청 시작 시간
        start_time = datetime.utcnow()

        # 클라이언트 IP
        client_ip = self._get_client_ip(request)

        # 요청 바디 캡처 (감사 로그용)
        request_body = None
        target_info = None
        parsed_resource_type, parsed_resource_id = (None, None)
        if request.method in self.AUDIT_METHODS and path.startswith("/api/"):
            try:
                body_bytes = await request.body()
                if body_bytes and len(body_bytes) < 10000:  # 10KB 제한
                    request_body = body_bytes.decode("utf-8", errors="ignore")
            except Exception:
                pass

            # 경로에서 리소스 타입과 ID 추출 (예: /api/v1/isms-scope/personnel/54)
            parsed_resource_type, parsed_resource_id = self._parse_resource_and_id(path)

            # 대상 리소스 정보 캡처 (PUT/PATCH/DELETE 모두).
            # DELETE는 삭제 전 상태를, PUT/PATCH는 "누구에게 적용했는지" 표시용.
            if request.method in ("PUT", "PATCH", "DELETE") and parsed_resource_type and parsed_resource_id:
                target_info = self._lookup_target_info(parsed_resource_type, parsed_resource_id)

        # 요청 처리
        response = await call_next(request)

        # POST 2xx: 응답 바디에서 생성된 리소스의 ID/이름 추출
        # 클라이언트로 보낼 스트림을 소모해야 하므로, 읽은 후 반드시 새 Response로 교체
        # 인증 엔드포인트는 Set-Cookie 헤더가 중요하므로 제외 (대상 리소스 개념이 없음)
        if (
            target_info is None
            and request.method == "POST"
            and path.startswith("/api/")
            and not path.startswith("/api/v1/auth/")
            and 200 <= response.status_code < 300
            and parsed_resource_type is None  # 경로에 이미 ID가 있는 서브액션은 제외
        ):
            response, created = await self._read_and_rewrap_response(response)
            if created and isinstance(created, dict):
                created_id = created.get("id")
                # resource_type을 경로 첫 세그먼트에서 유도 (parsed가 없으므로)
                resource_type_from_path = self._get_resource_type(path)
                label_fields = ("name", "title", "email", "code", "asset_code")
                target_info = {}
                if created_id is not None:
                    try:
                        parsed_resource_id = int(created_id)
                        target_info["id"] = parsed_resource_id
                    except (TypeError, ValueError):
                        target_info["id"] = created_id
                for f in label_fields:
                    val = created.get(f)
                    if val is not None:
                        target_info[f] = str(val)
                # 아무 라벨 필드도 못 찾았으면 빈 dict로 남지 않게 처리
                if len(target_info) <= 1 and resource_type_from_path:
                    # 모델 룩업으로 보강
                    if created_id is not None and resource_type_from_path in self._TARGET_MODEL_MAP:
                        try:
                            lookup = self._lookup_target_info(resource_type_from_path, int(created_id))
                            if lookup:
                                target_info = lookup
                        except (TypeError, ValueError):
                            pass
                if not target_info:
                    target_info = None

        # 처리 시간 계산
        process_time = (datetime.utcnow() - start_time).total_seconds()

        # 콘솔 로그 (모든 요청)
        log_data = {
            "timestamp": start_time.isoformat(),
            "method": request.method,
            "path": path,
            "client_ip": client_ip,
            "status_code": response.status_code,
            "process_time_ms": round(process_time * 1000, 2),
        }
        logger.info(f"API 요청: {json.dumps(log_data, ensure_ascii=False)}")

        # DB 감사 로그 (데이터 변경 요청만)
        if request.method in self.AUDIT_METHODS and path.startswith("/api/"):
            try:
                from app.core.deps import SessionLocal
                from app.models.audit_log import AuditLog

                user_info = self._extract_user_info(request)
                user_name = None
                user_email = user_info.get("user_email", "")

                # 로그인 요청의 경우 요청 바디에서 이메일 추출
                if not user_info.get("user_id") and request_body and "login" in path:
                    try:
                        login_data = json.loads(request_body)
                        user_email = login_data.get("email", "")
                    except Exception:
                        pass

                if user_info.get("user_id"):
                    try:
                        db_temp = SessionLocal()
                        from app.models.user import User
                        u = db_temp.query(User).filter(User.id == user_info["user_id"]).first()
                        if u:
                            user_name = u.name
                            user_email = u.email
                        db_temp.close()
                    except Exception:
                        pass
                elif user_email:
                    # JWT 없는 경우 이메일로 사용자 조회 (로그인 시)
                    try:
                        db_temp = SessionLocal()
                        from app.models.user import User
                        u = db_temp.query(User).filter(User.email == user_email).first()
                        if u:
                            user_name = u.name
                        db_temp.close()
                    except Exception:
                        pass

                # 요청 바디에서 민감 정보 제거 (비밀번호 등)
                body_dict: Optional[dict] = None
                if request_body:
                    try:
                        body_dict = json.loads(request_body)
                        sensitive_keys = {"password", "hashed_password", "mfa_secret", "otp_code", "current_password", "new_password"}
                        for key in sensitive_keys:
                            if key in body_dict:
                                body_dict[key] = "***"
                    except Exception:
                        body_dict = None

                # 대상 리소스 정보(이름 등)를 바디에 합쳐서 UI에서 "누구에게" 식별 가능하게 함
                payload: dict = {}
                if target_info:
                    payload["_target"] = target_info
                if body_dict is not None:
                    payload.update(body_dict)

                if payload:
                    sanitized_body = json.dumps(payload, ensure_ascii=False, default=str)[:2000]
                else:
                    sanitized_body = None

                db = SessionLocal()
                try:
                    import hashlib
                    action = self._get_action(request.method, path)
                    resource_type = self._get_resource_type(path)
                    hash_input = f"{start_time.isoformat()}|{user_info.get('user_id','')}|{action}|{resource_type}|{path}|{response.status_code}"
                    current_hash = hashlib.sha256(hash_input.encode()).hexdigest()

                    audit_log = AuditLog(
                        user_id=user_info.get("user_id"),
                        user_email=user_email,
                        user_name=user_name or "",
                        action=action,
                        resource_type=resource_type,
                        resource_id=parsed_resource_id,
                        new_value=sanitized_body,
                        ip_address=client_ip,
                        user_agent=request.headers.get("User-Agent", "")[:500],
                        request_method=request.method,
                        request_path=path[:500],
                        status_code=response.status_code,
                        current_hash=current_hash,
                    )
                    db.add(audit_log)
                    db.commit()
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"감사 로그 DB 기록 실패: {e}")

        return response

    def _get_client_ip(self, request: Request) -> str:
        """클라이언트 IP 주소 추출"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"


class SessionTimeoutMiddleware(BaseHTTPMiddleware):
    """
    세션 타임아웃 미들웨어

    일정 시간 미활동 시 세션을 만료시킵니다.
    Redis 기반 세션 저장소와 연동합니다.
    """

    def __init__(
        self,
        app: FastAPI,
        timeout_minutes: int = 30,
        redis_client=None,
    ):
        super().__init__(app)
        self.timeout_minutes = timeout_minutes
        self.redis_client = redis_client

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 인증 헤더 확인
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return await call_next(request)

        token = auth_header.split(" ")[1]

        # Redis 세션 확인 (Redis 클라이언트가 있는 경우)
        if self.redis_client:
            session_key = f"session:{token[:32]}"
            session = await self.redis_client.get(session_key)

            if session is None:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "세션이 만료되었습니다. 다시 로그인해주세요."}
                )

            # 세션 갱신 (활동 시간 업데이트)
            await self.redis_client.setex(
                session_key,
                self.timeout_minutes * 60,
                json.dumps({"last_activity": datetime.utcnow().isoformat()})
            )

        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate Limiting 미들웨어

    Redis 기반 고정 윈도우 카운터를 사용하여 요청 빈도를 제한합니다.
    Redis 연결 실패 시 요청을 허용합니다 (fail-open).
    """

    # Rate limiting 면제 경로
    EXEMPT_PATHS = ["/health", "/docs", "/redoc", "/openapi.json", "/"]

    # 로그인 관련 경로 패턴
    LOGIN_PATHS = ["/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/mfa/"]

    def __init__(self, app: FastAPI):
        super().__init__(app)
        self._redis_client: Optional[redis.Redis] = None
        self._redis_available = True

    @property
    def redis_client(self) -> Optional[redis.Redis]:
        """Redis 클라이언트 (lazy initialization)"""
        if self._redis_client is None:
            try:
                self._redis_client = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
                self._redis_client.ping()
                self._redis_available = True
            except Exception:
                logger.warning("Rate limiter: Redis 연결 실패, fail-open 모드로 동작합니다.")
                self._redis_available = False
                self._redis_client = None
        return self._redis_client

    def _get_client_ip(self, request: Request) -> str:
        """클라이언트 IP 주소 추출"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    def _get_path_group(self, path: str) -> Optional[str]:
        """경로를 그룹으로 분류하여 해당 제한 설정 반환"""
        # 면제 경로
        for exempt in self.EXEMPT_PATHS:
            if path == exempt or path.startswith(exempt):
                return None

        # 로그인 관련 경로
        for login_path in self.LOGIN_PATHS:
            if path == login_path or path.startswith(login_path):
                return "login"

        # 기타 API 경로
        if path.startswith("/api/v1/"):
            return "api"

        return None

    def _get_limits(self, path_group: str) -> tuple:
        """경로 그룹에 따른 (max_requests, window_seconds) 반환"""
        if path_group == "login":
            return settings.RATE_LIMIT_LOGIN_REQUESTS, settings.RATE_LIMIT_LOGIN_WINDOW
        elif path_group == "api":
            return settings.RATE_LIMIT_API_REQUESTS, settings.RATE_LIMIT_API_WINDOW
        else:
            return settings.RATE_LIMIT_DEFAULT_REQUESTS, settings.RATE_LIMIT_DEFAULT_WINDOW

    def _check_rate_limit(self, client_ip: str, path_group: str) -> tuple:
        """
        Rate limit 확인.

        Returns:
            (allowed: bool, current_count: int, max_requests: int, window: int, ttl: int)
        """
        max_requests, window = self._get_limits(path_group)
        redis_key = f"rate_limit:{client_ip}:{path_group}"

        client = self.redis_client
        if client is None:
            # Redis 사용 불가 시 허용 (fail-open)
            return True, 0, max_requests, window, window

        try:
            # INCR + EXPIRE 원자적 카운터
            count = client.incr(redis_key)
            if count == 1:
                # 새 키: TTL 설정
                client.expire(redis_key, window)

            ttl = client.ttl(redis_key)
            if ttl < 0:
                # TTL이 설정되지 않은 경우 (경합 상태 방지)
                client.expire(redis_key, window)
                ttl = window

            allowed = count <= max_requests
            return allowed, count, max_requests, window, ttl

        except Exception as e:
            logger.warning(f"Rate limiter: Redis 오류 ({e}), fail-open 모드로 요청 허용")
            self._redis_client = None
            self._redis_available = False
            return True, 0, max_requests, window, window

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        path_group = self._get_path_group(path)

        # 면제 경로이거나 분류 불가 시 그냥 통과
        if path_group is None:
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        allowed, count, max_requests, window, ttl = self._check_rate_limit(
            client_ip, path_group
        )

        if not allowed:
            retry_after = ttl if ttl > 0 else window
            logger.warning(
                f"Rate limit 초과: IP={client_ip}, path={path}, "
                f"count={count}/{max_requests}, retry_after={retry_after}s"
            )
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.",
                    "retry_after": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + retry_after),
                },
            )

        # 정상 요청 처리
        response = await call_next(request)

        # Rate limit 헤더 추가
        remaining = max(0, max_requests - count)
        reset_time = int(time.time()) + (ttl if ttl > 0 else window)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_time)

        return response


def setup_middleware(app: FastAPI) -> None:
    """
    미들웨어 설정

    Args:
        app: FastAPI 애플리케이션
    """
    # 감사 로그 미들웨어
    app.add_middleware(AuditLogMiddleware)

    # IP 화이트리스트 미들웨어 (필요한 경우 활성화)
    # app.add_middleware(
    #     IPWhitelistMiddleware,
    #     whitelist=settings.ALLOWED_IPS if hasattr(settings, 'ALLOWED_IPS') else None,
    #     enabled=getattr(settings, 'IP_WHITELIST_ENABLED', False),
    # )
