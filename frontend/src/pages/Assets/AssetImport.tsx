/**
 * 자산 임포트 페이지
 * FR-502: 엑셀 대량 등록
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Card,
  Checkbox,
  Steps,
  Button,
  Upload,
  message,
  Table,
  Alert,
  Space,
  Typography,
  Result,
  Breadcrumb,
  Progress,
} from 'antd'
import {
  HomeOutlined,
  InboxOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { assetService } from '@/services/assets'
import { apiClient } from '@/services/api'
import type { AssetImportResult } from '@/types'

const { Dragger } = Upload
const { Text, Title } = Typography

type ImportStep = 'upload' | 'preview' | 'result'

const AssetImportPage = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [importResult, setImportResult] = useState<AssetImportResult | null>(null)
  const [updateExisting, setUpdateExisting] = useState(false)

  // 빈 템플릿 다운로드
  const handleDownloadTemplate = async () => {
    try {
      await assetService.downloadTemplate()
      message.success('템플릿 다운로드가 시작되었습니다')
    } catch {
      message.error('템플릿 다운로드에 실패했습니다')
    }
  }

  // 기존 데이터 포함 다운로드
  const handleDownloadWithData = async () => {
    try {
      const response = await apiClient.get('/assets/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', '자산_목록.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      message.success('다운로드가 완료되었습니다')
    } catch {
      message.error('다운로드에 실패했습니다')
    }
  }

  // 파일 선택 핸들러
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls',
    fileList,
    beforeUpload: (file) => {
      const isExcel =
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel'
      if (!isExcel) {
        message.error('엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다')
        return Upload.LIST_IGNORE
      }
      const isLt10M = file.size / 1024 / 1024 < 10
      if (!isLt10M) {
        message.error('파일 크기는 10MB 이하여야 합니다')
        return Upload.LIST_IGNORE
      }
      setFileList([file as any])
      return false
    },
    onRemove: () => {
      setFileList([])
    },
  }

  // 임포트 실행
  const handleImport = async () => {
    if (fileList.length === 0) {
      message.warning('파일을 선택해주세요')
      return
    }

    const file = fileList[0] as unknown as File
    setUploading(true)
    setUploadProgress(0)
    setCurrentStep('preview')

    try {
      const result = await assetService.importAssets(file, (progress) => {
        setUploadProgress(progress)
      })
      setImportResult(result)
      setCurrentStep('result')
    } catch {
      message.error('자산 임포트에 실패했습니다')
      setCurrentStep('upload')
    } finally {
      setUploading(false)
    }
  }

  // 결과에 따른 아이콘
  const getResultIcon = () => {
    if (!importResult) return null
    if (importResult.failed === 0) {
      return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 72 }} />
    } else if (importResult.success === 0) {
      return <CloseCircleOutlined style={{ color: '#f5222d', fontSize: 72 }} />
    } else {
      return <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 72 }} />
    }
  }

  // 결과 메시지
  const getResultStatus = (): 'success' | 'error' | 'warning' => {
    if (!importResult) return 'error'
    if (importResult.failed === 0) return 'success'
    if (importResult.success === 0) return 'error'
    return 'warning'
  }

  // 오류 테이블 컬럼
  const errorColumns = [
    {
      title: '행 번호',
      dataIndex: 'row',
      key: 'row',
      width: 100,
    },
    {
      title: '필드',
      dataIndex: 'field',
      key: 'field',
      width: 150,
      render: (field?: string) => field || '-',
    },
    {
      title: '오류 메시지',
      dataIndex: 'message',
      key: 'message',
    },
  ]

  // Steps 설정
  const steps = [
    { title: '파일 업로드', key: 'upload' },
    { title: '처리 중', key: 'preview' },
    { title: '결과 확인', key: 'result' },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep)

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/"><HomeOutlined /></Link> },
          { title: <Link to="/assets">정보자산 관리</Link> },
          { title: '일괄 등록' },
        ]}
      />

      <Card title="자산 일괄 등록 (엑셀 임포트)">
        <Steps
          current={currentStepIndex}
          items={steps.map((s) => ({ title: s.title }))}
          style={{ marginBottom: 32 }}
        />

        {/* Step 1: 파일 업로드 */}
        {currentStep === 'upload' && (
          <div>
            <Alert
              message="임포트 안내"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>엑셀 파일(.xlsx, .xls)만 지원됩니다.</li>
                  <li>첫 번째 행은 헤더로 사용됩니다.</li>
                  <li>필수 필드: 자산명, 자산유형코드</li>
                  <li>템플릿을 다운로드하여 양식에 맞게 작성해주세요.</li>
                </ul>
              }
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Space>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadTemplate}
                  size="large"
                >
                  빈 템플릿 다운로드
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadWithData}
                  size="large"
                >
                  기존 데이터 포함 다운로드
                </Button>
              </Space>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Checkbox
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
              >
                기존 데이터 업데이트 (자산코드가 동일한 자산이 있으면 정보를 업데이트합니다)
              </Checkbox>
            </div>

            <Dragger {...uploadProps} style={{ padding: '40px 0' }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                클릭하거나 파일을 이 영역으로 드래그하세요
              </p>
              <p className="ant-upload-hint">
                엑셀 파일(.xlsx, .xls)만 지원됩니다. 최대 10MB
              </p>
            </Dragger>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Space>
                <Button onClick={() => navigate('/assets')}>취소</Button>
                <Button
                  type="primary"
                  onClick={handleImport}
                  disabled={fileList.length === 0}
                  loading={uploading}
                >
                  임포트 실행
                </Button>
              </Space>
            </div>
          </div>
        )}

        {/* Step 2: 처리 중 */}
        {currentStep === 'preview' && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Title level={4}>파일 처리 중...</Title>
            <Progress
              percent={uploadProgress}
              status="active"
              style={{ maxWidth: 400, margin: '24px auto' }}
            />
            <Text type="secondary">
              잠시만 기다려주세요. 데이터를 처리하고 있습니다.
            </Text>
          </div>
        )}

        {/* Step 3: 결과 확인 */}
        {currentStep === 'result' && importResult && (
          <div>
            <Result
              icon={getResultIcon()}
              status={getResultStatus()}
              title={
                importResult.failed === 0
                  ? '임포트가 완료되었습니다!'
                  : importResult.success === 0
                  ? '임포트에 실패했습니다'
                  : '일부 데이터가 임포트되었습니다'
              }
              subTitle={
                <Space direction="vertical">
                  <Text>총 {importResult.total}건 중</Text>
                  <Text type="success">성공: {importResult.success}건</Text>
                  {importResult.failed > 0 && (
                    <Text type="danger">실패: {importResult.failed}건</Text>
                  )}
                </Space>
              }
              extra={[
                <Button key="list" type="primary" onClick={() => navigate('/assets')}>
                  자산 목록으로
                </Button>,
                <Button key="retry" onClick={() => {
                  setCurrentStep('upload')
                  setFileList([])
                  setImportResult(null)
                }}>
                  다시 임포트
                </Button>,
              ]}
            />

            {/* 오류 목록 */}
            {importResult.errors && importResult.errors.length > 0 && (
              <Card
                title={<Text type="danger">오류 내역 ({importResult.errors.length}건)</Text>}
                style={{ marginTop: 24 }}
              >
                <Table
                  columns={errorColumns}
                  dataSource={importResult.errors.map((e, i) => ({ ...e, key: i }))}
                  size="small"
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

export default AssetImportPage
