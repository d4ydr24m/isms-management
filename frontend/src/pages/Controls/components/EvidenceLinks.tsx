import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  App,
  Card,
  Button,
  List,
  Modal,
  Select,
  Input,
  Space,
  Tag,
  Typography,
  Empty,
  Popconfirm,
  Spin,
  Badge,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  LinkOutlined,
  DatabaseOutlined,
  WarningOutlined,
  ScheduleOutlined,
  BugOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  BankOutlined,
  FileProtectOutlined,
  AppstoreOutlined,
  SolutionOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
  SecurityScanOutlined,
} from '@ant-design/icons'
import { controlService } from '@/services/controls'
import { usePermissions } from '@/hooks'
import type { ControlEvidenceLink, EvidenceLinkSource } from '@/types'

const { Text } = Typography
const { TextArea } = Input

// icon name -> component mapping
const iconMap: Record<string, React.ReactNode> = {
  DatabaseOutlined: <DatabaseOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  WarningOutlined: <WarningOutlined />,
  SolutionOutlined: <SolutionOutlined />,
  AuditOutlined: <AuditOutlined />,
  ScheduleOutlined: <ScheduleOutlined />,
  ExclamationCircleOutlined: <ExclamationCircleOutlined />,
  BugOutlined: <BugOutlined />,
  SecurityScanOutlined: <SecurityScanOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
  TeamOutlined: <TeamOutlined />,
  BankOutlined: <BankOutlined />,
  FileProtectOutlined: <FileProtectOutlined />,
}

const sourceTypeColors: Record<string, string> = {
  assets: 'blue',
  risks: 'orange',
  audits: 'purple',
  evidence: 'green',
  vuln_check: 'red',
  isms_scope: 'cyan',
  personnel: 'geekblue',
  departments: 'magenta',
  soa: 'gold',
}

const sourceTypeLabels: Record<string, string> = {
  assets: '자산',
  risks: '위험',
  audits: '감사',
  evidence: '증적',
  vuln_check: '취약점',
  isms_scope: '인증범위',
  personnel: '담당자',
  departments: '부서',
  soa: 'SOA',
}

interface EvidenceLinksProps {
  controlId: number
}

const EvidenceLinks = ({ controlId }: EvidenceLinksProps) => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canUpdate = hasPermission('control:update')
  const [links, setLinks] = useState<ControlEvidenceLink[]>([])
  const [sources, setSources] = useState<EvidenceLinkSource[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSource, setSelectedSource] = useState<EvidenceLinkSource | null>(null)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await controlService.getEvidenceLinks(controlId)
      setLinks(data.items || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [controlId])

  const fetchSources = useCallback(async () => {
    try {
      const data = await controlService.getAvailableSources()
      setSources(data || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchLinks()
    fetchSources()
  }, [fetchLinks, fetchSources])

  const handleAdd = async () => {
    if (!selectedSource) {
      message.warning('연결할 증적출처를 선택해주세요.')
      return
    }

    setSaving(true)
    try {
      await controlService.createEvidenceLink(controlId, {
        controlItemId: controlId,
        sourceType: selectedSource.type,
        sourceLabel: selectedSource.label,
        sourceUrl: selectedSource.url,
        description: description || undefined,
      })
      message.success('증적출처가 연결되었습니다.')
      setModalOpen(false)
      setSelectedSource(null)
      setDescription('')
      fetchLinks()
    } catch {
      message.error('증적출처 연결에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (linkId: number) => {
    try {
      await controlService.deleteEvidenceLink(controlId, linkId)
      message.success('증적출처 연결이 해제되었습니다.')
      fetchLinks()
    } catch {
      message.error('삭제에 실패했습니다.')
    }
  }

  const handleNavigate = (url: string) => {
    navigate(url)
  }

  // Filter out sources that are already linked
  const availableSources = sources.filter(
    (s) => !links.some((l) => l.sourceType === s.type && l.sourceUrl === s.url)
  )

  return (
    <Card
      title={
        <Space>
          <LinkOutlined />
          <span>증적출처 연결</span>
          <Badge count={links.length} style={{ backgroundColor: '#1890ff' }} />
        </Space>
      }
      extra={
        canUpdate ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
            size="small"
          >
            출처 연결
          </Button>
        ) : null
      }
    >
      <Spin spinning={loading}>
        {links.length === 0 ? (
          <Empty
            description="연결된 증적출처가 없습니다"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            size="small"
            dataSource={links}
            renderItem={(link) => (
              <List.Item
                key={link.id}
                actions={canUpdate ? [
                  <Popconfirm
                    key="delete"
                    title="연결을 해제하시겠습니까?"
                    onConfirm={() => handleDelete(link.id)}
                    okText="해제"
                    cancelText="취소"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>,
                ] : []}
              >
                <List.Item.Meta
                  avatar={
                    <Tag color={sourceTypeColors[link.sourceType] || 'default'}>
                      {sourceTypeLabels[link.sourceType] || link.sourceType}
                    </Tag>
                  }
                  title={
                    <span
                      style={{ cursor: 'pointer', color: '#1890ff' }}
                      onClick={() => handleNavigate(link.sourceUrl)}
                    >
                      {link.sourceLabel}
                    </span>
                  }
                  description={link.description}
                />
              </List.Item>
            )}
          />
        )}
      </Spin>

      <Modal
        title="증적출처 연결"
        open={modalOpen}
        onOk={handleAdd}
        onCancel={() => {
          setModalOpen(false)
          setSelectedSource(null)
          setDescription('')
        }}
        okText="연결"
        cancelText="취소"
        confirmLoading={saving}
        width={600}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              증적출처 선택
            </Text>
            <Select
              placeholder="연결할 메뉴/모듈을 선택하세요"
              style={{ width: '100%' }}
              value={selectedSource ? `${selectedSource.type}::${selectedSource.url}` : undefined}
              onChange={(value) => {
                const source = availableSources.find(
                  (s) => `${s.type}::${s.url}` === value
                )
                setSelectedSource(source || null)
              }}
              optionLabelProp="label"
            >
              {availableSources.map((source) => (
                <Select.Option
                  key={`${source.type}::${source.url}`}
                  value={`${source.type}::${source.url}`}
                  label={source.label}
                >
                  <Space>
                    {iconMap[source.icon] || <LinkOutlined />}
                    <Tag
                      color={sourceTypeColors[source.type] || 'default'}
                      style={{ margin: 0 }}
                    >
                      {sourceTypeLabels[source.type] || source.type}
                    </Tag>
                    <span>{source.label}</span>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              설명 (선택)
            </Text>
            <TextArea
              placeholder="이 출처가 해당 통제항목의 증적이 되는 이유를 설명하세요"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              showCount
            />
          </div>
        </Space>
      </Modal>
    </Card>
  )
}

export default EvidenceLinks
