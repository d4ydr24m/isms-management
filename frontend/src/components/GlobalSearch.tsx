import { useState, useEffect, useRef } from 'react'
import { Input, Dropdown, Spin, Typography, Empty, Divider } from 'antd'
import { SearchOutlined, FileTextOutlined, FolderOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { searchService } from '@/services/search'
import type { SearchResponse } from '@/types'

const { Text } = Typography

const GlobalSearch = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownVisible, setDropdownVisible] = useState(false)
  const navigate = useNavigate()
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    if (searchQuery.length < 2) {
      setSearchResults(null)
      setDropdownVisible(false)
      return
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        setLoading(true)
        setError(null)
        const results = await searchService.search({ query: searchQuery, limit: 5 })
        setSearchResults(results)
        setDropdownVisible(true)
      } catch (err) {
        setError('검색 중 오류가 발생했습니다')
        setDropdownVisible(true)
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchQuery])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDropdownVisible(false)
    }
  }

  const handleViewAll = () => {
    setDropdownVisible(false)
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`)
  }

  const handleItemClick = (url: string) => {
    setDropdownVisible(false)
    navigate(url)
  }

  const renderDropdownContent = () => {
    if (loading) {
      return (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Spin role="status" />
        </div>
      )
    }

    if (error) {
      return (
        <div style={{ padding: '16px' }}>
          <Text type="danger">{error}</Text>
        </div>
      )
    }

    if (!searchResults || searchResults.totalCount === 0) {
      return (
        <div style={{ padding: '16px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="검색 결과가 없습니다"
          />
        </div>
      )
    }

    const { controls, evidences, users } = searchResults

    return (
      <div style={{ maxHeight: '500px', overflow: 'auto' }}>
        {controls.length > 0 && (
          <div>
            <div style={{ padding: '8px 16px', backgroundColor: '#f5f5f5' }}>
              <Text strong>통제항목 ({controls.length})</Text>
            </div>
            {controls.map((control) => (
              <div
                key={control.id}
                data-testid={`search-control-${control.id}`}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                }}
                onClick={() => handleItemClick(`/controls/${control.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderOutlined />
                  <Text strong>{control.number}</Text>
                  <Text>{control.title}</Text>
                </div>
                <div style={{ marginLeft: '24px', marginTop: '4px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {control.categoryName}
                  </Text>
                </div>
              </div>
            ))}
            <Divider style={{ margin: 0 }} />
          </div>
        )}

        {evidences.length > 0 && (
          <div>
            <div style={{ padding: '8px 16px', backgroundColor: '#f5f5f5' }}>
              <Text strong>증적 ({evidences.length})</Text>
            </div>
            {evidences.map((evidence) => (
              <div
                key={evidence.id}
                data-testid={`search-evidence-${evidence.id}`}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                }}
                onClick={() => handleItemClick(`/evidences/${evidence.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileTextOutlined />
                  <Text strong>{evidence.title}</Text>
                </div>
                <div style={{ marginLeft: '24px', marginTop: '4px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {evidence.uploaderName}
                  </Text>
                </div>
              </div>
            ))}
            <Divider style={{ margin: 0 }} />
          </div>
        )}

        {users.length > 0 && (
          <div>
            <div style={{ padding: '8px 16px', backgroundColor: '#f5f5f5' }}>
              <Text strong>사용자 ({users.length})</Text>
            </div>
            {users.map((user) => (
              <div
                key={user.id}
                data-testid={`search-user-${user.id}`}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0',
                }}
                onClick={() => handleItemClick(`/users/${user.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserOutlined />
                  <Text strong>{user.name}</Text>
                  <Text type="secondary">({user.email})</Text>
                </div>
                <div style={{ marginLeft: '24px', marginTop: '4px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {user.department}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            padding: '12px 16px',
            textAlign: 'center',
            backgroundColor: '#fafafa',
            cursor: 'pointer',
          }}
          onClick={handleViewAll}
        >
          <Text type="link">모든 결과 보기</Text>
        </div>
      </div>
    )
  }

  return (
    <Dropdown
      open={dropdownVisible}
      onOpenChange={setDropdownVisible}
      dropdownRender={() => renderDropdownContent()}
      trigger={['click']}
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder="통제항목, 증적, 사용자 검색..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ width: 400 }}
      />
    </Dropdown>
  )
}

export default GlobalSearch
