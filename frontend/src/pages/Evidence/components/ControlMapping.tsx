import { useState } from 'react'
import {
  Card,
  Tag,
  Button,
  Modal,
  Input,
  Table,
  Space,
  Typography,
  Empty,
  Spin,
} from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ControlItem, ControlItemMapping } from '@/types'

const { Text } = Typography

interface ControlMappingProps {
  mappedControls: ControlItemMapping[]
  availableControls: ControlItem[]
  onChange: (controlIds: number[]) => void
  loading?: boolean
  readOnly?: boolean
}

const ControlMapping = ({
  mappedControls,
  availableControls,
  onChange,
  loading = false,
  readOnly = false,
}: ControlMappingProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>(
    mappedControls.map((c) => c.id)
  )

  const handleOpenModal = () => {
    setSelectedRowKeys(mappedControls.map((c) => c.id))
    setSearchText('')
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleOk = () => {
    onChange(selectedRowKeys)
    setIsModalOpen(false)
  }

  const handleRemove = (controlId: number) => {
    const newIds = mappedControls.filter((c) => c.id !== controlId).map((c) => c.id)
    onChange(newIds)
  }

  const filteredControls = availableControls.filter(
    (control) =>
      control.number.toLowerCase().includes(searchText.toLowerCase()) ||
      control.title.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns: ColumnsType<ControlItem> = [
    {
      title: 'Number',
      dataIndex: 'number',
      key: 'number',
      width: 100,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Required',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 100,
      render: (isRequired: boolean) =>
        isRequired ? <Tag color="red">Required</Tag> : <Tag>Optional</Tag>,
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys as number[])
    },
  }

  return (
    <Spin spinning={loading}>
      <Card
        title="Control Item Mapping"
        extra={
          !readOnly && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenModal}
            >
              Add Control
            </Button>
          )
        }
      >
        {mappedControls.length === 0 ? (
          <Empty
            description="No control items mapped"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Space wrap size={[8, 8]}>
            {mappedControls.map((control) => (
              <Tag
                key={control.id}
                closable={!readOnly}
                onClose={() => handleRemove(control.id)}
                style={{ padding: '4px 8px' }}
              >
                <Text strong style={{ marginRight: 8 }}>
                  {control.number}
                </Text>
                <Text>{control.title}</Text>
              </Tag>
            ))}
          </Space>
        )}

        <Modal
          title="Select Control Items"
          open={isModalOpen}
          onOk={handleOk}
          onCancel={handleCloseModal}
          width={800}
          okText="Apply"
          cancelText="Cancel"
        >
          <Input
            placeholder="Search by number or title"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Table
            rowSelection={rowSelection}
            columns={columns}
            dataSource={filteredControls}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
            scroll={{ y: 400 }}
          />
        </Modal>
      </Card>
    </Spin>
  )
}

export default ControlMapping
