/**
 * 전역 LLM 초안 변경 알림 (window CustomEvent).
 *
 * 용도: CorrectiveActionAssistant 등에서 초안을 새로 만들거나 삭제했을 때,
 * 상단 네비의 LLMDraftBadge 가 5초 폴링을 기다리지 않고 즉시 재조회하도록 한다.
 *
 * 경량 이벤트 버스라서 Zustand/Context 없이 여러 탭·컴포넌트가 같은 신호를 공유한다.
 * (같은 탭 내부 전용 — BroadcastChannel 이 아니라 window.dispatchEvent 사용.)
 *
 * detail 로 activeDelta 를 실어 낙관적 업데이트 방향을 결정한다:
 *   · 'created'  → 새 pending 초안이 방금 생성됐다 (배지는 +1).
 *   · 'deleted-active'   → pending/running 초안이 삭제됐다 (배지는 -1).
 *   · 'deleted-finished' → succeeded/failed 초안이 삭제됐다 (배지 변화 없음).
 * 낙관적 업데이트 직후 실제 서버 값으로 재조회되므로 delta 가 틀려도 곧 보정된다.
 */
export const LLM_DRAFT_CHANGED_EVENT = 'llm-draft-changed'

export type LLMDraftChangeKind =
  | 'created'
  | 'deleted-active'
  | 'deleted-finished'

export interface LLMDraftChangedDetail {
  kind: LLMDraftChangeKind
}

export function emitLLMDraftChanged(kind: LLMDraftChangeKind): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<LLMDraftChangedDetail>(LLM_DRAFT_CHANGED_EVENT, {
      detail: { kind },
    }),
  )
}
