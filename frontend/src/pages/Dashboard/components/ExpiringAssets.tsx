import { Card, List, Badge, Tag, Space, Empty } from 'antd'
import { Link } from 'react-router-dom'
import { CalendarOutlined, EnvironmentOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ExpiringAsset } from '@/types'

interface ExpiringAssetsProps {
  data: ExpiringAsset[]
}

const ExpiringAssets: React.FC<ExpiringAssetsProps> = ({ data }) => {
  const getUrgencyStatus = (days: number) => {
    if (days <= 14) return 'error'
    if (days <= 30) return 'warning'
    return 'processing'
  }

  const sortedData = [...data].sort((a, b) => a.daysRemaining - b.daysRemaining)

  return (
    <Card title="보증 만료 예정 자산" variant="borderless">
      {sortedData.length === 0 ? (
        <Empty description="보증 만료 예정 자산이 없습니다" />
      ) : (
        <List
          dataSource={sortedData}
          renderItem={(asset) => (
            <List.Item key={asset.id}>
              <List.Item.Meta
                avatar={
                  <Badge
                    status={getUrgencyStatus(asset.daysRemaining)}
                    text={`${asset.daysRemaining}일 후`}
                  />
                }
                title={
                  <Link to={`/assets/${asset.id}`}>
                    [{asset.assetCode}] {asset.name}
                  </Link>
                }
                description={
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {asset.assetTypeName && (
                      <Tag color="geekblue" style={{ margin: 0 }}>
                        {asset.assetTypeName}
                      </Tag>
                    )}
                    <Space size="small">
                      <CalendarOutlined />
                      <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        보증 만료: {dayjs(asset.warrantyEndDate).format('YYYY-MM-DD')}
                      </span>
                    </Space>
                    {asset.location && (
                      <Space size="small">
                        <EnvironmentOutlined />
                        <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                          {asset.location}
                        </span>
                      </Space>
                    )}
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

export default ExpiringAssets
