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
      title: '번호',
      dataIndex: 'number',
      key: 'number',
      width: 100,
    },
    {
      title: '항목명',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '필수 여부',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 100,
      render: (isRequired: boolean) =>
        isRequired ? <Tag color="red">필수</Tag> : <Tag>선택</Tag>,
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
        title="통제항목 매핑"
        extra={
          !readOnly && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenModal}
            >
              통제항목 추가
            </Button>
          )
        }
      >
        {mappedControls.length === 0 ? (
          <Empty
            description="매핑된 통제항목이 없습니다"
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
          title="통제항목 선택"
          open={isModalOpen}
          onOk={handleOk}
          onCancel={handleCloseModal}
          width={800}
          okText="적용"
          cancelText="취소"
        >
          <Input
            placeholder="번호 또는 제목으로 검색"
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
