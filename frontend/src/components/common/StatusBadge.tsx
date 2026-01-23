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
  active: { color: 'success', defaultText: 'Active' },
  inactive: { color: 'default', defaultText: 'Inactive' },
  pending: { color: 'processing', defaultText: 'Pending' },
  completed: { color: 'success', defaultText: 'Completed' },
  failed: { color: 'error', defaultText: 'Failed' },
  draft: { color: 'warning', defaultText: 'Draft' },
}

const StatusBadge = ({ status, text }: StatusBadgeProps) => {
  const config = statusConfig[status]

  return <Badge status={config.color} text={text || config.defaultText} />
}

export default StatusBadge
