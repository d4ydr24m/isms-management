import { Card, List, Badge, Tag, Space, Empty } from 'antd'
import { Link } from 'react-router-dom'
import { CalendarOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { EolAssetItem } from '@/services/dashboard'

interface EolAssetsProps {
  data: EolAssetItem[]
}

const EolAssets: React.FC<EolAssetsProps> = ({ data }) => {
  const getUrgencyStatus = (days: number): 'error' | 'warning' | 'processing' => {
    if (days <= 0) return 'error'
    if (days <= 30) return 'warning'
    return 'processing'
  }

  const getUrgencyLabel = (days: number): string => {
    if (days < 0) return `${Math.abs(days)}일 경과`
    if (days === 0) return '오늘 만료'
    return `${days}일 남음`
  }

  const sortedData = [...data].sort((a, b) => a.daysRemaining - b.daysRemaining)

  return (
    <Card
      title={
        <Space>
          <WarningOutlined style={{ color: '#fa8c16' }} />
          <span>EoL 만료 자산</span>
          {data.filter(d => d.daysRemaining <= 0).length > 0 && (
            <Tag color="red">{data.filter(d => d.daysRemaining <= 0).length}건 만료</Tag>
          )}
        </Space>
      }
      variant="borderless"
    >
      {sortedData.length === 0 ? (
        <Empty description="EoL 만료 예정 자산이 없습니다" />
      ) : (
        <List
          dataSource={sortedData}
          renderItem={(asset) => (
            <List.Item key={asset.id}>
              <List.Item.Meta
                avatar={
                  <Badge
                    status={getUrgencyStatus(asset.daysRemaining)}
                    text={getUrgencyLabel(asset.daysRemaining)}
                  />
                }
                title={
                  <Link to={`/assets/${asset.id}`}>
                    [{asset.assetCode}] {asset.name}
                  </Link>
                }
                description={
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Space size="small" wrap>
                      {asset.assetTypeName && (
                        <Tag color="geekblue" style={{ margin: 0 }}>
                          {asset.assetTypeName}
                        </Tag>
                      )}
                      {asset.osVersion && (
                        <Tag style={{ margin: 0 }}>{asset.osVersion}</Tag>
                      )}
                      {asset.serviceVersion && (
                        <Tag style={{ margin: 0 }}>v{asset.serviceVersion}</Tag>
                      )}
                    </Space>
                    <Space size="small">
                      <CalendarOutlined />
                      <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        EoL: {dayjs(asset.eolDate).format('YYYY-MM-DD')}
                      </span>
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

export default EolAssets
