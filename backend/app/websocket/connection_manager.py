"""
WebSocket 연결 관리자 (7.3.1)
클라이언트 연결 관리 및 메시지 브로드캐스트
"""
import asyncio
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from fastapi import WebSocket

from app.schemas.notification import WebSocketNotification


class ConnectionManager:
    """
    WebSocket 연결 관리자

    사용자별 WebSocket 연결을 관리하고 실시간 알림을 브로드캐스트
    """

    def __init__(self):
        # 사용자 ID별 WebSocket 연결 목록
        self._active_connections: Dict[int, Set[WebSocket]] = {}
        # 연결-사용자 매핑 (연결 해제 시 사용)
        self._connection_to_user: Dict[WebSocket, int] = {}

    async def connect(self, websocket: WebSocket, user_id: int) -> None:
        """
        WebSocket 연결 수락 및 등록

        Args:
            websocket: WebSocket 연결
            user_id: 사용자 ID
        """
        await websocket.accept()

        if user_id not in self._active_connections:
            self._active_connections[user_id] = set()

        self._active_connections[user_id].add(websocket)
        self._connection_to_user[websocket] = user_id

    def disconnect(self, websocket: WebSocket) -> None:
        """
        WebSocket 연결 해제

        Args:
            websocket: WebSocket 연결
        """
        user_id = self._connection_to_user.get(websocket)
        if user_id is not None:
            if user_id in self._active_connections:
                self._active_connections[user_id].discard(websocket)
                # 연결이 없으면 사용자 항목 삭제
                if not self._active_connections[user_id]:
                    del self._active_connections[user_id]

            del self._connection_to_user[websocket]

    def is_connected(self, user_id: int) -> bool:
        """
        사용자가 연결되어 있는지 확인

        Args:
            user_id: 사용자 ID

        Returns:
            연결 여부
        """
        return (
            user_id in self._active_connections
            and len(self._active_connections[user_id]) > 0
        )

    def get_connection_count(self, user_id: int) -> int:
        """
        사용자의 활성 연결 수 반환

        Args:
            user_id: 사용자 ID

        Returns:
            연결 수
        """
        if user_id not in self._active_connections:
            return 0
        return len(self._active_connections[user_id])

    def get_total_connections(self) -> int:
        """
        전체 활성 연결 수 반환

        Returns:
            전체 연결 수
        """
        return sum(len(conns) for conns in self._active_connections.values())

    async def send_personal_message(
        self,
        message: Dict[str, Any],
        user_id: int,
    ) -> int:
        """
        특정 사용자에게 메시지 전송

        Args:
            message: 전송할 메시지
            user_id: 대상 사용자 ID

        Returns:
            전송된 연결 수
        """
        if user_id not in self._active_connections:
            return 0

        sent_count = 0
        dead_connections = []

        for connection in self._active_connections[user_id]:
            try:
                await connection.send_json(message)
                sent_count += 1
            except Exception:
                dead_connections.append(connection)

        # 죽은 연결 정리
        for connection in dead_connections:
            self.disconnect(connection)

        return sent_count

    async def broadcast(
        self,
        message: Dict[str, Any],
        exclude_user_ids: Optional[List[int]] = None,
    ) -> int:
        """
        모든 연결된 사용자에게 메시지 브로드캐스트

        Args:
            message: 전송할 메시지
            exclude_user_ids: 제외할 사용자 ID 목록

        Returns:
            전송된 총 연결 수
        """
        exclude_user_ids = exclude_user_ids or []
        total_sent = 0

        for user_id in list(self._active_connections.keys()):
            if user_id not in exclude_user_ids:
                sent = await self.send_personal_message(message, user_id)
                total_sent += sent

        return total_sent

    async def send_notification(
        self,
        user_id: int,
        notification_data: Dict[str, Any],
    ) -> bool:
        """
        사용자에게 알림 전송

        Args:
            user_id: 대상 사용자 ID
            notification_data: 알림 데이터

        Returns:
            전송 성공 여부
        """
        message = {
            "type": "notification",
            "data": notification_data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        sent = await self.send_personal_message(message, user_id)
        return sent > 0

    async def send_notification_to_many(
        self,
        user_ids: List[int],
        notification_data: Dict[str, Any],
    ) -> Dict[int, bool]:
        """
        여러 사용자에게 알림 전송

        Args:
            user_ids: 대상 사용자 ID 목록
            notification_data: 알림 데이터

        Returns:
            각 사용자별 전송 결과
        """
        results = {}
        for user_id in user_ids:
            result = await self.send_notification(user_id, notification_data)
            results[user_id] = result

        return results


# 싱글톤 인스턴스
manager = ConnectionManager()
