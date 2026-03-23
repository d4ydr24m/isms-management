import { Modal } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { ReactNode } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  children: ReactNode
  onConfirm: () => void
  onCancel: () => void
  okText?: string
  cancelText?: string
  type?: 'default' | 'danger'
}

const ConfirmModal = ({
  open,
  title,
  children,
  onConfirm,
  onCancel,
  okText = '확인',
  cancelText = '취소',
  type = 'default',
}: ConfirmModalProps) => {
  return (
    <Modal
      open={open}
      title={
        type === 'danger' ? (
          <span>
            <ExclamationCircleOutlined
              style={{ color: '#ff4d4f', marginRight: 8 }}
            />
            {title}
          </span>
        ) : (
          title
        )
      }
      onOk={onConfirm}
      onCancel={onCancel}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={{
        danger: type === 'danger',
      }}
    >
      {children}
    </Modal>
  )
}

export default ConfirmModal
