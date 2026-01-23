import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import MFAVerifyPage from './MFAVerifyPage'
import { authService } from '@/services'

// Mock auth service
vi.mock('@/services', () => ({
  authService: {
    verifyMfa: vi.fn(),
  },
}))

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('MFAVerifyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render MFA verification form', () => {
      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      expect(screen.getByText(/two-factor authentication/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument()
    })

    it('should render back to login link', () => {
      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      expect(screen.getByText(/back to login/i)).toBeInTheDocument()
    })

    it('should render instructions text', () => {
      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      expect(
        screen.getByText(/enter the 6-digit code from your authenticator app/i)
      ).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should show error when code is empty', async () => {
      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      const submitButton = screen.getByRole('button', { name: /verify/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/please input verification code/i)).toBeInTheDocument()
      })
    })

    it('should show error when code length is not 6', async () => {
      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      const codeInput = screen.getByLabelText(/verification code/i)
      fireEvent.change(codeInput, { target: { value: '12345' } })

      const submitButton = screen.getByRole('button', { name: /verify/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/code must be exactly 6 digits/i)).toBeInTheDocument()
      })
    })

    it('should only accept numeric input', () => {
      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      const codeInput = screen.getByLabelText(/verification code/i) as HTMLInputElement
      fireEvent.change(codeInput, { target: { value: 'abc123' } })

      // Input should filter to only numbers
      expect(codeInput.value).toBe('123')
    })
  })

  describe('MFA Verification', () => {
    it('should call verifyMfa with correct code', async () => {
      vi.mocked(authService.verifyMfa).mockResolvedValue({
        success: true,
        user: { id: '1', email: 'test@example.com', name: 'Test' },
      } as any)

      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      const codeInput = screen.getByLabelText(/verification code/i)
      const submitButton = screen.getByRole('button', { name: /verify/i })

      fireEvent.change(codeInput, { target: { value: '123456' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(authService.verifyMfa).toHaveBeenCalledWith('123456')
      })
    })

    it('should navigate to dashboard on successful verification', async () => {
      vi.mocked(authService.verifyMfa).mockResolvedValue({
        success: true,
        user: { id: '1', email: 'test@example.com', name: 'Test' },
      } as any)

      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      const codeInput = screen.getByLabelText(/verification code/i)
      const submitButton = screen.getByRole('button', { name: /verify/i })

      fireEvent.change(codeInput, { target: { value: '123456' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('should display error on verification failure', async () => {
      vi.mocked(authService.verifyMfa).mockRejectedValue(new Error('Invalid code'))

      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      const codeInput = screen.getByLabelText(/verification code/i)
      const submitButton = screen.getByRole('button', { name: /verify/i })

      fireEvent.change(codeInput, { target: { value: '123456' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid code/i)).toBeInTheDocument()
      })
    })

    it('should clear input after failed verification', async () => {
      vi.mocked(authService.verifyMfa).mockRejectedValue(new Error('Invalid code'))

      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      const codeInput = screen.getByLabelText(/verification code/i) as HTMLInputElement
      const submitButton = screen.getByRole('button', { name: /verify/i })

      fireEvent.change(codeInput, { target: { value: '123456' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(codeInput.value).toBe('')
      })
    })
  })

  describe('Loading State', () => {
    it('should disable form during verification', async () => {
      vi.mocked(authService.verifyMfa).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      const codeInput = screen.getByLabelText(/verification code/i)
      const submitButton = screen.getByRole('button', { name: /verify/i })

      fireEvent.change(codeInput, { target: { value: '123456' } })
      fireEvent.click(submitButton)

      // Check immediately after click
      expect(codeInput).toBeDisabled()
      expect(submitButton).toBeDisabled()
    })

    it('should show verifying text on submit button', async () => {
      vi.mocked(authService.verifyMfa).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      const codeInput = screen.getByLabelText(/verification code/i)
      const submitButton = screen.getByRole('button', { name: /verify/i })

      fireEvent.change(codeInput, { target: { value: '123456' } })
      fireEvent.click(submitButton)

      expect(screen.getByText(/verifying/i)).toBeInTheDocument()
    })
  })

  describe('Auto-submit on complete', () => {
    it('should auto-submit when 6 digits are entered', async () => {
      vi.mocked(authService.verifyMfa).mockResolvedValue({
        success: true,
        user: { id: '1', email: 'test@example.com', name: 'Test' },
      } as any)

      render(
        <BrowserRouter>
          <MFAVerifyPage />
        </BrowserRouter>
      )

      const codeInput = screen.getByLabelText(/verification code/i)
      fireEvent.change(codeInput, { target: { value: '123456' } })

      await waitFor(() => {
        expect(authService.verifyMfa).toHaveBeenCalledWith('123456')
      })
    })
  })
})
