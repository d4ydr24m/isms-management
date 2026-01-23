import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SearchInput from './SearchInput'

describe('SearchInput', () => {
  it('should render search input with placeholder', () => {
    render(<SearchInput placeholder="Search here..." onSearch={vi.fn()} />)

    const input = screen.getByPlaceholderText('Search here...')
    expect(input).toBeInTheDocument()
  })

  it('should display search icon', () => {
    const { container } = render(<SearchInput onSearch={vi.fn()} />)

    const searchIcon = container.querySelector('.anticon-search')
    expect(searchIcon).toBeInTheDocument()
  })

  it('should call onSearch when user types', async () => {
    const mockOnSearch = vi.fn()
    render(<SearchInput onSearch={mockOnSearch} debounceMs={100} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test query' } })

    // Wait for debounce
    await waitFor(
      () => {
        expect(mockOnSearch).toHaveBeenCalledWith('test query')
      },
      { timeout: 200 }
    )
  })

  it('should debounce search calls', async () => {
    const mockOnSearch = vi.fn()
    render(<SearchInput onSearch={mockOnSearch} debounceMs={100} />)

    const input = screen.getByRole('textbox')

    // Type multiple times quickly
    fireEvent.change(input, { target: { value: 't' } })
    fireEvent.change(input, { target: { value: 'te' } })
    fireEvent.change(input, { target: { value: 'tes' } })
    fireEvent.change(input, { target: { value: 'test' } })

    // Should only call once after debounce
    await waitFor(
      () => {
        expect(mockOnSearch).toHaveBeenCalledWith('test')
        expect(mockOnSearch).toHaveBeenCalledTimes(1)
      },
      { timeout: 200 }
    )
  })

  it('should handle clear button click', async () => {
    const mockOnSearch = vi.fn()
    render(<SearchInput onSearch={mockOnSearch} allowClear debounceMs={100} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test query' } })

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('test query')
    }, { timeout: 200 })

    // Clear the input
    const clearButton = screen.getByLabelText('close-circle')
    fireEvent.click(clearButton)

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('')
    }, { timeout: 200 })
  })

  it('should support custom width', () => {
    const { container } = render(<SearchInput onSearch={vi.fn()} width={400} />)

    const searchWrapper = container.firstChild
    expect(searchWrapper).toHaveStyle({ width: '400px' })
  })

  it('should support disabled state', () => {
    render(<SearchInput onSearch={vi.fn()} disabled />)

    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })

  it('should call onSearch immediately when Enter is pressed', async () => {
    const mockOnSearch = vi.fn()
    render(<SearchInput onSearch={mockOnSearch} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })

    // Should call immediately
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('test')
    })
  })

  it('should support controlled value', () => {
    const mockOnSearch = vi.fn()
    const { rerender } = render(<SearchInput onSearch={mockOnSearch} value="initial" />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('initial')

    rerender(<SearchInput onSearch={mockOnSearch} value="updated" />)
    expect(input).toHaveValue('updated')
  })
})
