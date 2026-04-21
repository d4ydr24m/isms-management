/**
 * 전역 'AI 초안 생성 중' 배지.
 *
 * 상단 네비게이션에 상주하며 사용자의 여러 NC 초안 상태를 한 곳에서 확인하게 한다.
 * 서버는 `OLLAMA_NUM_PARALLEL=1` 이므로 실제 처리는 직렬이지만, 사용자가 여러 NC 에
 * 생성 요청을 넣고 다른 작업을 하는 '비동기 워크플로' 를 자연스럽게 지원한다.
 *
 * 폴링 규칙:
 * - 활성(pending/running) 건이 있으면 5초 간격.
 * - 없으면 60초 간격 (로그인 세션 동안 가벼운 최신화).
 * - 탭 가시성 API 를 써서 백그라운드 탭에서는 폴링을 멈춘다.
 *
 * 상태 변화 토스트:
 * - 이전 폴링에서 활성이었던 항목이 succeeded/failed 로 바뀌면 한 번만 토스트를 띄운다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  App,
  Badge,
  Button,
  Empty,
  List,
  Popconfirm,
  Popover,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { DeleteOutlined, RobotOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

import { llmCorrectiveActionService } from '@/services/llmCorrectiveActions'
import {
  LLM_DRAFT_CHANGED_EVENT,
  emitLLMDraftChanged,
} from '@/utils/llmDraftEvents'
import type {
  LLMMyDraftRow,
  LLMMyDraftsResponse,
  LLMSuggestionStatus,
} from '@/types'

dayjs.extend(utc)
dayjs.extend(timezone)

const KST = 'Asia/Seoul'

const { Text } = Typography

const ACTIVE_POLL_MS = 5_000
const IDLE_POLL_MS = 60_000

const STATUS_LABEL: Record<LLMSuggestionStatus, string> = {
  pending: '대기 중',
  running: '생성 중',
  succeeded: '완료',
  failed: '실패',
}

const STATUS_COLOR: Record<LLMSuggestionStatus, string> = {
  pending: 'default',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
}

// ISO → "방금 전 / N분 전 / ..." — 헤더 공간이 좁으니 짧게.
// 서버가 tz-naive 시각을 내려주므로 '서버는 UTC' 로 명시 해석한 뒤 diff 를 계산한다.
function formatRelative(iso: string | null | undefined): string {
  if (!iso) return ''
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)
  const d = hasTz ? dayjs(iso).tz(KST) : dayjs.utc(iso).tz(KST)
  if (!d.isValid()) return ''
  const diff = Math.max(0, Math.floor((Date.now() - d.valueOf()) / 1000))
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

const isActive = (s: LLMSuggestionStatus) => s === 'pending' || s === 'running'

const LLMDraftBadge = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [data, setData] = useState<LLMMyDraftsResponse>({
    activeCount: 0,
    items: [],
  })
  // 직전 폴링 결과의 (id → status) 맵. 상태 전이 탐지에만 사용.
  const prevStatusRef = useRef<Map<number, LLMSuggestionStatus>>(new Map())
  const timerRef = useRef<number | null>(null)

  const poll = useCallback(async () => {
    try {
      const next = await llmCorrectiveActionService.listMine(10)
      // 이전 상태와 비교하여 방금 완료/실패한 건을 찾아 토스트.
      const prev = prevStatusRef.current
      for (const row of next.items) {
        const was = prev.get(row.id)
        if (was && isActive(was) && !isActive(row.status)) {
          if (row.status === 'succeeded') {
            message.success(
              `AI 초안 생성 완료: ${row.nonConformityTitle ?? `NC #${row.nonConformityId}`}`,
            )
          } else if (row.status === 'failed') {
            message.error(
              row.errorMessage ||
                `AI 초안 생성 실패: ${row.nonConformityTitle ?? `NC #${row.nonConformityId}`}`,
            )
          }
        }
      }
      const snapshot = new Map<number, LLMSuggestionStatus>()
      next.items.forEach((r) => snapshot.set(r.id, r.status))
      prevStatusRef.current = snapshot
      setData(next)
    } catch {
      // 조용히 무시 — 다음 틱에서 재시도.
    }
  }, [message])

  // 폴링 루프. 활성 건 유무와 탭 가시성에 따라 주기를 조절한다.
  useEffect(() => {
    const schedule = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
      if (document.visibilityState === 'hidden') return // 숨김 탭에서는 멈춤
      const interval = data.activeCount > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS
      timerRef.current = window.setTimeout(async () => {
        await poll()
        schedule()
      }, interval)
    }

    // 최초 즉시 fetch 1회 → 그 뒤 주기적 스케줄
    void poll().then(schedule)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // 다시 보이면 즉시 한 번 땡기고 스케줄 재시작
        void poll().then(schedule)
      } else if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // 초안 생성/삭제 직후 폴링 주기를 기다리지 않고 즉시 재조회한다.
    // assistant 카드 및 popover 삭제 버튼 모두 emitLLMDraftChanged(kind) 를 호출한다.
    // 서버 왕복 전이라도 배지가 즉시 반응하도록 kind 에 따라 낙관적으로 카운트를
    // 조정하고, 이후 poll() 응답이 실제 값으로 덮어쓴다.
    const handleDraftChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ kind?: string } | undefined>).detail
      const kind = detail?.kind
      // popover 내부 삭제는 이미 setData 로 로컬 차감을 했으므로 delta 를 skip.
      // 이벤트 발행자 구분 없이 kind 만으로 판단할 수 있게끔 badge 자신도
      // '변화 이전' 기준 kind 를 보내되, optimistic delta 는 여기서 단 한 번만 적용한다.
      // 따라서 popover 삭제 경로는 이벤트 발행 전에 이미 state 를 차감했으므로
      // 이 핸들러의 active-- 가 중복 적용되어 음수로 갈 수 있다 → Math.max(0, ...) 로 방어.
      setData((prev) => {
        if (kind === 'created') {
          return { ...prev, activeCount: prev.activeCount + 1 }
        }
        if (kind === 'deleted-active') {
          return { ...prev, activeCount: Math.max(0, prev.activeCount - 1) }
        }
        return prev
      })
      void poll()
    }
    window.addEventListener(LLM_DRAFT_CHANGED_EVENT, handleDraftChanged)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener(LLM_DRAFT_CHANGED_EVENT, handleDraftChanged)
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    // poll 과 activeCount 변경 시 재스케줄
  }, [data.activeCount, poll])

  const handleDelete = useCallback(
    async (row: LLMMyDraftRow) => {
      try {
        await llmCorrectiveActionService.deleteSuggestion(row.id)
        message.success('초안을 삭제했습니다.')
        // items 에서 즉시 제거해 popover UI 가 시각적으로 갱신되게 한다.
        // activeCount 는 아래 emit → listener 가 kind 에 따라 낙관적으로 조정한다.
        setData((prev) => ({
          ...prev,
          items: prev.items.filter((r) => r.id !== row.id),
        }))
        // 상태-전이 감지가 삭제된 행을 다시 감지하지 않도록 이전 상태 스냅샷에서도 뺀다.
        prevStatusRef.current.delete(row.id)
        // 같은 탭 내 다른 컴포넌트(assistant 카드) 동기화 + badge 자신의
        // activeCount 낙관적 차감 모두 이 이벤트 한 번으로 처리된다.
        emitLLMDraftChanged(
          isActive(row.status) ? 'deleted-active' : 'deleted-finished',
        )
      } catch {
        message.error('초안 삭제에 실패했습니다.')
      }
    },
    [message, poll],
  )

  const popoverContent = useMemo(
    () => (
      <div style={{ width: 360 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            로컬 LLM 서버는 한 번에 하나씩 처리합니다.
            여러 건을 요청하면 순차적으로 완료됩니다.
          </Text>
          {data.items.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="최근 생성 기록이 없습니다"
            />
          ) : (
            <List
              size="small"
              dataSource={data.items}
              renderItem={(row: LLMMyDraftRow) => (
                <List.Item
                  actions={[
                    <Tag
                      color={STATUS_COLOR[row.status]}
                      style={{ marginInlineEnd: 0 }}
                    >
                      {STATUS_LABEL[row.status]}
                    </Tag>,
                    // 진행 중이 아닌 건(succeeded/failed)에만 삭제 버튼을 붙인다.
                    // 진행 중 건은 클릭으로 이동은 되지만, 도중에 삭제하면 워커가
                    // 계속 돌고 있는 상태와 UI 상태가 어긋나기 쉬우므로 노출 제외.
                    !isActive(row.status) ? (
                      <Popconfirm
                        key="del"
                        title="이 초안을 삭제하시겠습니까?"
                        description="삭제하면 되돌릴 수 없습니다."
                        okText="삭제"
                        cancelText="취소"
                        okButtonProps={{ danger: true }}
                        onConfirm={(e) => {
                          e?.stopPropagation()
                          void handleDelete(row)
                        }}
                        onCancel={(e) => e?.stopPropagation()}
                      >
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={`${row.nonConformityTitle ?? `NC #${row.nonConformityId}`} 초안 삭제`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    ) : null,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={
                      <Text
                        ellipsis
                        style={{ maxWidth: 240, cursor: 'pointer' }}
                        onClick={() =>
                          navigate(`/non-conformities/${row.nonConformityId}`)
                        }
                      >
                        {row.nonConformityTitle ?? `NC #${row.nonConformityId}`}
                      </Text>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        NC #{row.nonConformityId} ·{' '}
                        {formatRelative(row.completedAt || row.createdAt)}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          )}
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            onClick={() => navigate('/non-conformities')}
          >
            부적합 목록으로 이동
          </Button>
        </Space>
      </div>
    ),
    [data.items, handleDelete, navigate],
  )

  return (
    <Popover
      content={popoverContent}
      title="AI 초안 현황"
      trigger="click"
      placement="bottomRight"
    >
      <Tooltip title={data.activeCount > 0 ? `진행 중 ${data.activeCount}건` : 'AI 초안'}>
        <Badge
          count={data.activeCount}
          offset={[-5, 5]}
          aria-label="진행 중인 AI 초안 수"
        >
          <RobotOutlined
            style={{ fontSize: 20, cursor: 'pointer' }}
            aria-label="AI 초안 현황 열기"
          />
        </Badge>
      </Tooltip>
    </Popover>
  )
}

export default LLMDraftBadge
