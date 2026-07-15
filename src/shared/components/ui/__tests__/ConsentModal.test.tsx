import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConsentModal } from '../ConsentModal'

const mockGiveConsent = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/shared/stores/consentStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useConsentStore: (selector?: any) => {
    const state = { giveConsent: mockGiveConsent, privacyBannerDismissed: false }
    return selector ? selector(state) : state
  },
}))

describe('ConsentModal', () => {
  beforeEach(() => {
    mockGiveConsent.mockClear()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<ConsentModal open={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders dialog when open', () => {
    render(<ConsentModal open={true} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('privacy.consent.title')).toBeInTheDocument()
  })

  it('calls giveConsent and onRequestClose on accept', () => {
    const onRequestClose = vi.fn()
    render(<ConsentModal open={true} onRequestClose={onRequestClose} />)
    fireEvent.click(screen.getByText('privacy.consent.accept'))
    expect(mockGiveConsent).toHaveBeenCalledTimes(1)
    expect(onRequestClose).toHaveBeenCalledTimes(1)
  })

  it('shows privacy policy when "read policy" is clicked', () => {
    render(<ConsentModal open={true} />)
    fireEvent.click(screen.getByText('privacy.consent.readPolicy'))
    expect(screen.getByText('privacy.policy.title')).toBeInTheDocument()
  })

  it('has correct aria attributes', () => {
    render(<ConsentModal open={true} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label')
  })
})
