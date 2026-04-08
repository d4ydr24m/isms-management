import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const KST = 'Asia/Seoul'

/**
 * Format a datetime string to KST (YYYY-MM-DD HH:mm:ss)
 */
export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '-'
  const d = dayjs.utc(value).tz(KST)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : value
}

/**
 * Format a date string (YYYY-MM-DD)
 */
export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD') : value
}

// NC type labels
export const ncTypeLabels: Record<string, string> = {
  major: '중결함',
  minor: '경결함',
  observation: '관찰사항',
}

export const ncTypeColors: Record<string, string> = {
  major: 'orange',
  minor: 'gold',
  observation: 'blue',
}

// NC status labels
export const ncStatusLabels: Record<string, string> = {
  open: '열림',
  in_progress: '진행 중',
  resolved: '해결됨',
  closed: '종료',
  reopened: '재개',
}

export const ncStatusColors: Record<string, string> = {
  open: 'red',
  in_progress: 'processing',
  resolved: 'success',
  closed: 'default',
  reopened: 'warning',
}

// Severity labels
export const severityLabels: Record<string, string> = {
  critical: '치명적',
  high: '높음',
  medium: '중간',
  low: '낮음',
}

export const severityColors: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'blue',
}

// Corrective action status labels
export const caStatusLabels: Record<string, string> = {
  planned: '계획됨',
  in_progress: '진행 중',
  completed: '완료',
  verified: '검증됨',
}

export const caStatusColors: Record<string, string> = {
  planned: 'default',
  in_progress: 'processing',
  completed: 'success',
  verified: 'cyan',
}
