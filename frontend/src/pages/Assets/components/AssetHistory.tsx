/**
 * 자산 변경 이력 컴포넌트
 * 타임라인 형태로 변경 이력 표시
 */
import { useState, useEffect } from 'react'
import { Card, Timeline, Tag, Empty, Typography } from 'antd'
import { apiClient } from '@/services/api'
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
const changeTypeIcons: Record<string, React.ReactNode> = {
  create: <PlusCircleOutlined style={{ color: '#52c41a' }} />,
  created: <PlusCircleOutlined style={{ color: '#52c41a' }} />,
  update: <EditOutlined style={{ color: '#1890ff' }} />,
  updated: <EditOutlined style={{ color: '#1890ff' }} />,
  status_changed: <SwapOutlined style={{ color: '#faad14' }} />,
  valuation_changed: <SafetyCertificateOutlined style={{ color: '#722ed1' }} />,
  valuation: <SafetyCertificateOutlined style={{ color: '#722ed1' }} />,
  assignment_changed: <UserSwitchOutlined style={{ color: '#13c2c2' }} />,
  assignment: <UserSwitchOutlined style={{ color: '#13c2c2' }} />,
  delete: <DeleteOutlined style={{ color: '#f5222d' }} />,
  disposed: <DeleteOutlined style={{ color: '#f5222d' }} />,
}

/** 변경 유형별 색상 */
const changeTypeColors: Record<string, string> = {
  create: 'green',
  created: 'green',
  update: 'blue',
  updated: 'blue',
  status_changed: 'orange',
  valuation_changed: 'purple',
  valuation: 'purple',
  assignment_changed: 'cyan',
  assignment: 'cyan',
  delete: 'red',
  disposed: 'red',
}

/** 변경 유형별 레이블 */
const changeTypeLabels: Record<string, string> = {
  create: '생성',
  created: '생성',
  update: '수정',
  updated: '수정',
  status_changed: '상태 변경',
  valuation_changed: '중요도 평가',
  valuation: '중요도 평가',
  assignment_changed: '담당자 변경',
  assignment: '담당자 변경',
  delete: '삭제',
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
  personnel_owner_id: '자산 소유자',
  asset_type_id: '자산 유형',
  category_ids: '분류',
  confidentiality: '기밀성',
  integrity: '무결성',
  availability: '가용성',
  acquisition_date: '취득일',
  acquisition_cost: '취득 비용',
  warranty_end_date: '보증 만료일',
}

const AssetHistory = ({ history, loading = false }: AssetHistoryProps) => {
  const [userMap, setUserMap] = useState<Record<string, string>>({})
  const [deptMap, setDeptMap] = useState<Record<string, string>>({})
  const [personnelMap, setPersonnelMap] = useState<Record<string, string>>({})

  useEffect(() => {
    // Load user and department names for resolving IDs in history
    const loadLookups = async () => {
      try {
        const [usersRes, deptsRes, personnelRes] = await Promise.all([
          apiClient.get<{ items: Array<{ id: number; name: string }> }>('/users', { params: { size: 100 } }),
          apiClient.get<{ items: Array<{ id: number; name: string }> }>('/departments', { params: { isActive: true } }),
          apiClient.get<Array<{ id: number; name: string }>>('/personnel/search', { params: { q: '' } }),
        ])
        const uMap: Record<string, string> = {}
        for (const u of usersRes.data.items || []) {
          uMap[String(u.id)] = u.name
        }
        setUserMap(uMap)
        const dMap: Record<string, string> = {}
        for (const d of deptsRes.data.items || []) {
          dMap[String(d.id)] = d.name
        }
        setDeptMap(dMap)
        const pMap: Record<string, string> = {}
        const pItems = Array.isArray(personnelRes.data) ? personnelRes.data : []
        for (const p of pItems) {
          pMap[String(p.id)] = p.name
        }
        setPersonnelMap(pMap)
      } catch { /* ignore */ }
    }
    if (history.length > 0) {
      loadLookups()
    }
  }, [history])

  /** ID 값을 사람이 읽을 수 있는 이름으로 변환 */
  const resolveValue = (fieldName: string | undefined, value: string | undefined): string => {
    if (!value) return '(없음)'
    if (fieldName === 'owner_id' || fieldName === 'ownerId') {
      return userMap[value] || `사용자 #${value}`
    }
    if (fieldName === 'personnel_owner_id' || fieldName === 'personnelOwnerId') {
      return personnelMap[value] || `담당자 #${value}`
    }
    if (fieldName === 'department_id' || fieldName === 'departmentId') {
      return deptMap[value] || `부서 #${value}`
    }
    return value
  }

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z')
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
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
      case 'create':
      case 'created':
        return <Text>자산이 등록되었습니다.</Text>
      case 'delete':
      case 'disposed':
        return <Text>자산이 폐기/삭제 처리되었습니다.</Text>
      case 'update':
      case 'updated':
      case 'status_changed':
      case 'valuation_changed':
      case 'valuation':
      case 'assignment_changed':
      case 'assignment': {
        const oldDisplay = resolveValue(item.fieldName, item.oldValue)
        const newDisplay = resolveValue(item.fieldName, item.newValue)
        if (!fieldLabel && !item.oldValue && !item.newValue) {
          return <Text>{item.remarks || '자산 정보가 수정되었습니다.'}</Text>
        }
        return (
          <div>
            {fieldLabel && <Text strong>{fieldLabel}</Text>}
            {fieldLabel && <Text> 변경: </Text>}
            {item.oldValue && (
              <>
                <Text delete type="secondary">{oldDisplay}</Text>
                <Text type="secondary"> → </Text>
              </>
            )}
            <Text>{newDisplay}</Text>
          </div>
        )
      }
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
