import { Spin } from 'antd'
import type { SpinSize } from 'antd/es/spin'

interface LoadingSpinnerProps {
  size?: SpinSize
  tip?: string
  fullscreen?: boolean
}

const LoadingSpinner = ({ size = 'default', tip, fullscreen = false }: LoadingSpinnerProps) => {
  if (fullscreen) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Spin size={size} tip={tip} />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
      }}
    >
      <Spin size={size} tip={tip} />
    </div>
  )
}

export default LoadingSpinner
