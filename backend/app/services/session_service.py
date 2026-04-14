"""
세션 관리 서비스
Redis 기반 세션 저장소
"""
import json
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import redis
from sqlalchemy import text

from app.core.config import settings


class SessionService:
    """
    Redis 기반 세션 관리 서비스
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self._client: Optional[redis.Redis] = None

    def _get_session_timeout_seconds(self) -> int:
        """DB system_settings에서 세션 타임아웃 조회. 실패 시 config 기본값 사용."""
        try:
            from app.db.session import SessionLocal
            db = SessionLocal()
            try:
                row = db.execute(
                    text("SELECT value FROM system_settings WHERE key = :k"),
                    {"k": "session_timeout_minutes"},
                ).fetchone()
                if row:
                    val = int(row[0])
                    if val > 0:
                        return val * 60
            finally:
                db.close()
        except Exception:
            pass
        return settings.SESSION_TIMEOUT_MINUTES * 60

    @property
    def client(self) -> redis.Redis:
        """Redis 클라이언트 (lazy initialization)"""
        if self._client is None:
            self._client = redis.from_url(
                self.redis_url,
                decode_responses=True,
            )
        return self._client

    def create_session(
        self,
        user_id: int,
        token: str,
        ip_address: str,
        user_agent: str = "",
    ) -> str:
        """
        새 세션 생성

        Args:
            user_id: 사용자 ID
            token: JWT 토큰 (일부)
            ip_address: 클라이언트 IP
            user_agent: 사용자 에이전트

        Returns:
            str: 세션 키
        """
        session_key = f"session:{user_id}:{token[:32]}"
        session_data = {
            "user_id": user_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat(),
        }

        self.client.setex(
            session_key,
            self._get_session_timeout_seconds(),
            json.dumps(session_data),
        )

        return session_key

    def get_session(self, session_key: str) -> Optional[Dict[str, Any]]:
        """
        세션 조회

        Args:
            session_key: 세션 키

        Returns:
            Optional[Dict]: 세션 데이터 또는 None
        """
        data = self.client.get(session_key)
        if data:
            return json.loads(data)
        return None

    def update_session_activity(self, session_key: str) -> bool:
        """
        세션 활동 시간 업데이트

        Args:
            session_key: 세션 키

        Returns:
            bool: 성공 여부
        """
        data = self.client.get(session_key)
        if not data:
            return False

        session_data = json.loads(data)
        session_data["last_activity"] = datetime.utcnow().isoformat()

        self.client.setex(
            session_key,
            self._get_session_timeout_seconds(),
            json.dumps(session_data),
        )

        return True

    def delete_session(self, session_key: str) -> bool:
        """
        세션 삭제 (로그아웃)

        Args:
            session_key: 세션 키

        Returns:
            bool: 성공 여부
        """
        return self.client.delete(session_key) > 0

    def delete_user_sessions(self, user_id: int) -> int:
        """
        사용자의 모든 세션 삭제 (강제 로그아웃)

        Args:
            user_id: 사용자 ID

        Returns:
            int: 삭제된 세션 수
        """
        pattern = f"session:{user_id}:*"
        keys = self.client.keys(pattern)
        if keys:
            return self.client.delete(*keys)
        return 0

    def get_user_sessions(self, user_id: int) -> list:
        """
        사용자의 활성 세션 목록 조회

        Args:
            user_id: 사용자 ID

        Returns:
            list: 세션 목록
        """
        pattern = f"session:{user_id}:*"
        keys = self.client.keys(pattern)
        sessions = []

        for key in keys:
            data = self.client.get(key)
            if data:
                session = json.loads(data)
                session["session_key"] = key
                sessions.append(session)

        return sessions

    def add_token_to_blacklist(self, token: str, expires_in: int) -> None:
        """
        토큰을 블랙리스트에 추가 (로그아웃 시)

        Args:
            token: JWT 토큰
            expires_in: 토큰 만료까지 남은 시간 (초)
        """
        blacklist_key = f"token_blacklist:{token[:32]}"
        self.client.setex(blacklist_key, expires_in, "1")

    def is_token_blacklisted(self, token: str) -> bool:
        """
        토큰 블랙리스트 확인

        Args:
            token: JWT 토큰

        Returns:
            bool: 블랙리스트 여부
        """
        blacklist_key = f"token_blacklist:{token[:32]}"
        return self.client.exists(blacklist_key) > 0


# 전역 세션 서비스 인스턴스
session_service = SessionService()
