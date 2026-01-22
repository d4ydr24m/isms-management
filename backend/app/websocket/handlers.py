"""
WebSocket 핸들러 (7.3.2)
WebSocket 엔드포인트 및 메시지 처리
"""
import json
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.core.security import decode_token
from app.models.user import User
from app.websocket.connection_manager import manager


async def get_current_user_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: Session = None,
) -> Optional[User]:
    """
    WebSocket 연결에서 현재 사용자 인증

    Args:
        websocket: WebSocket 연결
        token: 인증 토큰 (쿼리 파라미터)
        db: 데이터베이스 세션

    Returns:
        인증된 사용자 또는 None
    """
    if not token:
        return None

    payload = decode_token(token)
    if payload is None:
        return None

    if payload.get("type") != "access":
        return None

    user_id = payload.get("user_id")
    if user_id is None:
        return None

    if db is None:
        return None

    user = db.query(User).filter(User.id == user_id).first()
    return user


async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket 엔드포인트

    클라이언트가 연결하면 인증 후 알림을 실시간으로 수신할 수 있음

    Connection URL: ws://server/ws/notifications?token={access_token}
    """
    from app.db.session import SessionLocal

    db = SessionLocal()

    try:
        # 사용자 인증
        user = await get_current_user_ws(websocket, token, db)
        if user is None:
            await websocket.close(code=4001, reason="Unauthorized")
            return

        # 연결 수락 및 등록
        await manager.connect(websocket, user.id)

        # 연결 성공 메시지
        await websocket.send_json({
            "type": "connected",
            "data": {
                "user_id": user.id,
                "message": "WebSocket 연결이 성공했습니다.",
            },
        })

        try:
            while True:
                # 클라이언트로부터 메시지 수신
                data = await websocket.receive_text()

                try:
                    message = json.loads(data)
                    await handle_client_message(websocket, user, message)
                except json.JSONDecodeError:
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "잘못된 JSON 형식입니다."},
                    })

        except WebSocketDisconnect:
            manager.disconnect(websocket)

    finally:
        db.close()


async def handle_client_message(
    websocket: WebSocket,
    user: User,
    message: dict,
):
    """
    클라이언트 메시지 처리

    Args:
        websocket: WebSocket 연결
        user: 현재 사용자
        message: 수신된 메시지
    """
    message_type = message.get("type")

    if message_type == "ping":
        # 핑-퐁
        await websocket.send_json({"type": "pong"})

    elif message_type == "mark_read":
        # 알림 읽음 처리
        notification_id = message.get("notification_id")
        if notification_id:
            from app.db.session import SessionLocal
            from app.services.notification_service import NotificationService

            db = SessionLocal()
            try:
                service = NotificationService(db)
                result = service.mark_as_read(notification_id, user.id)
                await websocket.send_json({
                    "type": "mark_read_result",
                    "data": {
                        "notification_id": notification_id,
                        "success": result,
                    },
                })
            finally:
                db.close()

    elif message_type == "get_unread_count":
        # 읽지 않은 알림 개수 조회
        from app.db.session import SessionLocal
        from app.services.notification_service import NotificationService

        db = SessionLocal()
        try:
            service = NotificationService(db)
            count = service.get_unread_count(user.id)
            await websocket.send_json({
                "type": "unread_count",
                "data": {"count": count},
            })
        finally:
            db.close()

    else:
        # 알 수 없는 메시지 타입
        await websocket.send_json({
            "type": "error",
            "data": {"message": f"알 수 없는 메시지 타입: {message_type}"},
        })


async def send_realtime_notification(
    user_id: int,
    notification_id: int,
    notification_type: str,
    title: str,
    message: str,
    priority: str,
    link_url: Optional[str] = None,
):
    """
    실시간 알림 전송 헬퍼 함수

    알림 생성 후 호출하여 연결된 클라이언트에게 즉시 전송

    Args:
        user_id: 대상 사용자 ID
        notification_id: 알림 ID
        notification_type: 알림 유형
        title: 알림 제목
        message: 알림 메시지
        priority: 우선순위
        link_url: 관련 URL
    """
    from datetime import datetime

    notification_data = {
        "notification_id": notification_id,
        "notification_type": notification_type,
        "title": title,
        "message": message,
        "priority": priority,
        "link_url": link_url,
        "created_at": datetime.utcnow().isoformat(),
    }

    await manager.send_notification(user_id, notification_data)
