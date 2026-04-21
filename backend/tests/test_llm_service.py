"""
LLMService 단위 테스트.

httpx는 실제 네트워크 호출 대신 monkeypatch 로 가짜 응답을 주입한다.
Ollama가 이 환경에서 돌고 있지 않아도 돌아가야 하는 테스트다.
"""
from __future__ import annotations

import io
import json
from typing import Any

import httpx
import pytest
from PIL import Image

from app.services.llm_service import (
    LLMService,
    LLMServiceError,
    _PATCH_SIZE,
)


def _fake_png(width: int, height: int, color=(255, 0, 0)) -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class _FakeResponse:
    def __init__(self, status_code: int, body: Any):
        self.status_code = status_code
        self._body = body
        self.text = json.dumps(body) if isinstance(body, (dict, list)) else str(body)

    def json(self):
        if isinstance(self._body, (dict, list)):
            return self._body
        raise ValueError("not json")


class _FakeClient:
    """
    httpx.Client 스텁: context manager + post만 지원.
    테스트 케이스가 side_effect 함수로 행동을 지정한다.
    """

    def __init__(self, handler):
        self._handler = handler
        self.last_payload = None
        self.last_url = None

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False

    def post(self, url, json=None, **_kwargs):  # noqa: A002 - shadowing builtin on purpose
        self.last_url = url
        self.last_payload = json
        return self._handler(url, json)


@pytest.fixture
def patch_httpx(monkeypatch):
    """httpx.Client 을 교체하는 팩토리. 케이스별로 handler를 주입한다."""

    def install(handler):
        # 현재 클라이언트 캡처를 위한 홀더
        holder = {"client": None}

        def _factory(*_args, **_kwargs):
            client = _FakeClient(handler)
            holder["client"] = client
            return client

        monkeypatch.setattr(httpx, "Client", _factory)
        return holder

    return install


class TestImagePreprocessing:
    def test_prepare_image_downscales_large_input(self):
        svc = LLMService(image_max_dim=672)
        raw = _fake_png(1920, 1080)
        b64 = svc._prepare_image(raw)  # type: ignore[attr-defined]
        # base64 결과를 다시 디코드해 크기 확인
        import base64

        out_bytes = base64.b64decode(b64)
        out_img = Image.open(io.BytesIO(out_bytes))
        w, h = out_img.size
        assert max(w, h) <= 672
        # 결과 치수는 패치(28px) 배수여야 한다.
        assert w % _PATCH_SIZE == 0
        assert h % _PATCH_SIZE == 0

    def test_prepare_image_keeps_small_input_but_aligns_to_patch(self):
        svc = LLMService(image_max_dim=672)
        # 패치 경계에 맞지 않는 작은 입력
        raw = _fake_png(100, 100)
        b64 = svc._prepare_image(raw)  # type: ignore[attr-defined]
        import base64

        out_img = Image.open(io.BytesIO(base64.b64decode(b64)))
        w, h = out_img.size
        assert w % _PATCH_SIZE == 0
        assert h % _PATCH_SIZE == 0
        # 100px가 28의 배수(84)로 내림 정렬됨
        assert w == 84
        assert h == 84


class TestGenerateCorrectiveAction:
    SYS = "system"
    USER = "user"

    def test_happy_path_returns_trimmed_content(self, patch_httpx):
        holder = patch_httpx(
            lambda url, body: _FakeResponse(
                200, {"message": {"content": "  생성된 초안  \n"}}
            )
        )
        svc = LLMService(
            base_url="http://ollama.test:11434",
            model="qwen2.5vl:3b",
            timeout_seconds=5,
        )
        result = svc.generate_corrective_action(
            system_prompt=self.SYS, user_prompt=self.USER, images=()
        )
        assert result == "생성된 초안"
        client = holder["client"]
        assert client.last_url == "http://ollama.test:11434/api/chat"
        assert client.last_payload["model"] == "qwen2.5vl:3b"
        assert client.last_payload["stream"] is False
        # thinking 모델의 reasoning 체인을 꺼서 타임아웃 위험을 피한다.
        assert client.last_payload["think"] is False
        # 출력 길이 안전 상한이 설정되어야 한다.
        assert client.last_payload["options"]["num_predict"] == 800
        # 시스템/유저 메시지가 정확히 전달되어야 한다.
        messages = client.last_payload["messages"]
        assert messages[0] == {"role": "system", "content": self.SYS}
        assert messages[1]["role"] == "user"
        assert messages[1]["content"] == self.USER
        assert messages[1]["images"] == []

    def test_includes_base64_images_in_payload(self, patch_httpx):
        holder = patch_httpx(
            lambda url, body: _FakeResponse(200, {"message": {"content": "ok"}})
        )
        svc = LLMService(image_max_dim=168)  # 6 * 28
        svc.generate_corrective_action(
            system_prompt=self.SYS,
            user_prompt=self.USER,
            images=[_fake_png(200, 200), _fake_png(200, 200)],
        )
        payload = holder["client"].last_payload
        imgs = payload["messages"][1]["images"]
        assert len(imgs) == 2
        assert all(isinstance(x, str) and len(x) > 0 for x in imgs)

    def test_non_200_response_raises_user_safe_error(self, patch_httpx):
        patch_httpx(lambda url, body: _FakeResponse(500, {"error": "boom"}))
        svc = LLMService()
        with pytest.raises(LLMServiceError) as exc_info:
            svc.generate_corrective_action(
                system_prompt=self.SYS, user_prompt=self.USER
            )
        msg = str(exc_info.value)
        assert "HTTP 500" in msg
        # 사용자용 메시지는 한국어여야 하고 스택/내부 본문은 포함되지 않는다.
        assert "boom" not in msg

    def test_timeout_raises_user_safe_error(self, monkeypatch):
        class _Timeout:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def post(self, *a, **k):
                raise httpx.TimeoutException("timeout")

        monkeypatch.setattr(httpx, "Client", lambda *a, **k: _Timeout())
        svc = LLMService()
        with pytest.raises(LLMServiceError) as exc_info:
            svc.generate_corrective_action(
                system_prompt=self.SYS, user_prompt=self.USER
            )
        assert "제한 시간" in str(exc_info.value)

    def test_connection_error_raises_user_safe_error(self, monkeypatch):
        class _Broken:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def post(self, *a, **k):
                raise httpx.ConnectError("no route")

        monkeypatch.setattr(httpx, "Client", lambda *a, **k: _Broken())
        svc = LLMService()
        with pytest.raises(LLMServiceError) as exc_info:
            svc.generate_corrective_action(
                system_prompt=self.SYS, user_prompt=self.USER
            )
        assert "연결" in str(exc_info.value)
        assert "no route" not in str(exc_info.value)

    def test_empty_content_raises(self, patch_httpx):
        patch_httpx(
            lambda url, body: _FakeResponse(200, {"message": {"content": "   "}})
        )
        svc = LLMService()
        with pytest.raises(LLMServiceError):
            svc.generate_corrective_action(
                system_prompt=self.SYS, user_prompt=self.USER
            )

    def test_invalid_json_raises(self, patch_httpx):
        patch_httpx(lambda url, body: _FakeResponse(200, "not-json"))
        svc = LLMService()
        with pytest.raises(LLMServiceError):
            svc.generate_corrective_action(
                system_prompt=self.SYS, user_prompt=self.USER
            )

    def test_disabled_flag_raises_immediately(self, monkeypatch, patch_httpx):
        from app.core import config as config_module

        monkeypatch.setattr(config_module.settings, "LLM_ENABLED", False)
        patch_httpx(
            lambda url, body: _FakeResponse(200, {"message": {"content": "x"}})
        )
        svc = LLMService()
        with pytest.raises(LLMServiceError):
            svc.generate_corrective_action(
                system_prompt=self.SYS, user_prompt=self.USER
            )


class TestIsImageMime:
    def test_recognizes_supported_types(self):
        for mt in ("image/png", "image/jpeg", "image/JPG", "image/webp"):
            assert LLMService.is_image_mime(mt) is True

    def test_rejects_other_types(self):
        for mt in (
            None,
            "",
            "application/pdf",
            "image/gif",  # 현재 프롬프트 흐름에서는 지원 대상이 아님
            "text/plain",
        ):
            assert LLMService.is_image_mime(mt) is False
