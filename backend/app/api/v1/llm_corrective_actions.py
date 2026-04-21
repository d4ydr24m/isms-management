"""
LLM 기반 보완조치내역서 초안 생성 API.

- POST   /llm/corrective-actions/generate                  초안 생성 요청 (Celery 큐잉)
- GET    /llm/corrective-actions/mine                      내 활성/최근 초안 목록 (배지 전용)
- GET    /llm/corrective-actions/by-nonconformity/{nc_id}  특정 부적합의 생성 이력
- GET    /llm/corrective-actions/{task_id}                 task_id 로 상태 폴링 (동적)
- DELETE /llm/corrective-actions/{suggestion_id}           초안 하드 삭제 (소유자 또는 관리자)

주의: 동적 경로 `{task_id}` 와 정적 경로(`mine`, `by-nonconformity/…`)가 같은 prefix 를
공유하므로 FastAPI 등록 순서대로 매칭된다. 정적 경로를 동적 경로보다 먼저 선언해야
`/mine` 호출이 `{task_id}='mine'` 으로 잘못 빠지지 않는다.
"""
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.deps import get_db, require_permission
from app.models.audit import NonConformity
from app.models.evidence import Evidence
from app.models.llm_suggestion import LLMSuggestion
from app.models.user import User
from app.schemas.llm import (
    LLMGenerateRequest,
    LLMGenerateResponse,
    LLMMyDraftRow,
    LLMMyDraftsResponse,
    LLMSuggestionList,
    LLMSuggestionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/llm/corrective-actions", tags=["LLM 보조"])


_ACTIVE_STATUSES = ("pending", "running")


def _to_response(row: LLMSuggestion) -> LLMSuggestionResponse:
    try:
        evidence_ids = (
            [int(v) for v in json.loads(row.evidence_ids)] if row.evidence_ids else []
        )
    except (ValueError, TypeError):
        evidence_ids = []

    return LLMSuggestionResponse(
        id=row.id,
        non_conformity_id=row.non_conformity_id,
        task_id=row.task_id,
        status=row.status,
        model_name=row.model_name,
        result_text=row.result_text,
        error_message=row.error_message,
        evidence_ids=evidence_ids,
        created_by=row.created_by,
        created_at=row.created_at,
        completed_at=row.completed_at,
    )


@router.post(
    "/generate",
    response_model=LLMGenerateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def generate_corrective_action_draft(
    payload: LLMGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:update")),
):
    """
    부적합 + 첨부 증적(스크린샷)을 입력으로 받아 LLM 초안 생성 태스크를 큐잉한다.

    응답은 즉시 돌아오고(202), 실제 생성은 Celery worker에서 수행된다.
    프런트엔드는 반환된 task_id/suggestion_id로 상태를 폴링한다.
    """
    if not settings.LLM_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM 기능이 비활성화되어 있습니다.",
        )

    nc = db.query(NonConformity).filter(NonConformity.id == payload.non_conformity_id).first()
    if nc is None:
        raise HTTPException(status_code=404, detail="부적합을 찾을 수 없습니다.")

    # 첨부 증적 검증: 존재 여부 + 이미지 수 상한
    evidence_ids: List[int] = list(dict.fromkeys(payload.evidence_ids))  # dedupe, preserve order
    if len(evidence_ids) > settings.LLM_MAX_IMAGES_PER_REQUEST:
        raise HTTPException(
            status_code=400,
            detail=(
                f"한 번에 최대 {settings.LLM_MAX_IMAGES_PER_REQUEST}장의 증적까지 전달할 수 있습니다."
            ),
        )
    if evidence_ids:
        # 이 NC 에 연결된 증적만 허용한다. 그렇지 않으면 부적합과 무관한 증적을
        # 흘려보낼 수 있고 감사 추적도 깨진다.
        from app.models.nc_evidence import NonConformityEvidence

        linked_ids = {
            eid
            for (eid,) in db.query(NonConformityEvidence.evidence_id)
            .filter(
                NonConformityEvidence.non_conformity_id == nc.id,
                NonConformityEvidence.evidence_id.in_(evidence_ids),
            )
            .all()
        }
        not_linked = [eid for eid in evidence_ids if eid not in linked_ids]
        if not_linked:
            raise HTTPException(
                status_code=400,
                detail=(
                    "부적합에 연결되지 않은 증적을 사용할 수 없습니다. "
                    f"연결되지 않은 ID: {not_linked}"
                ),
            )

    # 사용자당 동시 대기 초안 상한
    active_count = (
        db.query(LLMSuggestion)
        .filter(
            LLMSuggestion.created_by == current_user.id,
            LLMSuggestion.status.in_(_ACTIVE_STATUSES),
        )
        .count()
    )
    if active_count >= settings.LLM_MAX_PENDING_PER_USER:
        raise HTTPException(
            status_code=429,
            detail=(
                f"진행 중인 초안 생성이 이미 {active_count}건 있습니다. "
                "완료 후 다시 시도해 주세요."
            ),
        )

    # 트랜잭션 가시성 문제 방지: 반드시 (1) 행을 COMMIT 한 뒤 → (2) Celery 에 dispatch →
    # (3) task_id 를 두 번째 COMMIT 으로 채워넣는다.
    # 과거에는 flush() 만 한 상태에서 dispatch 했다가, 같은 트랜잭션이 커밋되기 전에
    # 워커가 다른 세션으로 SELECT 해서 행을 못 찾고 'missing' 상태로 조기 종료하는
    # 레이스가 있었다. 워커 입장에서는 행이 존재해야만 status 를 'running'→'succeeded'
    # 로 전진시킬 수 있다.
    from app.services.llm_scheduler import generate_corrective_action_draft as task_fn

    suggestion = LLMSuggestion(
        non_conformity_id=nc.id,
        task_id="",  # 임시값; dispatch 후 실제 task_id 로 교체
        status="pending",
        model_name=settings.LLM_MODEL,
        evidence_ids=json.dumps(evidence_ids) if evidence_ids else None,
        created_by=current_user.id,
    )
    db.add(suggestion)
    db.commit()          # 1차 커밋: 워커가 이 행을 반드시 읽을 수 있게 한다.
    db.refresh(suggestion)

    async_result = task_fn.delay(suggestion.id)
    suggestion.task_id = async_result.id
    db.commit()          # 2차 커밋: 프런트에 넘겨줄 task_id 고정.
    db.refresh(suggestion)

    return LLMGenerateResponse(
        task_id=suggestion.task_id,
        suggestion_id=suggestion.id,
        status=suggestion.status,
    )


@router.get("/mine", response_model=LLMMyDraftsResponse)
def list_my_recent_drafts(
    limit: int = Query(
        10, ge=1, le=50, description="반환할 최근 초안 수 (활성 + 완료 포함)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    내 계정으로 생성한 LLM 초안의 활성/최근 이력.

    전역 '초안 생성 중' 배지 전용 엔드포인트. 응답에는 본문(result_text) 이 포함되지 않아
    가볍고, 배지 클릭 시 사용자는 각 NC 상세 페이지로 이동해 전체 내용을 본다.
    """
    active_count = (
        db.query(LLMSuggestion)
        .filter(
            LLMSuggestion.created_by == current_user.id,
            LLMSuggestion.status.in_(_ACTIVE_STATUSES),
        )
        .count()
    )

    rows = (
        db.query(LLMSuggestion)
        .options(joinedload(LLMSuggestion.non_conformity))
        .filter(LLMSuggestion.created_by == current_user.id)
        .order_by(LLMSuggestion.created_at.desc())
        .limit(limit)
        .all()
    )

    items: List[LLMMyDraftRow] = []
    for r in rows:
        nc: Optional[NonConformity] = r.non_conformity  # noqa: F841 - lazy loader hint
        items.append(
            LLMMyDraftRow(
                id=r.id,
                non_conformity_id=r.non_conformity_id,
                non_conformity_title=(
                    r.non_conformity.title if r.non_conformity else None
                ),
                task_id=r.task_id,
                status=r.status,
                created_at=r.created_at,
                completed_at=r.completed_at,
                error_message=r.error_message,
            )
        )

    return LLMMyDraftsResponse(active_count=active_count, items=items)


@router.get("/{task_id}", response_model=LLMSuggestionResponse)
def get_suggestion_by_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """task_id로 생성 상태/결과를 조회한다. (프런트엔드 폴링 엔드포인트)"""
    suggestion = (
        db.query(LLMSuggestion).filter(LLMSuggestion.task_id == task_id).first()
    )
    if suggestion is None:
        raise HTTPException(status_code=404, detail="해당 초안 요청을 찾을 수 없습니다.")
    return _to_response(suggestion)


@router.get(
    "/by-nonconformity/{nc_id}",
    response_model=LLMSuggestionList,
)
def list_suggestions_for_nonconformity(
    nc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """특정 부적합에 대한 과거 초안 생성 이력."""
    rows = (
        db.query(LLMSuggestion)
        .filter(LLMSuggestion.non_conformity_id == nc_id)
        .order_by(LLMSuggestion.created_at.desc())
        .all()
    )
    return LLMSuggestionList(
        items=[_to_response(r) for r in rows],
        total=len(rows),
    )


@router.delete(
    "/{suggestion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_suggestion(
    suggestion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit:read")),
):
    """
    초안을 영구 삭제한다 (하드 삭제).

    권한: 해당 초안을 생성한 본인(created_by), 또는 시스템 관리자(is_superuser).
    그 외 사용자는 'audit:read' 권한이 있더라도 타인의 초안을 건드릴 수 없다.

    라우트 등록 주의: 이 DELETE 의 path param 이름은 `suggestion_id` 이지만 prefix 는
    `/llm/corrective-actions/{id}` 로서 GET `/{task_id}` 와 동일한 슬롯을 공유한다.
    실제로는 DELETE 와 GET 으로 메서드가 달라 FastAPI 가 혼동 없이 매칭한다.
    """
    row = (
        db.query(LLMSuggestion)
        .filter(LLMSuggestion.id == suggestion_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="초안을 찾을 수 없습니다.")

    is_owner = row.created_by == current_user.id
    # 관리자 판정은 프로젝트 전역 require_permission() 규칙과 동일하게:
    # is_superuser 이거나, 역할 권한에 'all' 이 있으면 관리자.
    # (예: CISO 역할은 is_superuser=False 이지만 permissions='all' 이다.)
    is_admin = bool(getattr(current_user, "is_superuser", False))
    if not is_admin:
        try:
            for role in current_user.roles:
                for perm in (role.permissions or "").split(","):
                    if perm.strip() == "all":
                        is_admin = True
                        break
                if is_admin:
                    break
        except Exception:
            # roles 관계 접근 실패는 정책적으로 비관리자로 처리.
            is_admin = False

    if not (is_owner or is_admin):
        # 타인의 초안을 건드리려는 시도. 404 가 아니라 403 — 소유권 문제임을 명확히.
        raise HTTPException(
            status_code=403, detail="이 초안을 삭제할 권한이 없습니다."
        )

    db.delete(row)
    db.commit()
