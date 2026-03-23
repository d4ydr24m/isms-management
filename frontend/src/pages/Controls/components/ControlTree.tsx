import { Tree, Empty, Spin } from 'antd'
import { FolderOutlined } from '@ant-design/icons'
import type { TreeProps, DataNode } from 'antd/es/tree'
import type { ControlDomain } from '@/types'

export interface TreeSelectInfo {
  type: 'domain'
  id: number
  name: string
}

interface ControlTreeProps {
  domains: ControlDomain[]
  onSelect: (info: TreeSelectInfo) => void
  selectedKey?: string
  loading?: boolean
}

const ControlTree = ({
  domains,
  onSelect,
  selectedKey,
  loading = false,
}: ControlTreeProps) => {
  const treeData: DataNode[] = domains.map((domain) => ({
    key: `domain-${domain.id}`,
    title: (
      <span data-testid={`tree-node-domain-${domain.id}`}>
        {domain.code}. {domain.name}
      </span>
    ),
    icon: <FolderOutlined />,
    selectable: true,
  }))

  const handleSelect: TreeProps['onSelect'] = (selectedKeys, _info) => {
    if (selectedKeys.length === 0) return

    const key = selectedKeys[0] as string
    const [type, idStr] = key.split('-')
    const id = parseInt(idStr, 10)

    if (type === 'domain') {
      const domain = domains.find((d) => d.id === id)
      if (domain) {
        onSelect({
          type: 'domain',
          id: domain.id,
          name: domain.name,
        })
      }
    }
  }

  if (loading) {
    return (
      <div
        data-testid="tree-loading"
        style={{ padding: 20, textAlign: 'center' }}
      >
        <Spin />
      </div>
    )
  }

  if (domains.length === 0) {
    return <Empty description="사용 가능한 영역이 없습니다" />
  }

  return (
    <Tree
      aria-label="통제 영역 트리"
      showIcon
      treeData={treeData}
      onSelect={handleSelect}
      selectedKeys={selectedKey ? [selectedKey] : []}
      defaultExpandAll
    />
  )
}

export default ControlTree
