import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FilePreview from './FilePreview'

describe('FilePreview', () => {
  const defaultProps = {
    previewUrl: 'https://example.com/file.pdf',
    fileName: 'document.pdf',
    mimeType: 'application/pdf',
    loading: false,
    onDownload: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the component title', () => {
      render(<FilePreview {...defaultProps} />)

      expect(screen.getByText('File Preview')).toBeInTheDocument()
    })

    it('should display file name', () => {
      render(<FilePreview {...defaultProps} />)

      expect(screen.getByText('document.pdf')).toBeInTheDocument()
    })

    it('should display loading state', () => {
      const { container } = render(
        <FilePreview {...defaultProps} loading={true} previewUrl={null} />
      )

      const spinner = container.querySelector('.ant-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('should show download button', () => {
      render(<FilePreview {...defaultProps} />)

      const downloadButtons = screen.getAllByRole('button', { name: /download/i })
      expect(downloadButtons.length).toBeGreaterThan(0)
    })
  })

  describe('PDF Preview', () => {
    it('should render iframe for PDF files', () => {
      const { container } = render(<FilePreview {...defaultProps} />)

      const iframe = container.querySelector('iframe')
      expect(iframe).toBeInTheDocument()
      expect(iframe?.src).toContain('example.com/file.pdf')
    })
  })

  describe('Image Preview', () => {
    it('should render image for PNG files', () => {
      const { container } = render(
        <FilePreview
          {...defaultProps}
          previewUrl="https://example.com/image.png"
          fileName="image.png"
          mimeType="image/png"
        />
      )

      const images = container.querySelectorAll('img.ant-image-img')
      expect(images.length).toBeGreaterThan(0)
    })

    it('should render image for JPEG files', () => {
      const { container } = render(
        <FilePreview
          {...defaultProps}
          previewUrl="https://example.com/photo.jpg"
          fileName="photo.jpg"
          mimeType="image/jpeg"
        />
      )

      const images = container.querySelectorAll('img.ant-image-img')
      expect(images.length).toBeGreaterThan(0)
    })

    it('should render image for GIF files', () => {
      const { container } = render(
        <FilePreview
          {...defaultProps}
          previewUrl="https://example.com/animation.gif"
          fileName="animation.gif"
          mimeType="image/gif"
        />
      )

      const images = container.querySelectorAll('img.ant-image-img')
      expect(images.length).toBeGreaterThan(0)
    })
  })

  describe('Unsupported Files', () => {
    it('should show message for unsupported file types', () => {
      render(
        <FilePreview
          {...defaultProps}
          previewUrl="https://example.com/file.docx"
          fileName="document.docx"
          mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
      )

      expect(screen.getByText(/preview not available/i)).toBeInTheDocument()
    })

    it('should show download button for unsupported files', () => {
      render(
        <FilePreview
          {...defaultProps}
          previewUrl="https://example.com/file.xlsx"
          fileName="spreadsheet.xlsx"
          mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        />
      )

      const downloadButtons = screen.getAllByRole('button', { name: /download/i })
      expect(downloadButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Interactions', () => {
    it('should call onDownload when download button is clicked', async () => {
      const onDownload = vi.fn()
      render(<FilePreview {...defaultProps} onDownload={onDownload} />)

      const downloadButtons = screen.getAllByRole('button', { name: /download/i })
      fireEvent.click(downloadButtons[0])

      await waitFor(() => {
        expect(onDownload).toHaveBeenCalled()
      })
    })
  })

  describe('Error States', () => {
    it('should show error message when preview URL is null', () => {
      render(<FilePreview {...defaultProps} previewUrl={null} loading={false} />)

      expect(screen.getByText(/no preview available/i)).toBeInTheDocument()
    })

    it('should show error message when preview URL is empty', () => {
      render(<FilePreview {...defaultProps} previewUrl="" loading={false} />)

      expect(screen.getByText(/no preview available/i)).toBeInTheDocument()
    })
  })

  describe('File Types', () => {
    it('should identify PDF files correctly and render iframe', () => {
      const { container } = render(
        <FilePreview {...defaultProps} mimeType="application/pdf" />
      )

      expect(container.querySelector('iframe')).toBeInTheDocument()
    })

    it('should identify image files correctly', () => {
      const { container } = render(
        <FilePreview
          {...defaultProps}
          previewUrl="https://example.com/image.png"
          mimeType="image/png"
        />
      )

      const images = container.querySelectorAll('img.ant-image-img')
      expect(images.length).toBeGreaterThan(0)
    })
  })
})
