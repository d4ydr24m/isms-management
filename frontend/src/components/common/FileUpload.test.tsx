import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FileUpload from './FileUpload'

describe('FileUpload', () => {
  it('should render file upload component', () => {
    render(<FileUpload onUpload={vi.fn()} />)

    expect(screen.getByText(/Click or drag file/i)).toBeInTheDocument()
  })

  it('should display upload hint text', () => {
    render(<FileUpload onUpload={vi.fn()} />)

    expect(
      screen.getByText(/Support for a single or bulk upload/i)
    ).toBeInTheDocument()
  })

  it('should handle file selection', async () => {
    const mockOnUpload = vi.fn()
    render(<FileUpload onUpload={mockOnUpload} />)

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith([file])
    })
  })

  it('should handle multiple file selection', async () => {
    const mockOnUpload = vi.fn()
    render(<FileUpload onUpload={mockOnUpload} multiple />)

    const files = [
      new File(['content1'], 'test1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'test2.pdf', { type: 'application/pdf' }),
    ]
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files } })

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(files)
    })
  })

  it('should support accept prop for file types', () => {
    render(<FileUpload onUpload={vi.fn()} accept=".pdf,.doc" />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toHaveAttribute('accept', '.pdf,.doc')
  })

  it('should support maxSize validation', async () => {
    const mockOnUpload = vi.fn()
    const mockOnError = vi.fn()
    render(<FileUpload onUpload={mockOnUpload} onError={mockOnError} maxSize={1} />)

    // Create a file larger than 1MB (2MB)
    const largeContent = 'a'.repeat(2 * 1024 * 1024)
    const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalled()
      expect(mockOnUpload).not.toHaveBeenCalled()
    })
  })

  it('should render with custom upload text', () => {
    render(<FileUpload onUpload={vi.fn()} uploadText="Upload your files" />)

    expect(screen.getByText('Upload your files')).toBeInTheDocument()
  })

  it('should render with custom hint text', () => {
    render(<FileUpload onUpload={vi.fn()} hintText="Only PDF files allowed" />)

    expect(screen.getByText('Only PDF files allowed')).toBeInTheDocument()
  })

  it('should support disabled state', () => {
    render(<FileUpload onUpload={vi.fn()} disabled />)

    const uploadArea = document.querySelector('.ant-upload')
    expect(uploadArea).toHaveClass('ant-upload-disabled')
  })

  it('should display file list when showUploadList is true', async () => {
    const mockOnUpload = vi.fn()
    render(<FileUpload onUpload={mockOnUpload} showUploadList />)

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })
  })

  it('should render drag and drop area', () => {
    const { container } = render(<FileUpload onUpload={vi.fn()} />)

    const dropZone = container.querySelector('.ant-upload-drag')
    expect(dropZone).toBeInTheDocument()
  })
})
