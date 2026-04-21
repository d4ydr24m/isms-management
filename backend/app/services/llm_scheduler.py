"""
LLM 초안 생성 Celery 태스크.

API 레이어는 `generate_corrective_action_draft.delay(suggestion_id)` 로 호출하고,
프런트엔드는 반환된 task_id / suggestion_id 로 폴링한다.

긴 CPU 추론(수십~수백 초)이 FastAPI 워커를 잡지 않도록 이 태스크로 분리한다.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta
from typing import Iterable, List

from app.core.celery_app import celery_app
from app.core.deps import SessionLocal
from app.core.llm_prompts import (
    SYSTEM_PROMPT_CORRECTIVE_ACTION,
    build_user_prompt,
)
from app.models.audit import NonConformity
from app.models.control import ControlItem
from app.models.llm_suggestion import LLMSuggestion
from app.services.file_service import FileService
from app.services.llm_service import LLMService, LLMServiceError

logger = logging.getLogger(__name__)


_GENERIC_FAILURE_MSG = "초안 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."


def _parse_evidence_ids(raw: str | None) -> List[int]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except ValueError:
        return []
    if not isinstance(value, list):
        return []
    return [int(v) for v in value if isinstance(v, (int, str)) and str(v).isdigit()]


@celery_app.task(
    name="app.services.llm_scheduler.generate_corrective_action_draft",
    bind=True,
    max_retries=0,  # LLM 추론 실패는 재시도해도 동일 결과일 가능성이 높음
)
def generate_corrective_action_draft(self, suggestion_id: int) -> dict:
    """
    LLMSuggestion 레코드를 읽고 Ollama를 호출하여 초안 본문을 채운다.
    """
    import time

    db = SessionLocal()
    try:
        # 방어 계층: 라우터와 워커 사이에 작은 커밋 시차가 있어도 동작하도록,
        # 행을 읽을 수 없으면 짧게 재시도한다. 라우터는 이제 COMMIT 이후 dispatch 하므로
        # 정상 경로에서는 첫 SELECT 로 바로 찾아낸다.
        suggestion: LLMSuggestion | None = None
        for _ in range(5):
            suggestion = (
                db.query(LLMSuggestion)
                .filter(LLMSuggestion.id == suggestion_id)
                .first()
            )
            if suggestion is not None:
                break
            db.rollback()  # stale transaction snapshot 해제 후 재조회
            time.sleep(0.2)
        if suggestion is None:
            logger.warning("LLMSuggestion %s not found after retries", suggestion_id)
            return {"status": "missing", "suggestion_id": suggestion_id}

        suggestion.status = "running"
        db.commit()

        nc: NonConformity | None = (
            db.query(NonConformity)
            .filter(NonConformity.id == suggestion.non_conformity_id)
            .first()
        )
        if nc is None:
            _finalize_failure(db, suggestion, "연결된 부적합을 찾을 수 없습니다.")
            return {"status": "failed", "suggestion_id": suggestion_id}

        control: ControlItem | None = (
            db.query(ControlItem).filter(ControlItem.id == nc.control_item_id).first()
        )

        evidence_ids = _parse_evidence_ids(suggestion.evidence_ids)
        ordered = _load_images_by_role(db, suggestion.non_conformity_id, evidence_ids)

        user_prompt = build_user_prompt(
            nc_title=nc.title,
            nc_description=nc.description,
            nc_requirement=nc.requirement,
            nc_type=nc.nc_type,
            severity=nc.severity,
            control_code=getattr(control, "code", None) if control else None,
            control_name=getattr(control, "title", None) if control else None,
            before_count=len(ordered.before_bytes),
            after_count=len(ordered.after_bytes),
            support_count=len(ordered.support_bytes),
            reference_count=len(ordered.reference_bytes),
            skipped_non_image_count=ordered.skipped,
        )
        image_bytes = (
            ordered.before_bytes
            + ordered.after_bytes
            + ordered.support_bytes
            + ordered.reference_bytes
        )

        llm = LLMService()
        try:
            text = llm.generate_corrective_action(
                system_prompt=SYSTEM_PROMPT_CORRECTIVE_ACTION,
                user_prompt=user_prompt,
                images=image_bytes,
            )
        except LLMServiceError as exc:
            # exc.args[0] 은 이미 사용자용 한국어 메시지
            _finalize_failure(db, suggestion, str(exc))
            return {"status": "failed", "suggestion_id": suggestion_id}
        except Exception:  # 안전망 — 스택은 사용자에게 노출하지 않는다.
            logger.exception("Unexpected LLM error")
            _finalize_failure(db, suggestion, _GENERIC_FAILURE_MSG)
            return {"status": "failed", "suggestion_id": suggestion_id}

        suggestion.result_text = _sanitize_draft(text)
        suggestion.status = "succeeded"
        suggestion.completed_at = datetime.utcnow()
        db.commit()
        return {"status": "succeeded", "suggestion_id": suggestion_id}

    finally:
        db.close()


class _OrderedImages:
    """역할별로 분리된 이미지 바이트 + skipped 카운트를 담는 단순 값 객체."""

    __slots__ = (
        "before_bytes",
        "after_bytes",
        "support_bytes",
        "reference_bytes",
        "skipped",
    )

    def __init__(self) -> None:
        self.before_bytes: List[bytes] = []
        self.after_bytes: List[bytes] = []
        self.support_bytes: List[bytes] = []
        self.reference_bytes: List[bytes] = []
        self.skipped: int = 0


def _load_images_by_role(
    db, nc_id: int, evidence_ids: Iterable[int]
) -> _OrderedImages:
    """
    증적 ID 목록에서 이미지만 골라 역할별로 분리하여 바이트를 적재한다.

    - NC 에 연결된 매핑 기준으로 role 을 읽는다 (Evidence 자체에는 role 이 없다).
    - 이미지 MIME 이 아니거나 다운로드에 실패한 경우 skipped 카운트에 포함.
    - 같은 role 내 순서는 매핑 생성 시각(오래된 것 먼저)으로 안정 정렬.
    """
    from app.services.nc_evidence_service import NcEvidenceService

    out = _OrderedImages()
    evidence_ids = list(evidence_ids)
    if not evidence_ids:
        return out

    mappings = NcEvidenceService(db).list_mappings_by_ids(nc_id, evidence_ids)
    # 같은 role 내부는 created_at 오래된 것 먼저 (업로드 순).
    mappings.sort(key=lambda m: m.created_at)

    files = FileService()
    for m in mappings:
        ev = m.evidence
        if ev is None or not LLMService.is_image_mime(ev.mime_type):
            out.skipped += 1
            continue
        try:
            data = files.download_file(ev.file_path)
        except Exception:
            logger.warning("Failed to load evidence %s", ev.id, exc_info=True)
            out.skipped += 1
            continue

        role = (m.role or "reference").lower()
        if role == "before":
            out.before_bytes.append(data)
        elif role == "after":
            out.after_bytes.append(data)
        elif role == "support":
            out.support_bytes.append(data)
        else:
            out.reference_bytes.append(data)
    return out


def _finalize_failure(db, suggestion: LLMSuggestion, message: str) -> None:
    suggestion.status = "failed"
    suggestion.error_message = message
    suggestion.completed_at = datetime.utcnow()
    db.commit()


# ----------------------------------------------------------------------------
# 초안 후처리 (sanitizer)
# ----------------------------------------------------------------------------

# 프롬프트에서 마크다운 이미지/링크/코드펜스를 금지해도 모델이 종종 출력에 섞는다.
# 운영자 화면에 노출되기 전 최후의 방어선으로 제거한다.
_MD_IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")  # ![alt](url)
_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]*\)")   # [text](url) → text 보존
_CODE_FENCE_RE = re.compile(r"```[^\n]*\n?|\n?```")
# 최상단 제목(예: '# 비밀번호 … 내역서' + 이어지는 빈 줄) 제거 — 첫 실제 섹션인
# '# 1. …' 이 첫 줄이 되도록 한다.
_LEADING_TITLE_RE = re.compile(
    r"^\s*#\s+(?!\d\.\s).*?\n+",  # '# ' 로 시작하되 숫자 섹션 아님
    flags=re.MULTILINE,
)


def _sanitize_draft(text: str) -> str:
    """
    모델 출력에서 UI 에 부적절한 노이즈를 제거한다.

    안전한 보정만 한다 — 섹션 내용을 건드리지 않고, 형식·장식 요소만 정리.
    실패해도 원본을 돌려주도록 예외를 먹는다(매우 보수적).
    """
    if not text:
        return text
    try:
        cleaned = text
        cleaned = _MD_IMAGE_RE.sub("", cleaned)
        cleaned = _MD_LINK_RE.sub(lambda m: m.group(1), cleaned)
        cleaned = _CODE_FENCE_RE.sub("", cleaned)

        # 최상단에 불필요한 제목이 있을 때만 제거. '# 1. 결함 현상' 이 먼저 나오면 유지.
        first_nonblank = next(
            (line for line in cleaned.splitlines() if line.strip()), ""
        )
        if first_nonblank.startswith("# ") and not re.match(
            r"#\s+\d\.\s", first_nonblank
        ):
            cleaned = _LEADING_TITLE_RE.sub("", cleaned, count=1)

        # '##' 부제목을 '#' 로 정규화 (모델이 간혹 ## 1. … 로 씀)
        cleaned = re.sub(
            r"^##\s+(\d)\.\s",
            r"# \1. ",
            cleaned,
            flags=re.MULTILINE,
        )

        # 중복 빈 줄 축소
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()
    except Exception:
        logger.exception("draft sanitize failed — returning original text")
        return text


# ----------------------------------------------------------------------------
# 정기 청소 태스크 (nightly sweeper)
# ----------------------------------------------------------------------------

# 규칙 (사용자 합의):
#   - succeeded 는 절대 자동 삭제하지 않는다. 사용자가 직접 관리.
#   - failed: FAILED_TTL_DAYS 이전이면 삭제. 실패 컨텍스트는 짧은 기간만 유용.
#   - pending/running: STUCK_TTL_HOURS 이상 지속되면 'failed (timeout)' 로 전이.
#     워커 죽음/레이스/연결 끊김 등으로 남은 좀비 방지. 프런트는 상태 전이를
#     감지해 토스트를 띄우므로 사용자는 타임아웃 사실을 인지할 수 있다.

FAILED_TTL_DAYS = 7
STUCK_TTL_HOURS = 1
_STUCK_STATUSES = ("pending", "running")
_TIMEOUT_MESSAGE = (
    "초안 생성이 제한 시간(1시간)을 초과하여 자동 종료되었습니다. 다시 시도해 주세요."
)


@celery_app.task(
    name="app.services.llm_scheduler.cleanup_old_drafts",
    bind=True,
)
def cleanup_old_drafts(self) -> dict:
    """
    Celery beat 가 매일 04:00 KST 에 호출한다.

    반환값은 운영자가 로그/대시보드에서 확인할 수 있도록 카운트 위주로 구성.
    succeeded 는 sweep 대상이 아니라서 응답에도 등장하지 않는다.
    """
    now = datetime.utcnow()
    failed_cutoff = now - timedelta(days=FAILED_TTL_DAYS)
    stuck_cutoff = now - timedelta(hours=STUCK_TTL_HOURS)

    db = SessionLocal()
    try:
        # 1) 오래된 failed 하드 삭제
        deleted_failed = (
            db.query(LLMSuggestion)
            .filter(
                LLMSuggestion.status == "failed",
                LLMSuggestion.created_at < failed_cutoff,
            )
            .delete(synchronize_session=False)
        )

        # 2) 지속되는 좀비(pending/running) 를 failed 로 전이
        stuck_rows = (
            db.query(LLMSuggestion)
            .filter(
                LLMSuggestion.status.in_(_STUCK_STATUSES),
                LLMSuggestion.created_at < stuck_cutoff,
            )
            .all()
        )
        timed_out = 0
        for row in stuck_rows:
            row.status = "failed"
            row.error_message = _TIMEOUT_MESSAGE
            row.completed_at = now
            timed_out += 1

        db.commit()
        result = {
            "deleted_failed": deleted_failed,
            "timed_out": timed_out,
            "cutoff_failed_days": FAILED_TTL_DAYS,
            "cutoff_stuck_hours": STUCK_TTL_HOURS,
        }
        logger.info("LLM 초안 청소 완료: %s", result)
        return result
    except Exception:
        db.rollback()
        logger.exception("LLM 초안 청소 실패")
        raise
    finally:
        db.close()
