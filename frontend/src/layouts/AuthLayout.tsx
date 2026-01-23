import { Layout, Card, Typography, Space } from 'antd'
import { ReactNode } from 'react'
import { SafetyCertificateOutlined } from '@ant-design/icons'

const { Content } = Layout
const { Title, Text } = Typography

interface AuthLayoutProps {
  children: ReactNode
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <Layout
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Content style={{ padding: '50px', maxWidth: '500px', width: '100%' }}>
        <Space
          direction="vertical"
          size="large"
          style={{ width: '100%', textAlign: 'center' }}
        >
          <div>
            <SafetyCertificateOutlined
              style={{ fontSize: 64, color: '#fff', marginBottom: 16 }}
            />
            <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
              ISMS 관리 시스템
            </Title>
            <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 16 }}>
              정보보호 및 개인정보보호 관리체계
            </Text>
          </div>

          <Card
            style={{
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
              borderRadius: '8px',
            }}
          >
            {children}
          </Card>
        </Space>
      </Content>
    </Layout>
  )
}

export default AuthLayout
