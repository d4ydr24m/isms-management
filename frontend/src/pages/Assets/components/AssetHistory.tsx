/**
 * 자산 변경 이력 컴포넌트
 * 타임라인 형태로 변경 이력 표시
 */
import { Card, Timeline, Tag, Empty, Typography } from 'antd'
import {
  PlusCircleOutlined,
  EditOutlined,
  SwapOutlined,
  SafetyCertificateOutlined,
  UserSwitchOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { AssetHistory as AssetHistoryType, AssetChangeType } from '@/types'

const { Text } = Typography

interface AssetHistoryProps {
  history: AssetHistoryType[]
  loading?: boolean
}

/** 변경 유형별 아이콘 */
const changeTypeIcons: Record<AssetChangeType, React.ReactNode> = {
  created: <PlusCircleOutlined style={{ color: '#52c41a' }} />,
  updated: <EditOutlined style={{ color: '#1890ff' }} />,
  status_changed: <SwapOutlined style={{ color: '#faad14' }} />,
  valuation_changed: <SafetyCertificateOutlined style={{ color: '#722ed1' }} />,
  assignment_changed: <UserSwitchOutlined style={{ color: '#13c2c2' }} />,
  disposed: <DeleteOutlined style={{ color: '#f5222d' }} />,
}

/** 변경 유형별 색상 */
const changeTypeColors: Record<AssetChangeType, string> = {
  created: 'green',
  updated: 'blue',
  status_changed: 'orange',
  valuation_changed: 'purple',
  assignment_changed: 'cyan',
  disposed: 'red',
}

/** 변경 유형별 레이블 */
const changeTypeLabels: Record<AssetChangeType, string> = {
  created: '생성',
  updated: '수정',
  status_changed: '상태 변경',
  valuation_changed: '평가 변경',
  assignment_changed: '담당자 변경',
  disposed: '폐기',
}

/** 필드명 한글 변환 */
const fieldNameLabels: Record<string, string> = {
  name: '자산명',
  description: '설명',
  location: '위치',
  ip_address: 'IP 주소',
  mac_address: 'MAC 주소',
  hostname: '호스트명',
  os_version: 'OS 버전',
  serial_number: '시리얼 번호',
  manufacturer: '제조사',
  model: '모델명',
  status: '상태',
  department_id: '부서',
  owner_id: '소유자',
  category_id: '분류',
  confidentiality: '기밀성',
  integrity: '무결성',
  availability: '가용성',
}

const AssetHistory = ({ history, loading = false }: AssetHistoryProps) => {
  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderChangeDescription = (item: AssetHistoryType): React.ReactNode => {
    const fieldLabel = item.fieldName ? (fieldNameLabels[item.fieldName] || item.fieldName) : ''

    switch (item.changeType) {
      case 'created':
        return <Text>자산이 등록되었습니다.</Text>
      case 'disposed':
        return <Text>자산이 폐기 처리되었습니다.</Text>
      case 'updated':
      case 'status_changed':
      case 'valuation_changed':
        return (
          <div>
            <Text strong>{fieldLabel}</Text>
            <Text> 변경: </Text>
            {item.oldValue && (
              <>
                <Text delete type="secondary">{item.oldValue}</Text>
                <Text type="secondary"> → </Text>
              </>
            )}
            <Text>{item.newValue || '(없음)'}</Text>
          </div>
        )
      case 'assignment_changed':
        return (
          <div>
            <Text>담당자 변경: </Text>
            {item.oldValue && (
              <>
                <Text delete type="secondary">{item.oldValue}</Text>
                <Text type="secondary"> → </Text>
              </>
            )}
            <Text>{item.newValue || '(없음)'}</Text>
          </div>
        )
      default:
        return <Text>{item.remarks || '변경 내역'}</Text>
    }
  }

  const timelineItems = history.map((item) => ({
    dot: changeTypeIcons[item.changeType],
    children: (
      <div style={{ paddingBottom: 8 }}>
        <div style={{ marginBottom: 4 }}>
          <Tag color={changeTypeColors[item.changeType]}>
            {changeTypeLabels[item.changeType]}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatDateTime(item.changedAt)}
          </Text>
        </div>
        <div>{renderChangeDescription(item)}</div>
        {item.changerName && (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              변경자: {item.changerName}
            </Text>
          </div>
        )}
        {item.remarks && (
          <div style={{ marginTop: 4, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>비고: {item.remarks}</Text>
          </div>
        )}
      </div>
    ),
  }))

  return (
    <Card title="변경 이력" loading={loading}>
      {history.length > 0 ? (
        <Timeline items={timelineItems} />
      ) : (
        <Empty description="변경 이력이 없습니다" />
      )}
    </Card>
  )
}

export default AssetHistory
