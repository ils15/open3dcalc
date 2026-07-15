import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivacyBanner } from '../PrivacyBanner'

const mockDismissBanner = vi.fn()
let mockDismissed = false

vi.mock('@/shared/stores/consentStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useConsentStore: (selector?: any) => {
    const state = {
      privacyBannerDismissed: mockDismissed,
      dismissBanner: mockDismissBanner,
    }
    return selector ? selector(state) : state
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/shared/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

describe('PrivacyBanner', () => {
  beforeEach(() => {
    mockDismissBanner.mockClear()
    mockDismissed = false
  })

  it('renders banner with privacy text', () => {
    render(<PrivacyBanner />)
    expect(screen.getByText('privacy.banner.text')).toBeInTheDocument()
  })

  it('renders shield icon', () => {
    render(<PrivacyBanner />)
    const shield = document.querySelector('.lucide-shield')
    expect(shield).toBeInTheDocument()
  })

  it('calls dismissBanner on close button click', () => {
    render(<PrivacyBanner />)
    const closeButton = screen.getByLabelText('privacy.banner.dismiss')
    fireEvent.click(closeButton)
    expect(mockDismissBanner).toHaveBeenCalledTimes(1)
  })

  it('has role="status" and aria-live="polite"', () => {
    render(<PrivacyBanner />)
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
  })

  it('renders close button with X icon', () => {
    render(<PrivacyBanner />)
    const closeButton = screen.getByLabelText('privacy.banner.dismiss')
    expect(closeButton).toBeInTheDocument()
    const xIcon = closeButton.querySelector('.lucide-x')
    expect(xIcon).toBeInTheDocument()
  })

  it('returns null when banner is dismissed', () => {
    mockDismissed = true
    const { container } = render(<PrivacyBanner />)
    expect(container.innerHTML).toBe('')
  })
})
