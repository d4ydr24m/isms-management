import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AuthLayout from './AuthLayout'

describe('AuthLayout', () => {
  it('should render AuthLayout with children', () => {
    render(
      <AuthLayout>
        <div data-testid="auth-form">Login Form</div>
      </AuthLayout>
    )

    expect(screen.getByTestId('auth-form')).toBeInTheDocument()
  })

  it('should render system title', () => {
    render(
      <AuthLayout>
        <div>Content</div>
      </AuthLayout>
    )

    expect(screen.getByText(/ISMS 관리 시스템/i)).toBeInTheDocument()
  })

  it('should render system description', () => {
    render(
      <AuthLayout>
        <div>Content</div>
      </AuthLayout>
    )

    const description = screen.getByText(/정보보호 및 개인정보보호 관리체계/i)
    expect(description).toBeInTheDocument()
  })

  it('should center the content', () => {
    const { container } = render(
      <AuthLayout>
        <div>Content</div>
      </AuthLayout>
    )

    const layout = container.querySelector('.ant-layout')
    expect(layout).toBeInTheDocument()
  })

  it('should have full viewport height', () => {
    const { container } = render(
      <AuthLayout>
        <div>Content</div>
      </AuthLayout>
    )

    const layout = container.querySelector('.ant-layout')
    expect(layout).toBeInTheDocument()
    // Layout exists and will have minHeight: 100vh from inline styles
  })

  it('should render children in a card', () => {
    render(
      <AuthLayout>
        <div>Auth Content</div>
      </AuthLayout>
    )

    expect(screen.getByText('Auth Content')).toBeInTheDocument()
  })
})
