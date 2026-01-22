"""
Redis Pub/Sub 연동 (7.3.3)
다중 서버 환경에서 실시간 알림을 위한 Redis Pub/Sub
"""
import asyncio
import json
from typing import Any, Callable, Dict, Optional

import redis.asyncio as aioredis

from app.core.config import get_settings
from app.websocket.connection_manager import manager


settings = get_settings()

# Redis 채널 이름
NOTIFICATION_CHANNEL = "isms:notifications"


class RedisPubSub:
    """
    Redis Pub/Sub 관리자

    다중 서버 환경에서 WebSocket 알림을 동기화하기 위한 Redis Pub/Sub 구현
    """

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._redis: Optional[aioredis.Redis] = None
        self._pubsub: Optional[aioredis.client.PubSub] = None
        self._listener_task: Optional[asyncio.Task] = None
        self._running = False

    async def connect(self) -> None:
        """Redis 연결"""
        self._redis = aioredis.from_url(
            self.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        self._pubsub = self._redis.pubsub()

    async def disconnect(self) -> None:
        """Redis 연결 해제"""
        self._running = False
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass

        if self._pubsub:
            await self._pubsub.unsubscribe(NOTIFICATION_CHANNEL)
            await self._pubsub.close()

        if self._redis:
            await self._redis.close()

    async def subscribe(self) -> None:
        """
        알림 채널 구독 시작

        백그라운드 태스크로 메시지 수신 시작
        """
        if not self._pubsub:
            await self.connect()

        await self._pubsub.subscribe(NOTIFICATION_CHANNEL)
        self._running = True
        self._listener_task = asyncio.create_task(self._listen())

    async def _listen(self) -> None:
        """
        메시지 수신 루프

        Redis 채널에서 메시지를 수신하고 WebSocket으로 전달
        """
        while self._running:
            try:
                message = await self._pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )
                if message:
                    await self._handle_message(message)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Redis listener error: {e}")
                await asyncio.sleep(1)

    async def _handle_message(self, message: Dict[str, Any]) -> None:
        """
        수신된 메시지 처리

        Args:
            message: Redis 메시지
        """
        if message["type"] != "message":
            return

        try:
            data = json.loads(message["data"])
            message_type = data.get("type")

            if message_type == "notification":
                # 특정 사용자에게 알림 전송
                user_id = data.get("user_id")
                notification_data = data.get("notification")
                if user_id and notification_data:
                    await manager.send_notification(user_id, notification_data)

            elif message_type == "broadcast":
                # 모든 사용자에게 브로드캐스트
                notification_data = data.get("notification")
                exclude_users = data.get("exclude_users", [])
                if notification_data:
                    await manager.broadcast(
                        {"type": "notification", "data": notification_data},
                        exclude_user_ids=exclude_users,
                    )

        except json.JSONDecodeError:
            print("Invalid JSON in Redis message")
        except Exception as e:
            print(f"Error handling Redis message: {e}")

    async def publish_notification(
        self,
        user_id: int,
        notification_data: Dict[str, Any],
    ) -> bool:
        """
        특정 사용자에게 알림 발행

        Args:
            user_id: 대상 사용자 ID
            notification_data: 알림 데이터

        Returns:
            발행 성공 여부
        """
        if not self._redis:
            return False

        try:
            message = json.dumps({
                "type": "notification",
                "user_id": user_id,
                "notification": notification_data,
            })
            await self._redis.publish(NOTIFICATION_CHANNEL, message)
            return True
        except Exception as e:
            print(f"Error publishing notification: {e}")
            return False

    async def publish_broadcast(
        self,
        notification_data: Dict[str, Any],
        exclude_users: Optional[list] = None,
    ) -> bool:
        """
        모든 사용자에게 알림 브로드캐스트

        Args:
            notification_data: 알림 데이터
            exclude_users: 제외할 사용자 ID 목록

        Returns:
            발행 성공 여부
        """
        if not self._redis:
            return False

        try:
            message = json.dumps({
                "type": "broadcast",
                "notification": notification_data,
                "exclude_users": exclude_users or [],
            })
            await self._redis.publish(NOTIFICATION_CHANNEL, message)
            return True
        except Exception as e:
            print(f"Error publishing broadcast: {e}")
            return False


# 싱글톤 인스턴스 (지연 초기화)
_pubsub_instance: Optional[RedisPubSub] = None


async def get_pubsub() -> RedisPubSub:
    """
    Redis Pub/Sub 인스턴스 반환

    Returns:
        RedisPubSub 인스턴스
    """
    global _pubsub_instance
    if _pubsub_instance is None:
        _pubsub_instance = RedisPubSub(settings.REDIS_URL)
        await _pubsub_instance.connect()
        await _pubsub_instance.subscribe()
    return _pubsub_instance


async def send_notification_via_pubsub(
    user_id: int,
    notification_id: int,
    notification_type: str,
    title: str,
    message: str,
    priority: str,
    link_url: Optional[str] = None,
) -> bool:
    """
    Redis Pub/Sub를 통해 알림 전송

    다중 서버 환경에서 모든 서버의 WebSocket 클라이언트에게 알림 전달

    Args:
        user_id: 대상 사용자 ID
        notification_id: 알림 ID
        notification_type: 알림 유형
        title: 알림 제목
        message: 알림 메시지
        priority: 우선순위
        link_url: 관련 URL

    Returns:
        전송 성공 여부
    """
    from datetime import datetime

    try:
        pubsub = await get_pubsub()
        notification_data = {
            "notification_id": notification_id,
            "notification_type": notification_type,
            "title": title,
            "message": message,
            "priority": priority,
            "link_url": link_url,
            "created_at": datetime.utcnow().isoformat(),
        }
        return await pubsub.publish_notification(user_id, notification_data)
    except Exception as e:
        print(f"Error sending notification via pubsub: {e}")
        return False
