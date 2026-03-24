import { useState, useEffect } from 'react'
import { Card, Table, Switch, Select, Spin, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { notificationService } from '@/services/notifications'
import type { NotificationSetting, NotificationType } from '@/types'

const NotificationSettings: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<NotificationSetting[]>([])

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await notificationService.getSettings()
      setSettings(data)
    } catch (error) {
      message.error('알림 설정을 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }

  const getNotificationTypeLabel = (type: NotificationType): string => {
    const labelMap: Record<string, string> = {
      evidence_expiring: '증적 만료 예정',
      task_due: '정기 활동 예정',
      nc_assigned: '부적합 할당',
      audit_scheduled: '감사 예정',
      corrective_action_due: '시정조치 기한',
      audit_dday: '감사 당일',
      system: '시스템',
      asset_assigned: '자산 담당자 지정',
      asset_assignment_changed: '자산 담당자 변경',
      asset_handover: '자산 인수인계',
    }
    return labelMap[type] || type
  }

  const updateSetting = async (type: NotificationType, updates: Partial<{ emailEnabled: boolean; appEnabled: boolean; frequency: string }>) => {
    // Find current setting to send all required fields
    const current = settings.find((s) => s.notificationType === type)
    if (!current) return

    try {
      await notificationService.updateSetting({
        type,
        emailEnabled: updates.emailEnabled ?? current.emailEnabled,
        appEnabled: updates.appEnabled ?? current.appEnabled,
        frequency: (updates.frequency ?? current.frequency) as any,
      })
      message.success('알림 설정이 업데이트되었습니다')
      await loadSettings()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '업데이트 실패')
    }
  }

  const handleEmailToggle = (type: NotificationType, enabled: boolean) => {
    updateSetting(type, { emailEnabled: enabled })
  }

  const handleAppToggle = (type: NotificationType, enabled: boolean) => {
    updateSetting(type, { appEnabled: enabled })
  }

  const handleFrequencyChange = (type: NotificationType, frequency: 'realtime' | 'daily' | 'weekly') => {
    updateSetting(type, { frequency })
  }

  const columns: ColumnsType<NotificationSetting> = [
    {
      title: '알림 타입',
      dataIndex: 'notificationType',
      key: 'notificationType',
      render: (type: NotificationType) => getNotificationTypeLabel(type),
    },
    {
      title: '이메일 알림',
      dataIndex: 'emailEnabled',
      key: 'emailEnabled',
      render: (enabled: boolean, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleEmailToggle(record.notificationType, checked)}
        />
      ),
    },
    {
      title: '앱 알림',
      dataIndex: 'appEnabled',
      key: 'appEnabled',
      render: (enabled: boolean, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleAppToggle(record.notificationType, checked)}
        />
      ),
    },
    {
      title: '알림 빈도',
      dataIndex: 'frequency',
      key: 'frequency',
      render: (frequency: 'realtime' | 'daily' | 'weekly', record) => (
        <Select
          value={frequency}
          onChange={(value) => handleFrequencyChange(record.notificationType, value)}
          style={{ width: 120 }}
        >
          <Select.Option value="realtime">실시간</Select.Option>
          <Select.Option value="daily">일일</Select.Option>
          <Select.Option value="weekly">주간</Select.Option>
        </Select>
      ),
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Card title="알림 설정" bordered={false}>
      <Table
        columns={columns}
        dataSource={settings}
        rowKey="notificationType"
        pagination={false}
      />
    </Card>
  )
}

export default NotificationSettings
