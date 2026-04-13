import { App, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'

const { Dragger } = Upload

interface FileUploadProps {
  onUpload: (files: File[]) => void
  onError?: (error: string) => void
  accept?: string
  multiple?: boolean
  maxSize?: number // in MB
  disabled?: boolean
  uploadText?: string
  hintText?: string
  showUploadList?: boolean
}

const FileUpload = ({
  onUpload,
  onError,
  accept,
  multiple = false,
  maxSize,
  disabled = false,
  uploadText = '클릭하거나 파일을 이 영역으로 드래그하여 업로드',
  hintText = '단일 또는 다수 파일 업로드를 지원합니다.',
  showUploadList = true,
}: FileUploadProps) => {
  const { message } = App.useApp()
  const handleBeforeUpload: UploadProps['beforeUpload'] = (file, _fileList) => {
    // Validate file size
    if (maxSize && file.size > maxSize * 1024 * 1024) {
      const errorMsg = `파일 크기는 ${maxSize}MB 이하여야 합니다`
      message.error(errorMsg)
      if (onError) {
        onError(errorMsg)
      }
      return Upload.LIST_IGNORE
    }

    // Return false to prevent auto upload
    return false
  }

  const handleChange: UploadProps['onChange'] = ({ fileList }) => {
    // Extract File objects from fileList
    const files = fileList.map((file) => file.originFileObj as File).filter(Boolean)

    if (files.length > 0) {
      onUpload(files)
    }
  }

  return (
    <Dragger
      multiple={multiple}
      accept={accept}
      disabled={disabled}
      showUploadList={showUploadList}
      beforeUpload={handleBeforeUpload}
      onChange={handleChange}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">{uploadText}</p>
      <p className="ant-upload-hint">{hintText}</p>
    </Dragger>
  )
}

export default FileUpload
