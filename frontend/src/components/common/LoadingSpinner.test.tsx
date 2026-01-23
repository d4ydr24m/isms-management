import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import LoadingSpinner from './LoadingSpinner'

describe('LoadingSpinner', () => {
  it('should render spinner', () => {
    const { container } = render(<LoadingSpinner />)

    const spinner = container.querySelector('.ant-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('should render with custom size', () => {
    const { container } = render(<LoadingSpinner size="large" />)

    const spinner = container.querySelector('.ant-spin-lg')
    expect(spinner).toBeInTheDocument()
  })

  it('should accept tip prop', () => {
    // Just test that the prop is accepted without error
    const { container } = render(<LoadingSpinner tip="Loading..." fullscreen />)

    const spinner = container.querySelector('.ant-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('should render as fullscreen', () => {
    const { container } = render(<LoadingSpinner fullscreen />)

    const wrapper = container.firstChild as HTMLElement
    const styles = window.getComputedStyle(wrapper)
    expect(styles.display).toBe('flex')
  })

  it('should center spinner by default', () => {
    const { container } = render(<LoadingSpinner />)

    const wrapper = container.firstChild
    expect(wrapper).toHaveStyle({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    })
  })
})
