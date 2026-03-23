import { Badge } from 'antd'
import type { PresetStatusColorType } from 'antd/es/_util/colors'

type StatusType = 'active' | 'inactive' | 'pending' | 'completed' | 'failed' | 'draft'

interface StatusBadgeProps {
  status: StatusType
  text?: string
}

const statusConfig: Record<
  StatusType,
  { color: PresetStatusColorType; defaultText: string }
> = {
  active: { color: 'success', defaultText: '활성' },
  inactive: { color: 'default', defaultText: '비활성' },
  pending: { color: 'processing', defaultText: '대기' },
  completed: { color: 'success', defaultText: '완료' },
  failed: { color: 'error', defaultText: '실패' },
  draft: { color: 'warning', defaultText: '초안' },
}

const StatusBadge = ({ status, text }: StatusBadgeProps) => {
  const config = statusConfig[status]

  return <Badge status={config.color} text={text || config.defaultText} />
}

export default StatusBadge
