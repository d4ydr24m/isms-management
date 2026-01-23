import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import LoginPage from './LoginPage'
import { useAuthStore } from '@/stores/authStore'

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null }),
  }
})

describe('LoginPage', () => {
  const mockLogin = vi.fn()
  const mockClearError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuthStore as any).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
    })
  })

  describe('Rendering', () => {
    it('should render login form', () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
    })

    it('should render remember me checkbox', () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      expect(screen.getByRole('checkbox', { name: /remember me/i })).toBeInTheDocument()
    })

    it('should render forgot password link', () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      expect(screen.getByText(/forgot password/i)).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should show error when email is empty', async () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const submitButton = screen.getByRole('button', { name: /login/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/please input your email/i)).toBeInTheDocument()
      })
    })

    it('should show error when email is invalid', async () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email/i)
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })

      const submitButton = screen.getByRole('button', { name: /login/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument()
      })
    })

    it('should show error when password is empty', async () => {
      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email/i)
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

      const submitButton = screen.getByRole('button', { name: /login/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/please input your password/i)).toBeInTheDocument()
      })
    })
  })

  describe('Login Submission', () => {
    it('should call login with correct credentials', async () => {
      mockLogin.mockResolvedValue({ requiresMfa: false, user: { id: '1' } })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /login/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        })
      })
    })

    it('should navigate to dashboard on successful login without MFA', async () => {
      mockLogin.mockResolvedValue({ requiresMfa: false, user: { id: '1' } })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /login/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('should navigate to MFA page when MFA is required', async () => {
      mockLogin.mockResolvedValue({ requiresMfa: true, user: { id: '1' } })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /login/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth/mfa-verify')
      })
    })

    it('should handle remember me checkbox', async () => {
      mockLogin.mockResolvedValue({ requiresMfa: false, user: { id: '1' } })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const rememberCheckbox = screen.getByRole('checkbox', { name: /remember me/i })
      expect(rememberCheckbox).not.toBeChecked()

      fireEvent.click(rememberCheckbox)
      expect(rememberCheckbox).toBeChecked()
    })
  })

  describe('Error Handling', () => {
    it('should display error message on login failure', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid credentials'))

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /login/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      })
    })

    it('should display error from auth store', () => {
      ;(useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Account locked',
        clearError: mockClearError,
      })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      expect(screen.getByText(/account locked/i)).toBeInTheDocument()
    })

    it('should clear error when user starts typing', () => {
      ;(useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Some error',
        clearError: mockClearError,
      })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email/i)
      fireEvent.change(emailInput, { target: { value: 't' } })

      expect(mockClearError).toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('should disable form during login', () => {
      ;(useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
      })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /logging in/i })

      expect(emailInput).toBeDisabled()
      expect(passwordInput).toBeDisabled()
      expect(submitButton).toBeDisabled()
    })

    it('should show loading text on submit button', () => {
      ;(useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
      })

      render(
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      )

      expect(screen.getByText(/logging in/i)).toBeInTheDocument()
    })
  })
})
