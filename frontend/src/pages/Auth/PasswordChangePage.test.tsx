import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import PasswordChangePage from './PasswordChangePage'
import { authService } from '@/services'

// Mock auth service
vi.mock('@/services', () => ({
  authService: {
    changePassword: vi.fn(),
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

describe('PasswordChangePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render password change form', () => {
      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      expect(screen.getByRole('heading', { name: /change password/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument()
    })

    it('should render back to dashboard link', () => {
      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      expect(screen.getByText(/back to dashboard/i)).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should show error when current password is empty', async () => {
      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      const submitButton = screen.getByRole('button', { name: /change password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/please input your current password/i)).toBeInTheDocument()
      })
    })

    it('should show error when new password is empty', async () => {
      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      const currentPassword = screen.getByLabelText(/current password/i)
      fireEvent.change(currentPassword, { target: { value: 'oldpass123' } })

      const submitButton = screen.getByRole('button', { name: /change password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/please input your new password/i)).toBeInTheDocument()
      })
    })

    it('should show error when new password is too short', async () => {
      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      const currentPassword = screen.getByLabelText(/current password/i)
      const newPassword = screen.getByLabelText(/^new password$/i)

      fireEvent.change(currentPassword, { target: { value: 'oldpass123' } })
      fireEvent.change(newPassword, { target: { value: '12345' } })

      const submitButton = screen.getByRole('button', { name: /change password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
      })
    })

    it('should show error when passwords do not match', async () => {
      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      const currentPassword = screen.getByLabelText(/current password/i)
      const newPassword = screen.getByLabelText(/^new password$/i)
      const confirmPassword = screen.getByLabelText(/confirm new password/i)

      fireEvent.change(currentPassword, { target: { value: 'oldpass123' } })
      fireEvent.change(newPassword, { target: { value: 'newpass123' } })
      fireEvent.change(confirmPassword, { target: { value: 'different123' } })

      const submitButton = screen.getByRole('button', { name: /change password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
      })
    })

    it('should show error when new password equals current password', async () => {
      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      const currentPassword = screen.getByLabelText(/current password/i)
      const newPassword = screen.getByLabelText(/^new password$/i)
      const confirmPassword = screen.getByLabelText(/confirm new password/i)

      fireEvent.change(currentPassword, { target: { value: 'samepass123' } })
      fireEvent.change(newPassword, { target: { value: 'samepass123' } })
      fireEvent.change(confirmPassword, { target: { value: 'samepass123' } })

      const submitButton = screen.getByRole('button', { name: /change password/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(
          screen.getByText(/new password must be different from current password/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('Password Change Submission', () => {
    it('should call changePassword with correct data', async () => {
      vi.mocked(authService.changePassword).mockResolvedValue({ success: true } as any)

      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      const currentPassword = screen.getByLabelText(/current password/i)
      const newPassword = screen.getByLabelText(/^new password$/i)
      const confirmPassword = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })

      fireEvent.change(currentPassword, { target: { value: 'oldpass123' } })
      fireEvent.change(newPassword, { target: { value: 'newpass123' } })
      fireEvent.change(confirmPassword, { target: { value: 'newpass123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(authService.changePassword).toHaveBeenCalledWith({
          currentPassword: 'oldpass123',
          newPassword: 'newpass123',
          confirmPassword: 'newpass123',
        })
      })
    })

    it('should show success message and navigate on successful change', async () => {
      vi.mocked(authService.changePassword).mockResolvedValue({ success: true } as any)

      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      const currentPassword = screen.getByLabelText(/current password/i)
      const newPassword = screen.getByLabelText(/^new password$/i)
      const confirmPassword = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })

      fireEvent.change(currentPassword, { target: { value: 'oldpass123' } })
      fireEvent.change(newPassword, { target: { value: 'newpass123' } })
      fireEvent.change(confirmPassword, { target: { value: 'newpass123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/password changed successfully/i)).toBeInTheDocument()
      })

      // Should navigate after short delay
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      }, { timeout: 3000 })
    })

    it('should display error on password change failure', async () => {
      vi.mocked(authService.changePassword).mockRejectedValue(
        new Error('Current password is incorrect')
      )

      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      const currentPassword = screen.getByLabelText(/current password/i)
      const newPassword = screen.getByLabelText(/^new password$/i)
      const confirmPassword = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })

      fireEvent.change(currentPassword, { target: { value: 'wrongpass' } })
      fireEvent.change(newPassword, { target: { value: 'newpass123' } })
      fireEvent.change(confirmPassword, { target: { value: 'newpass123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('should disable form during password change', async () => {
      vi.mocked(authService.changePassword).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      const currentPassword = screen.getByLabelText(/current password/i)
      const newPassword = screen.getByLabelText(/^new password$/i)
      const confirmPassword = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })

      fireEvent.change(currentPassword, { target: { value: 'oldpass123' } })
      fireEvent.change(newPassword, { target: { value: 'newpass123' } })
      fireEvent.change(confirmPassword, { target: { value: 'newpass123' } })
      fireEvent.click(submitButton)

      // Wait for loading state
      await waitFor(() => {
        expect(currentPassword).toBeDisabled()
        expect(newPassword).toBeDisabled()
        expect(confirmPassword).toBeDisabled()
        expect(submitButton).toBeDisabled()
      })
    })

    it('should show changing text on submit button', async () => {
      vi.mocked(authService.changePassword).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      render(
        <BrowserRouter>
          <PasswordChangePage />
        </BrowserRouter>
      )

      const currentPassword = screen.getByLabelText(/current password/i)
      const newPassword = screen.getByLabelText(/^new password$/i)
      const confirmPassword = screen.getByLabelText(/confirm new password/i)
      const submitButton = screen.getByRole('button', { name: /change password/i })

      fireEvent.change(currentPassword, { target: { value: 'oldpass123' } })
      fireEvent.change(newPassword, { target: { value: 'newpass123' } })
      fireEvent.change(confirmPassword, { target: { value: 'newpass123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/changing/i)).toBeInTheDocument()
      })
    })
  })
})
