import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Input, Tabs, List, Card, Typography, Empty, Spin, Tag, message } from 'antd'
import { SearchOutlined, FileTextOutlined, FolderOutlined, UserOutlined, LaptopOutlined } from '@ant-design/icons'
import { searchService } from '@/services/search'
import type { SearchResponse, SearchCategory } from '@/types'

const { Text, Title } = Typography

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all')

  useEffect(() => {
    const query = searchParams.get('q')
    if (query) {
      setSearchQuery(query)
      performSearch(query)
    }
  }, [searchParams])

  const performSearch = async (query: string) => {
    if (!query) return

    try {
      setLoading(true)
      setError(null)
      const results = await searchService.search({ query })
      setSearchResults(results)
    } catch (err) {
      setError('검색 중 오류가 발생했습니다')
      message.error('검색 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    if (value.trim()) {
      setSearchParams({ q: value })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      handleSearch(searchQuery)
    }
  }

  const renderControls = () => {
    if (!searchResults || searchResults.controls.length === 0) {
      return <Empty description="검색 결과가 없습니다" />
    }

    return (
      <List
        dataSource={searchResults.controls}
        renderItem={(control) => (
          <List.Item>
            <Card
              data-testid={`control-card-${control.id}`}
              hoverable
              style={{ width: '100%' }}
              onClick={() => navigate(`/controls/${control.id}`)}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <FolderOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Text strong style={{ marginRight: '8px' }}>
                      {control.code}
                    </Text>
                    <Text>{control.title}</Text>
                  </div>
                  <div>
                    <Text type="secondary">{control.description}</Text>
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <Tag>{control.categoryName}</Tag>
                    <Tag color="blue">증적 {control.evidenceCount}개</Tag>
                  </div>
                </div>
              </div>
            </Card>
          </List.Item>
        )}
      />
    )
  }

  const renderEvidences = () => {
    if (!searchResults || searchResults.evidences.length === 0) {
      return <Empty description="검색 결과가 없습니다" />
    }

    return (
      <List
        dataSource={searchResults.evidences}
        renderItem={(evidence) => (
          <List.Item>
            <Card
              data-testid={`evidence-card-${evidence.id}`}
              hoverable
              style={{ width: '100%' }}
              onClick={() => navigate(`/evidence/${evidence.id}`)}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <FileTextOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Text strong>{evidence.title}</Text>
                  </div>
                  <div>
                    <Text type="secondary">{evidence.description}</Text>
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <Tag color={evidence.status === 'active' ? 'green' : 'default'}>
                      {evidence.status}
                    </Tag>
                    <Text type="secondary" style={{ marginLeft: '8px' }}>
                      {evidence.uploaderName}
                    </Text>
                  </div>
                </div>
              </div>
            </Card>
          </List.Item>
        )}
      />
    )
  }

  const renderUsers = () => {
    if (!searchResults || searchResults.users.length === 0) {
      return <Empty description="검색 결과가 없습니다" />
    }

    return (
      <List
        dataSource={searchResults.users}
        renderItem={(user) => (
          <List.Item>
            <Card
              data-testid={`user-card-${user.id}`}
              hoverable
              style={{ width: '100%' }}
              onClick={() => navigate(`/users/${user.id}`)}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <UserOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Text strong>{user.name}</Text>
                    <Text type="secondary" style={{ marginLeft: '8px' }}>
                      ({user.email})
                    </Text>
                  </div>
                  <div>
                    <Tag>{user.department}</Tag>
                    {user.roles.map((role) => (
                      <Tag key={role} color="purple">
                        {role}
                      </Tag>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </List.Item>
        )}
      />
    )
  }

  const renderAssets = () => {
    if (!searchResults || !searchResults.assets || searchResults.assets.length === 0) {
      return <Empty description="검색 결과가 없습니다" />
    }

    return (
      <List
        dataSource={searchResults.assets}
        renderItem={(asset: any) => (
          <List.Item>
            <Card
              hoverable
              style={{ width: '100%' }}
              onClick={() => navigate(`/assets/${asset.id}`)}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <LaptopOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Text strong>{asset.name}</Text>
                    <Text type="secondary" style={{ marginLeft: '8px' }}>
                      ({asset.assetCode})
                    </Text>
                  </div>
                  <div>
                    {asset.assetTypeName && <Tag color="blue">{asset.assetTypeName}</Tag>}
                    {asset.departmentName && <Tag>{asset.departmentName}</Tag>}
                    <Tag color={asset.status === 'operating' ? 'green' : 'default'}>{asset.status}</Tag>
                  </div>
                </div>
              </div>
            </Card>
          </List.Item>
        )}
      />
    )
  }

  const renderAll = () => {
    if (!searchResults || searchResults.totalCount === 0) {
      return <Empty description="검색 결과가 없습니다" />
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {searchResults.controls.length > 0 && (
          <div>
            <Title level={4}>통제항목 ({searchResults.controls.length})</Title>
            {renderControls()}
          </div>
        )}
        {searchResults.evidences.length > 0 && (
          <div>
            <Title level={4}>증적 ({searchResults.evidences.length})</Title>
            {renderEvidences()}
          </div>
        )}
        {searchResults.users.length > 0 && (
          <div>
            <Title level={4}>사용자 ({searchResults.users.length})</Title>
            {renderUsers()}
          </div>
        )}
        {searchResults.assets && searchResults.assets.length > 0 && (
          <div>
            <Title level={4}>자산 ({searchResults.assets.length})</Title>
            {renderAssets()}
          </div>
        )}
      </div>
    )
  }

  if (!searchQuery) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty description="검색어를 입력하세요" />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty description={error} />
      </div>
    )
  }

  const tabItems = [
    {
      key: 'all',
      label: `전체 (${searchResults?.totalCount || 0})`,
      children: renderAll(),
    },
    {
      key: 'controls',
      label: `통제항목 (${searchResults?.controls.length || 0})`,
      children: renderControls(),
    },
    {
      key: 'evidences',
      label: `증적 (${searchResults?.evidences.length || 0})`,
      children: renderEvidences(),
    },
    {
      key: 'users',
      label: `사용자 (${searchResults?.users.length || 0})`,
      children: renderUsers(),
    },
    {
      key: 'assets',
      label: `자산 (${searchResults?.assets?.length || 0})`,
      children: renderAssets(),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>검색 결과</Title>

      <div style={{ marginBottom: '24px' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="검색어를 입력하세요"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          size="large"
          style={{ maxWidth: '600px' }}
        />
      </div>

      <Tabs
        activeKey={activeCategory}
        onChange={(key) => setActiveCategory(key as SearchCategory)}
        items={tabItems}
      />
    </div>
  )
}

export default SearchResults
