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
    const labelMap: Record<NotificationType, string> = {
      evidence_expiring: '증적 만료 예정',
      scheduled_task_due: '정기 활동 예정',
      corrective_action_due: '시정조치 기한',
      non_conformity_assigned: '부적합 할당',
      audit_scheduled: '감사 예정',
      system: '시스템',
    }
    return labelMap[type] || type
  }

  const handleEmailToggle = async (type: NotificationType, enabled: boolean) => {
    try {
      await notificationService.updateSetting({
        type,
        emailEnabled: enabled,
      })
      message.success('알림 설정이 업데이트되었습니다')
      await loadSettings()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '업데이트 실패')
    }
  }

  const handleAppToggle = async (type: NotificationType, enabled: boolean) => {
    try {
      await notificationService.updateSetting({
        type,
        appEnabled: enabled,
      })
      message.success('알림 설정이 업데이트되었습니다')
      await loadSettings()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '업데이트 실패')
    }
  }

  const handleFrequencyChange = async (type: NotificationType, frequency: 'realtime' | 'daily' | 'weekly') => {
    try {
      await notificationService.updateSetting({
        type,
        frequency,
      })
      message.success('알림 설정이 업데이트되었습니다')
      await loadSettings()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '업데이트 실패')
    }
  }

  const columns: ColumnsType<NotificationSetting> = [
    {
      title: '알림 타입',
      dataIndex: 'type',
      key: 'type',
      render: (type: NotificationType) => getNotificationTypeLabel(type),
    },
    {
      title: '이메일 알림',
      dataIndex: 'emailEnabled',
      key: 'emailEnabled',
      render: (enabled: boolean, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleEmailToggle(record.type, checked)}
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
          onChange={(checked) => handleAppToggle(record.type, checked)}
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
          onChange={(value) => handleFrequencyChange(record.type, value)}
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
        rowKey="id"
        pagination={false}
      />
    </Card>
  )
}

export default NotificationSettings
