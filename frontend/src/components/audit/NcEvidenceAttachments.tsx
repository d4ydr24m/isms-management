/**
 * 부적합 상세 페이지의 '첨부 증적' 카드.
 *
 * 3가지 조작을 한 곳에서 지원:
 *   1. 새 파일 업로드 → 증적으로 등록하고 즉시 부적합에 연결
 *   2. 이미 업로드된 증적을 목록에서 선택해 연결
 *   3. 연결 해제 (증적 자체는 유지)
 *
 * 이 컴포넌트는 부적합에 연결된 증적 목록을 state 로 보유하며, 부모는
 * onChange(items) 콜백으로 최신 목록을 받아 하위 컴포넌트(예: LLM 어시스턴트)에
 * 같은 목록을 전달할 수 있다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { UploadProps } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  LinkOutlined,
  PaperClipOutlined,
} from '@ant-design/icons'

import { auditService } from '@/services/audits'
import { evidenceService } from '@/services/evidences'
import type { NcEvidenceItem, NcEvidenceRole } from '@/types'

const { Text } = Typography
const { Option } = Select

// 역할 메타 — 배지 색/라벨/설명을 한 곳에서 관리한다.
const ROLE_LABEL: Record<NcEvidenceRole, string> = {
  before: '조치 전',
  after: '조치 후',
  support: '보조',
  reference: '미지정',
}
const ROLE_COLOR: Record<NcEvidenceRole, string> = {
  before: 'orange',
  after: 'green',
  support: 'blue',
  reference: 'default',
}
const ROLE_ORDER: NcEvidenceRole[] = ['before', 'after', 'support', 'reference']

/**
 * 업로드 기본 역할 선택 규칙.
 * - 기존 attachments 에 before 가 없으면 → before
 * - before 는 있지만 after 가 없으면 → after
 * - 그 외는 reference
 * LLM 이 이미지 순서대로 before→after 를 기대하므로 이 휴리스틱이 실제 심사원의
 * '전/후 스크린샷 한 쌍씩 올리는' 흐름을 잘 반영한다.
 */
function suggestDefaultRole(existing: NcEvidenceItem[]): NcEvidenceRole {
  const hasRole = (r: NcEvidenceRole) => existing.some((i) => i.role === r)
  if (!hasRole('before')) return 'before'
  if (!hasRole('after')) return 'after'
  return 'reference'
}

export interface NcEvidenceAttachmentsProps {
  nonConformityId: number
  /** 편집 권한이 있는 경우 업로드/연결/해제 버튼을 노출한다. */
  canEdit: boolean
  /** 연결된 증적 목록이 바뀔 때마다 호출된다 (부모가 LLM 어시스턴트에 전달). */
  onChange?: (items: NcEvidenceItem[]) => void
}

const humanSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const NcEvidenceAttachments = ({
  nonConformityId,
  canEdit,
  onChange,
}: NcEvidenceAttachmentsProps) => {
  const { message } = App.useApp()

  const [items, setItems] = useState<NcEvidenceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  // 기존 증적 선택 모달 상태
  const [pickOpen, setPickOpen] = useState(false)
  const [pickForm] = Form.useForm<{
    evidenceIds: number[]
    mappingNote?: string
    role: NcEvidenceRole
  }>()
  const [evidenceOptions, setEvidenceOptions] = useState<
    { id: number; title: string; fileName: string }[]
  >([])
  const [loadingEvidences, setLoadingEvidences] = useState(false)

  // 업로드 모달 상태 (antd Upload 의 beforeUpload 를 통해 추가 메타 수집)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadForm] = Form.useForm<{
    title: string
    mappingNote?: string
    role: NcEvidenceRole
  }>()

  // 메모 수정 모달
  const [editing, setEditing] = useState<NcEvidenceItem | null>(null)
  const [editForm] = Form.useForm<{ mappingNote?: string }>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await auditService.listNcEvidences(nonConformityId)
      // 역할 순(조치 전 → 후 → 보조 → 미지정)으로 안정 정렬해 LLM 이
      // 기대하는 순서와 UI 표시 순서가 일치하게 한다.
      const sorted = [...data.items].sort((a, b) => {
        const ra = ROLE_ORDER.indexOf(a.role)
        const rb = ROLE_ORDER.indexOf(b.role)
        if (ra !== rb) return ra - rb
        return a.mappedAt.localeCompare(b.mappedAt)
      })
      setItems(sorted)
      onChange?.(sorted)
    } catch {
      message.error('연결된 증적을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [message, nonConformityId, onChange])

  useEffect(() => {
    load()
  }, [load])

  // 연결되지 않은 증적만 선택지로 보여주기 위해 매번 다시 조회한다.
  // '기존 증적 연결' 은 결함 증적끼리만 재연결할 수 있도록 source=nc_finding 으로 제한한다.
  // (일반 증적 관리 라이브러리의 파일이 NC 조사 증적으로 섞여들지 않게 하기 위함.)
  const loadEvidenceOptions = useCallback(async () => {
    setLoadingEvidences(true)
    try {
      const list = await evidenceService.getEvidences({
        page: 1,
        size: 200,
        source: 'nc_finding',
      })
      const linked = new Set(items.map((i) => i.evidenceId))
      setEvidenceOptions(
        (list.items || [])
          .filter((e) => !linked.has(e.id))
          .map((e) => ({ id: e.id, title: e.title, fileName: e.fileName })),
      )
    } catch {
      message.error('증적 목록을 불러오지 못했습니다.')
    } finally {
      setLoadingEvidences(false)
    }
  }, [items, message])

  const handleOpenPick = () => {
    pickForm.resetFields()
    // 현재 목록을 바탕으로 기본 역할을 제안 (첫 batch=before, 두번째=after 등).
    pickForm.setFieldsValue({ role: suggestDefaultRole(items) })
    setPickOpen(true)
    loadEvidenceOptions()
  }

  const handlePickSubmit = async () => {
    try {
      const values = await pickForm.validateFields()
      await auditService.attachExistingEvidences(nonConformityId, {
        evidenceIds: values.evidenceIds,
        mappingNote: values.mappingNote || null,
        role: values.role,
      })
      message.success('증적을 연결했습니다.')
      setPickOpen(false)
      load()
    } catch (err: any) {
      if (err?.errorFields) return // antd validation
      message.error('증적 연결에 실패했습니다.')
    }
  }

  const handleRoleChange = async (
    item: NcEvidenceItem,
    role: NcEvidenceRole,
  ) => {
    if (role === item.role) return
    try {
      await auditService.updateNcEvidenceRole(nonConformityId, item.evidenceId, role)
      message.success('역할을 변경했습니다.')
      load()
    } catch {
      message.error('역할 변경에 실패했습니다.')
    }
  }

  const handleDetach = async (evidenceId: number) => {
    try {
      await auditService.detachEvidence(nonConformityId, evidenceId)
      message.success('연결을 해제했습니다.')
      load()
    } catch {
      message.error('연결 해제에 실패했습니다.')
    }
  }

  // Upload 의 beforeUpload 는 실제 업로드를 가로채고 파일만 붙잡아둔다.
  const uploadProps: UploadProps = useMemo(
    () => ({
      multiple: false,
      showUploadList: false,
      beforeUpload: (file) => {
        setUploadFile(file)
        uploadForm.setFieldsValue({
          title: file.name,
          role: suggestDefaultRole(items),
        })
        setUploadOpen(true)
        return false // 실제 POST 는 우리가 별도 버튼에서 수행
      },
    }),
    [items, uploadForm],
  )

  const handleUploadSubmit = async () => {
    if (!uploadFile) return
    try {
      const values = await uploadForm.validateFields()
      setUploading(true)
      await auditService.uploadAndAttachEvidence(nonConformityId, uploadFile, {
        title: values.title,
        mappingNote: values.mappingNote || null,
        role: values.role,
      })
      message.success('증적을 업로드하고 연결했습니다.')
      setUploadOpen(false)
      setUploadFile(null)
      uploadForm.resetFields()
      load()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error('업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const openEdit = (item: NcEvidenceItem) => {
    editForm.setFieldsValue({ mappingNote: item.mappingNote || '' })
    setEditing(item)
  }

  const handleEditSubmit = async () => {
    if (!editing) return
    try {
      const values = await editForm.validateFields()
      await auditService.updateNcEvidenceNote(
        nonConformityId,
        editing.evidenceId,
        values.mappingNote?.trim() ? values.mappingNote : null,
      )
      message.success('메모를 수정했습니다.')
      setEditing(null)
      load()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error('메모 수정에 실패했습니다.')
    }
  }

  return (
    <Card
      title={
        <Space>
          <PaperClipOutlined />
          <span>첨부 증적</span>
          <Tag>{items.length}</Tag>
        </Space>
      }
      extra={
        canEdit ? (
          <Button
            icon={<LinkOutlined />}
            onClick={handleOpenPick}
            aria-label="기존 증적 연결"
          >
            기존 증적 연결
          </Button>
        ) : null
      }
    >
      {canEdit && (
        <Upload.Dragger
          {...uploadProps}
          style={{ marginBottom: 16 }}
          aria-label="새 파일 드래그 앤 드롭 업로드"
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            파일을 이 영역에 끌어다 놓거나 클릭해서 선택하세요.
          </p>
          <p className="ant-upload-hint">
            업로드된 파일은 증적으로 등록되고 이 부적합에 자동 연결됩니다.
          </p>
        </Upload.Dragger>
      )}
      {items.length === 0 && !loading ? (
        <Empty description="연결된 증적이 없습니다." />
      ) : (
        <List
          loading={loading}
          dataSource={items}
          renderItem={(item) => (
            <List.Item
              actions={
                canEdit
                  ? [
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openEdit(item)}
                        aria-label={`${item.title} 메모 수정`}
                      >
                        메모
                      </Button>,
                      <Popconfirm
                        title="연결을 해제하시겠습니까?"
                        description="증적 자체는 삭제되지 않습니다."
                        okText="해제"
                        cancelText="취소"
                        onConfirm={() => handleDetach(item.evidenceId)}
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={`${item.title} 연결 해제`}
                        >
                          해제
                        </Button>
                      </Popconfirm>,
                    ]
                  : []
              }
            >
              <List.Item.Meta
                title={
                  <Space>
                    {canEdit ? (
                      // 편집 가능하면 Select 자체가 인라인 배지 역할을 한다 (클릭 → 즉시 변경).
                      <Select<NcEvidenceRole>
                        size="small"
                        value={item.role}
                        onChange={(v) => handleRoleChange(item, v)}
                        style={{ width: 96 }}
                        aria-label={`${item.title} 역할 변경`}
                      >
                        {ROLE_ORDER.map((r) => (
                          <Option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </Option>
                        ))}
                      </Select>
                    ) : (
                      <Tag color={ROLE_COLOR[item.role]}>{ROLE_LABEL[item.role]}</Tag>
                    )}
                    <span>{item.title}</span>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <Text type="secondary">
                      {item.fileName} · {humanSize(item.fileSize)}
                      {item.mimeType ? ` · ${item.mimeType}` : ''}
                    </Text>
                    {item.mappingNote && (
                      <Text italic type="secondary">
                        메모: {item.mappingNote}
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}

      {/* 기존 증적 선택 모달 */}
      <Modal
        title="기존 증적 연결"
        open={pickOpen}
        onOk={handlePickSubmit}
        onCancel={() => setPickOpen(false)}
        okText="연결"
        cancelText="취소"
        destroyOnHidden
      >
        <Form form={pickForm} layout="vertical">
          <Form.Item
            name="evidenceIds"
            label="증적 선택"
            rules={[{ required: true, message: '증적을 1개 이상 선택하세요.' }]}
          >
            <Select
              mode="multiple"
              placeholder="연결할 증적"
              loading={loadingEvidences}
              showSearch
              optionFilterProp="children"
              maxTagCount="responsive"
            >
              {evidenceOptions.map((e) => (
                <Option key={e.id} value={e.id}>
                  {e.title} ({e.fileName})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="role"
            label="역할"
            rules={[{ required: true, message: '역할을 선택하세요.' }]}
            tooltip="조치 전/후/보조/미지정 중 선택. LLM 초안 생성 시 이 순서대로 전달됩니다."
          >
            <Select<NcEvidenceRole> aria-label="역할 선택">
              {ROLE_ORDER.map((r) => (
                <Option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="mappingNote" label="공통 메모 (선택)">
            <Input.TextArea
              rows={2}
              maxLength={1000}
              placeholder="이번에 연결하는 증적들에 공통으로 기록할 메모"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 새 파일 업로드 모달 (메타 수집) */}
      <Modal
        title={`새 증적 업로드${uploadFile ? ` — ${uploadFile.name}` : ''}`}
        open={uploadOpen}
        onOk={handleUploadSubmit}
        onCancel={() => {
          setUploadOpen(false)
          setUploadFile(null)
          uploadForm.resetFields()
        }}
        okText="업로드 및 연결"
        cancelText="취소"
        confirmLoading={uploading}
        destroyOnHidden
      >
        <Form form={uploadForm} layout="vertical">
          <Form.Item
            name="title"
            label="증적 제목"
            rules={[{ required: true, message: '제목을 입력하세요.' }]}
          >
            <Input placeholder="예: 중복 로그인 설정 조치 후" />
          </Form.Item>
          <Form.Item
            name="role"
            label="역할"
            rules={[{ required: true, message: '역할을 선택하세요.' }]}
            tooltip="조치 전/후/보조/미지정 중 선택. LLM 초안 생성 시 이 순서대로 전달됩니다."
          >
            <Select<NcEvidenceRole> aria-label="업로드 역할 선택">
              {ROLE_ORDER.map((r) => (
                <Option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="mappingNote" label="매핑 메모 (선택)">
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 메모 수정 모달 */}
      <Modal
        title="매핑 메모 수정"
        open={!!editing}
        onOk={handleEditSubmit}
        onCancel={() => setEditing(null)}
        okText="저장"
        cancelText="취소"
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="mappingNote" label="메모">
            <Input.TextArea rows={3} maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default NcEvidenceAttachments
