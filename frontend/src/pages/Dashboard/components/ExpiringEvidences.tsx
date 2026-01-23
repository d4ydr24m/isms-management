import { Card, List, Badge, Tag, Space, Empty } from 'antd'
import { Link } from 'react-router-dom'
import { CalendarOutlined, FileOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ExpiringEvidence } from '@/types'

interface ExpiringEvidencesProps {
  data: ExpiringEvidence[]
}

const ExpiringEvidences: React.FC<ExpiringEvidencesProps> = ({ data }) => {
  const getUrgencyStatus = (days: number) => {
    if (days <= 7) return 'error'
    if (days <= 14) return 'warning'
    return 'processing'
  }

  const getUrgencyColor = (days: number) => {
    if (days <= 7) return '#ff4d4f'
    if (days <= 14) return '#faad14'
    return '#1890ff'
  }

  // 남은 일수로 정렬 (긴급한 것이 위)
  const sortedData = [...data].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)

  return (
    <Card title="만료 예정 증적" bordered={false}>
      {sortedData.length === 0 ? (
        <Empty description="만료 예정 증적이 없습니다" />
      ) : (
        <List
          dataSource={sortedData}
          renderItem={(evidence) => (
            <List.Item key={evidence.id}>
              <List.Item.Meta
                avatar={
                  <Badge
                    status={getUrgencyStatus(evidence.daysUntilExpiry)}
                    text={`${evidence.daysUntilExpiry}일 후`}
                  />
                }
                title={
                  <Link to={`/evidences/${evidence.id}`}>{evidence.title}</Link>
                }
                description={
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space size="small">
                      <FileOutlined />
                      <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        {evidence.fileName}
                      </span>
                    </Space>
                    <Space size="small">
                      <CalendarOutlined />
                      <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        만료일: {dayjs(evidence.validUntil).format('YYYY-MM-DD')}
                      </span>
                    </Space>
                    <Space size="small" wrap>
                      <span style={{ fontSize: '12px', color: '#8c8c8c' }}>통제항목:</span>
                      {evidence.controlItems.slice(0, 3).map((item) => (
                        <Tag key={item} color="blue" style={{ margin: 0 }}>
                          {item}
                        </Tag>
                      ))}
                      {evidence.controlItems.length > 3 && (
                        <Tag color="blue" style={{ margin: 0 }}>
                          +{evidence.controlItems.length - 3}
                        </Tag>
                      )}
                    </Space>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}

export default ExpiringEvidences
