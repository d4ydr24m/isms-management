"""
로컬 LLM(Ollama) 호출 서비스.

- 내부 docker 네트워크의 Ollama 컨테이너에 HTTP로 질의한다.
- 외부로 나가는 호출은 전혀 없다. (프라이버시 요구사항)
- 이미지는 모델 패치 크기에 맞춰 다운스케일(기본 672px) 후 base64로 전송한다.
"""
from __future__ import annotations

import base64
import io
import logging
from typing import Iterable, Sequence

import httpx
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

# Qwen2.5-VL의 비전 패치 크기. 입력 이미지의 각 변은 이 값의 배수여야 한다.
# 그렇지 않으면 ollama/llama.cpp 런타임에서 GGML_ASSERT로 실패한다.
_PATCH_SIZE = 28

# 이미지로 간주할 MIME 타입. 그 외 증적은 모델에 전달하지 않는다.
_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


class LLMServiceError(Exception):
    """LLM 서비스 호출 실패. 사용자에게 노출해도 되는 한국어 메시지를 담는다."""


class LLMService:
    """
    Ollama `/api/chat` 엔드포인트를 호출하는 얇은 클라이언트.

    ### 사용
    ```
    svc = LLMService()
    text = svc.generate_corrective_action(
        system_prompt=SYSTEM_PROMPT_CORRECTIVE_ACTION,
        user_prompt=build_user_prompt(...),
        images=[png_bytes_1, png_bytes_2],
    )
    ```
    """

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout_seconds: int | None = None,
        image_max_dim: int | None = None,
    ) -> None:
        self.base_url = (base_url or settings.LLM_BASE_URL).rstrip("/")
        self.model = model or settings.LLM_MODEL
        self.timeout_seconds = timeout_seconds or settings.LLM_TIMEOUT_SECONDS
        self.image_max_dim = image_max_dim or settings.LLM_IMAGE_MAX_DIM

    # ---- 이미지 전처리 --------------------------------------------------

    @staticmethod
    def is_image_mime(mime_type: str | None) -> bool:
        return bool(mime_type) and mime_type.lower() in _IMAGE_MIME_TYPES

    def _prepare_image(self, raw: bytes) -> str:
        """바이트 → 다운스케일 + 패치 정렬 → base64 문자열."""
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        w, h = img.size
        scale = min(1.0, self.image_max_dim / max(w, h))
        new_w = max(_PATCH_SIZE, (int(w * scale) // _PATCH_SIZE) * _PATCH_SIZE)
        new_h = max(_PATCH_SIZE, (int(h * scale) // _PATCH_SIZE) * _PATCH_SIZE)
        if (new_w, new_h) != (w, h):
            img = img.resize((new_w, new_h), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return base64.b64encode(buf.getvalue()).decode("ascii")

    # ---- 메인 호출 ------------------------------------------------------

    def generate_corrective_action(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        images: Sequence[bytes] = (),
    ) -> str:
        """
        Ollama /api/chat 호출. 성공 시 생성 텍스트 반환, 실패 시 LLMServiceError.

        Raises:
            LLMServiceError: 네트워크/타임아웃/비-200 응답/잘못된 JSON/빈 응답 등.
        """
        if not settings.LLM_ENABLED:
            raise LLMServiceError("LLM 기능이 비활성화되어 있습니다.")

        try:
            image_b64 = [self._prepare_image(b) for b in images]
        except Exception:  # Pillow 예외 전부 포괄
            logger.exception("Image preprocessing failed")
            raise LLMServiceError("첨부 이미지를 처리하는 중 오류가 발생했습니다.")

        # think=False: qwen3.5 등 'thinking' 모델의 기본 reasoning 체인을 끈다.
        #   이 체인은 4분~10분에 걸쳐 무한정 reasoning 을 뱉을 수 있어 보완조치내역서
        #   같이 템플릿 채우기 과제에는 오히려 해로웠다 (timeout 유발). 출력 품질
        #   하락은 미미하고, 일관된 지연 시간을 얻는 이득이 크다.
        #   thinking 을 지원하지 않는 모델에 대해 think 옵션은 무시되므로 안전.
        # num_predict=1400: 출력 길이 상한. 이전 800 은 여러 이슈가 섞인 NC 에서 한국어
        #   특성상 토큰 소모가 크고 섹션 4 (재발 방지 대책) 이전에 끊기는 사례가 관측됨
        #   (NC #11). 섹션 4 까지 무리 없이 담길 여유 + 런어웨이 방지용 상한 역할을
        #   동시에 만족하도록 1400 으로 상향.
        # num_ctx=6144: 프롬프트(system ~1.4K + user ~0.4K + 이미지 3장 × 500~800) 합쳐
        #   3K 토큰 내외를 먹고, 그 위에 num_predict 상한 만큼의 여유가 필요하다.
        #   이전 4096 에서는 prompt_eval 이 먼저 컨텍스트를 먹어 생성 여유가 800 수준까지
        #   깎였다. 6144 로 올리되 8192 보다는 낮게 유지해 작은 모델이 after 이미지를
        #   과도하게 기억해 #1 에 이식하는 역효과 (NC #7 재현)는 여전히 차단한다.
        payload = {
            "model": self.model,
            "stream": False,
            "think": False,
            "options": {
                # 템플릿 채우기 과제이므로 낮은 온도로 형식 일관성을 높인다.
                "temperature": 0.1,
                "num_ctx": 6144,
                "num_predict": 1400,
            },
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt, "images": image_b64},
            ],
        }

        url = f"{self.base_url}/api/chat"
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(url, json=payload)
        except httpx.TimeoutException:
            logger.warning("LLM request timed out after %ss", self.timeout_seconds)
            raise LLMServiceError(
                "LLM 응답이 제한 시간을 초과했습니다. 잠시 후 다시 시도해 주세요."
            )
        except httpx.HTTPError as exc:
            # 연결 실패/DNS/프로토콜 오류 등. 스택을 사용자에게 내보내지 않음.
            logger.warning("LLM transport error: %s", exc.__class__.__name__)
            raise LLMServiceError("LLM 서비스에 연결할 수 없습니다.")

        if response.status_code != 200:
            # 본문은 디버그에만 기록하고 사용자용 메시지는 일반화한다.
            logger.warning(
                "LLM returned HTTP %s: %s",
                response.status_code,
                response.text[:500],
            )
            raise LLMServiceError(
                f"LLM 서비스가 오류를 반환했습니다 (HTTP {response.status_code})."
            )

        try:
            data = response.json()
            content = (data.get("message") or {}).get("content") or ""
        except ValueError:
            logger.warning("LLM returned invalid JSON")
            raise LLMServiceError("LLM 응답을 해석할 수 없습니다.")

        content = content.strip()
        if not content:
            raise LLMServiceError("LLM이 빈 응답을 반환했습니다.")

        return content
