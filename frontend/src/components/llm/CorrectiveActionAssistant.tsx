/**
 * AI 보완조치내역서 초안 어시스턴트
 *
 * 부적합(NC) 상세 페이지에 삽입되어, 심사원이 첨부한 스크린샷(이미지 증적)을
 * 로컬 LLM(Qwen2.5-VL)에 전달하여 '보완조치내역서' 초안을 생성한다.
 *
 * 동작:
 * 1. 사용자가 NC에 이미 연결된 증적 중 이미지 MIME 증적만 골라 선택.
 * 2. "AI 초안 생성" 클릭 → 백엔드가 Celery 큐잉 (202) + task_id 반환.
 * 3. 3초 간격 폴링, pending → running → succeeded|failed.
 * 4. 성공 시 초안 본문을 표시하고, 클립보드 복사·조치계획 적용 제공.
 *
 * 프라이버시: 스크린샷과 결함 텍스트는 모두 사내 Docker 네트워크 안의
 * Ollama 컨테이너에서만 처리되며, 외부로 전송되지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Alert,
  Button,
  Card,
  Popconfirm,
  Space,
  Select,
  Tag,
  Typography,
  Spin,
} from 'antd'
import {
  CopyOutlined,
  DeleteOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

import { llmCorrectiveActionService } from '@/services/llmCorrectiveActions'
import { evidenceService } from '@/services/evidences'
import { emitLLMDraftChanged } from '@/utils/llmDraftEvents'
import type {
  LLMSuggestion,
  LLMSuggestionStatus,
} from '@/types'

const { Paragraph, Text } = Typography
const { Option } = Select

// 이미지 MIME 타입만 LLM에 전달 가능하다.
const IMAGE_MIME_PREFIX = 'image/'
const POLL_INTERVAL_MS = 3000
const POLL_MAX_MS = 15 * 60 * 1000 // 15분

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

// 서버는 datetime.utcnow() 로 생성한 tz-naive ISO 문자열을 내려준다
// (예: "2026-04-20T07:25:40.565632" — Z 접미사 없음). JS new Date() 는 그런 문자열을
// '로컬' 로 해석해서 KST 브라우저에선 9시간 밀린 시각이 표시되는 버그가 있었다.
// 따라서 '서버 시각은 UTC' 로 명시(dayjs.utc)한 뒤 KST 로 변환해 포맷한다.
const KST = 'Asia/Seoul'

function toKst(iso: string | null | undefined) {
  if (!iso) return null
  // Z/offset 이 있으면 그대로, 없으면 UTC 로 간주
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)
  const d = hasTz ? dayjs(iso).tz(KST) : dayjs.utc(iso).tz(KST)
  return d.isValid() ? d : null
}

/**
 * 자동 복원 대상 결정자.
 *
 * 사용자가 페이지에 재진입하거나 초안을 삭제한 직후, 카드에 어떤 초안을 되살릴지 고른다.
 *
 * - pending/running: 여전히 서버에서 처리 중이면 가장 최근 건을 복원하고 폴링 재개.
 * - succeeded: 완료된 결과 중 가장 최근 건을 복원.
 * - failed: 복원 대상에서 제외한다. 과거의 오래된 실패를 '현재 결과' 처럼 보여주면
 *   사용자가 방금 삭제한 성공 초안과 혼동해 혼란을 유발한다.
 *   (실패 이력이 필요하면 이후 '이전 초안 보기' 같은 별도 UI 로 제공할 예정.)
 *
 * list 는 서버에서 created_at DESC 로 정렬되어 도착한다고 가정한다.
 */
function pickRestoreTarget(
  items: LLMSuggestion[] | undefined,
): LLMSuggestion | null {
  if (!items || items.length === 0) return null
  for (const row of items) {
    if (
      row.status === 'pending' ||
      row.status === 'running' ||
      row.status === 'succeeded'
    ) {
      return row
    }
  }
  return null
}

// ISO 타임스탬프를 사용자 친화적인 한국어 상대시간으로 포맷한다.
// 예: "방금 전" / "5분 전" / "3시간 전" / "2일 전" / 그 이상은 YYYY-MM-DD HH:mm (KST).
function formatRelativeKo(iso: string | null | undefined): string {
  const d = toKst(iso)
  if (!d) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - d.valueOf()) / 1000))
  if (diffSec < 60) return '방금 전'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일 전`
  return d.format('YYYY-MM-DD HH:mm')
}

// 목록 API가 mimeType을 내려주지 않을 때 파일명 확장자로 추정한다.
function inferMimeFromFileName(fileName: string | null | undefined): string {
  if (!fileName) return ''
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return ''
  const ext = fileName.slice(dot + 1).toLowerCase()
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
  }
  return map[ext] || ''
}

const STATUS_LABEL: Record<LLMSuggestionStatus, string> = {
  pending: '대기 중',
  running: '생성 중…',
  succeeded: '완료',
  failed: '실패',
}

const STATUS_COLOR: Record<LLMSuggestionStatus, string> = {
  pending: 'default',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
}

export interface AssistantEvidence {
  id: number
  title: string
  mimeType?: string | null
  fileName?: string | null
}

export interface CorrectiveActionAssistantProps {
  nonConformityId: number
  /**
   * NC에 연결된 증적이 제공되는 경우 이 목록에서 이미지만 선택 후보가 된다.
   * 비어 있거나 생략되면 시스템 전체 증적 중 사용자가 접근 가능한 이미지 증적을 조회한다.
   */
  availableEvidences?: AssistantEvidence[]
  /** "조치계획에 적용" 클릭 시 호출. 초안 본문을 전달받아 부모가 폼을 채운다. */
  onApplyToCorrectiveAction?: (draftText: string) => void
  /** 폴링 간격(ms). 테스트에서만 짧게 설정한다. 미지정 시 3000ms. */
  pollIntervalMs?: number
}

const CorrectiveActionAssistant = ({
  nonConformityId,
  availableEvidences,
  onApplyToCorrectiveAction,
  pollIntervalMs = POLL_INTERVAL_MS,
}: CorrectiveActionAssistantProps) => {
  const { message } = App.useApp()

  // 상위가 증적 목록을 주지 않은 경우 시스템 전체에서 조회한다.
  const [fetchedEvidences, setFetchedEvidences] = useState<AssistantEvidence[]>([])
  const [loadingEvidences, setLoadingEvidences] = useState(false)

  useEffect(() => {
    if (availableEvidences && availableEvidences.length > 0) {
      return
    }
    let cancelled = false
    setLoadingEvidences(true)
    evidenceService
      .getEvidences({ page: 1, size: 100 })
      .then((list) => {
        if (cancelled) return
        // EvidenceListItem은 mimeType을 노출하지 않으므로 파일 확장자로 이미지 여부를 추정한다.
        // 상세 조회 API는 mimeType을 반환하지만, 목록에서 N+1을 피하기 위함이다.
        setFetchedEvidences(
          (list.items || []).map((e) => ({
            id: e.id,
            title: e.title,
            mimeType: inferMimeFromFileName(e.fileName),
            fileName: e.fileName,
          })),
        )
      })
      .catch(() => {
        // 조회 실패는 조용히 넘어가고 빈 목록으로 둔다.
      })
      .finally(() => {
        if (!cancelled) setLoadingEvidences(false)
      })
    return () => {
      cancelled = true
    }
  }, [availableEvidences])

  // 이미지 증적 후보
  const imageEvidences = useMemo(() => {
    const pool = availableEvidences && availableEvidences.length > 0
      ? availableEvidences
      : fetchedEvidences
    return pool.filter((e) =>
      (e.mimeType || '').toLowerCase().startsWith(IMAGE_MIME_PREFIX),
    )
  }, [availableEvidences, fetchedEvidences])

  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<number[]>([])
  const [suggestion, setSuggestion] = useState<LLMSuggestion | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pollTimerRef = useRef<number | null>(null)

  // 기본 선택: 이미지가 2장 이하면 전부, 3장 이상이면 비워두고 사용자가 고르게 한다.
  useEffect(() => {
    if (imageEvidences.length > 0 && imageEvidences.length <= 2) {
      setSelectedEvidenceIds(imageEvidences.map((e) => e.id))
    }
  }, [imageEvidences])

  // 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current)
      }
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const pollOnce = useCallback(
    async (taskId: string, startedAt: number) => {
      try {
        const next = await llmCorrectiveActionService.getByTaskId(taskId)
        setSuggestion(next)
        if (next.status === 'succeeded' || next.status === 'failed') {
          stopPolling()
          if (next.status === 'failed') {
            message.error(next.errorMessage || '초안 생성에 실패했습니다.')
          } else {
            message.success('초안 생성이 완료되었습니다.')
          }
          return
        }
      } catch {
        // 네트워크 오류는 일회성일 수 있으니 폴링은 계속한다.
      }
      if (Date.now() - startedAt > POLL_MAX_MS) {
        stopPolling()
        message.warning('초안 생성이 지연되고 있습니다. 잠시 후 다시 확인해 주세요.')
        return
      }
      pollTimerRef.current = window.setTimeout(
        () => pollOnce(taskId, startedAt),
        pollIntervalMs,
      )
    },
    [message, pollIntervalMs, stopPolling],
  )

  // 페이지 재진입 시 가장 최근 '유효한' 초안을 복원한다.
  // 유효 = pending/running/succeeded. 오래된 failed 는 건너뛰어 '실패 카드' 가
  // 자동 복원되는 일을 방지한다 (사용자 혼란 방지).
  // 네트워크 실패는 조용히 무시: 사용자는 새로 생성하면 된다.
  useEffect(() => {
    let cancelled = false
    llmCorrectiveActionService
      .listByNonConformity(nonConformityId)
      .then((list) => {
        if (cancelled) return
        const target = pickRestoreTarget(list.items)
        if (!target) return
        setSuggestion(target)
        if (target.status === 'pending' || target.status === 'running') {
          const startedAt = new Date(target.createdAt).getTime() || Date.now()
          pollOnce(target.taskId, startedAt)
        }
      })
      .catch(() => {
        /* no-op: 실패 시 그냥 빈 상태로 둔다 */
      })
    return () => {
      cancelled = true
    }
  }, [nonConformityId, pollOnce])

  const handleGenerate = useCallback(async () => {
    // 빈 배열도 허용한다 — 텍스트만으로 초안을 생성하는 경로.
    setSubmitting(true)
    try {
      const response = await llmCorrectiveActionService.generate({
        nonConformityId,
        evidenceIds: selectedEvidenceIds,
      })
      setSuggestion({
        id: response.suggestionId,
        nonConformityId,
        taskId: response.taskId,
        status: response.status,
        modelName: '',
        resultText: null,
        errorMessage: null,
        evidenceIds: selectedEvidenceIds,
        createdBy: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      })
      message.info(
        '초안 생성을 시작했습니다. 로컬 CPU에서 실행되므로 완료까지 1~3분 소요될 수 있습니다.',
      )
      // 상단 네비 배지가 5초 폴링을 기다리지 않고 즉시 활성 건수를 반영하도록 신호.
      emitLLMDraftChanged('created')
      pollOnce(response.taskId, Date.now())
    } catch {
      message.error('초안 생성 요청에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }, [message, nonConformityId, pollOnce, selectedEvidenceIds])

  const handleCopyToClipboard = useCallback(async () => {
    if (!suggestion?.resultText) return
    try {
      await navigator.clipboard.writeText(suggestion.resultText)
      message.success('초안을 클립보드에 복사했습니다.')
    } catch {
      message.error('클립보드 복사에 실패했습니다.')
    }
  }, [message, suggestion])

  const handleApply = useCallback(() => {
    if (!suggestion?.resultText || !onApplyToCorrectiveAction) return
    onApplyToCorrectiveAction(suggestion.resultText)
    message.success('조치 계획 입력 화면에 초안이 반영되었습니다.')
  }, [message, onApplyToCorrectiveAction, suggestion])

  const handleDelete = useCallback(async () => {
    if (!suggestion) return
    // 폴링이 돌고 있다면 멈춘다 — 방금 삭제한 행을 계속 조회하면 404 스팸이 난다.
    stopPolling()
    const wasActive =
      suggestion.status === 'pending' || suggestion.status === 'running'
    try {
      await llmCorrectiveActionService.deleteSuggestion(suggestion.id)
      message.success('초안을 삭제했습니다.')
      setSuggestion(null)
      emitLLMDraftChanged(wasActive ? 'deleted-active' : 'deleted-finished')
      // 같은 NC 의 '유효한' 이전 초안(pending/running/succeeded) 이 남아 있다면 자연스럽게
      // 복원한다. 오래된 failed 는 pickRestoreTarget 이 걸러낸다.
      try {
        const list = await llmCorrectiveActionService.listByNonConformity(
          nonConformityId,
        )
        const next = pickRestoreTarget(list.items)
        if (next) {
          setSuggestion(next)
          if (next.status === 'pending' || next.status === 'running') {
            const startedAt = new Date(next.createdAt).getTime() || Date.now()
            pollOnce(next.taskId, startedAt)
          }
        }
      } catch {
        /* 복원은 best-effort */
      }
    } catch {
      message.error('초안 삭제에 실패했습니다.')
    }
  }, [message, nonConformityId, pollOnce, stopPolling, suggestion])

  const isWorking =
    suggestion?.status === 'pending' || suggestion?.status === 'running' || submitting

  return (
    <Card
      title={
        <Space>
          <RobotOutlined />
          <span>AI 보완조치내역서 초안</span>
          <Tag color="blue">로컬 LLM</Tag>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="증적 스크린샷과 결함 정보를 바탕으로 한국어 초안을 생성합니다."
          description="모든 처리는 사내 서버의 로컬 LLM에서만 이루어지며, 외부로 데이터가 전송되지 않습니다. 생성 결과는 반드시 검토 후 사용하세요."
        />

        {imageEvidences.length === 0 ? (
          // 이미지 증적이 없어도 결함 제목·설명·요구사항 텍스트만으로 초안을 만들 수 있다.
          // 심사 초기에 후속 스크린샷이 아직 없을 때 유용하다.
          <>
            <Alert
              type="info"
              showIcon
              message="이미지 증적이 없어도 텍스트만으로 초안을 생성할 수 있습니다."
              description="결함 제목·설명·요구사항을 근거로 1·2 섹션을 작성하고, 3·4 섹션은 '조치 계획' 관점으로 서술됩니다. 스크린샷이 있으면 품질이 더 좋아집니다."
            />
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={isWorking}
              onClick={handleGenerate}
              aria-label="AI 초안 생성"
            >
              {isWorking ? '초안 생성 중…' : '텍스트만으로 AI 초안 생성'}
            </Button>
          </>
        ) : (
          <>
            <div>
              <Text strong>대상 이미지 증적 선택</Text>
              <Select
                mode="multiple"
                style={{ width: '100%', marginTop: 8 }}
                placeholder="이미지 증적을 선택하세요 (선택하지 않으면 텍스트만으로 생성)"
                value={selectedEvidenceIds}
                onChange={setSelectedEvidenceIds}
                disabled={isWorking}
                loading={loadingEvidences}
                maxTagCount="responsive"
                allowClear
              >
                {imageEvidences.map((e) => (
                  <Option key={e.id} value={e.id}>
                    {e.title} {e.fileName ? `(${e.fileName})` : ''}
                  </Option>
                ))}
              </Select>
            </div>

            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={isWorking}
              onClick={handleGenerate}
              aria-label="AI 초안 생성"
            >
              {isWorking
                ? '초안 생성 중…'
                : selectedEvidenceIds.length === 0
                ? '텍스트만으로 AI 초안 생성'
                : 'AI 초안 생성'}
            </Button>
          </>
        )}

        {suggestion && (
          <Card
            size="small"
            type="inner"
            title={
              <Space wrap>
                <Text strong>생성 결과</Text>
                <Tag color={STATUS_COLOR[suggestion.status]}>
                  {STATUS_LABEL[suggestion.status]}
                </Tag>
                {/* 재진입 후 결과가 언제 생성됐는지 드러내 오래된 초안을 사용자가 인지할 수 있게 한다. */}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {suggestion.status === 'succeeded' && suggestion.completedAt
                    ? `${formatRelativeKo(suggestion.completedAt)} 생성`
                    : suggestion.status === 'failed' && suggestion.completedAt
                    ? `${formatRelativeKo(suggestion.completedAt)} 실패`
                    : suggestion.createdAt
                    ? `${formatRelativeKo(suggestion.createdAt)} 시작`
                    : ''}
                </Text>
              </Space>
            }
            extra={
              // 진행 중이 아닌 상태(succeeded/failed) 에서만 조작 버튼을 노출한다.
              suggestion.status !== 'pending' && suggestion.status !== 'running' ? (
                <Space>
                  {suggestion.status === 'succeeded' && suggestion.resultText && (
                    <Button
                      icon={<CopyOutlined />}
                      onClick={handleCopyToClipboard}
                      aria-label="초안 복사"
                    >
                      복사
                    </Button>
                  )}
                  {suggestion.status === 'succeeded' &&
                    suggestion.resultText &&
                    onApplyToCorrectiveAction && (
                      <Button
                        type="primary"
                        onClick={handleApply}
                        aria-label="조치 계획에 적용"
                      >
                        조치 계획에 적용
                      </Button>
                    )}
                  <Popconfirm
                    title="이 초안을 삭제하시겠습니까?"
                    description="삭제하면 되돌릴 수 없습니다."
                    okText="삭제"
                    cancelText="취소"
                    okButtonProps={{ danger: true }}
                    onConfirm={handleDelete}
                  >
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      aria-label="초안 삭제"
                    >
                      삭제
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null
            }
          >
            {isWorking && (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <Spin />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">
                    로컬 CPU에서 추론 중입니다. 1~3분 정도 소요될 수 있습니다.
                  </Text>
                </div>
              </div>
            )}

            {suggestion.status === 'failed' && (
              <Alert
                type="error"
                showIcon
                message="초안 생성 실패"
                description={suggestion.errorMessage || '알 수 없는 오류가 발생했습니다.'}
              />
            )}

            {suggestion.status === 'succeeded' && suggestion.resultText && (
              <Paragraph
                style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                copyable={false}
              >
                {suggestion.resultText}
              </Paragraph>
            )}
          </Card>
        )}
      </Space>
    </Card>
  )
}

export default CorrectiveActionAssistant
