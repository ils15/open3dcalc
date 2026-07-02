import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UpdateNotification, CheckForUpdatesButton } from '../UpdateNotification'
import { useUpdaterStore } from '../UpdaterStore'

// ── i18n Mock ───────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'update.checkForUpdates': 'Check for Updates',
        'update.checking': 'Checking for updates…',
        'update.checkingShort': 'Checking…',
        'update.checkingDesc': 'Please wait while we check for the latest version',
        'update.available': 'Update v{{version}} Available',
        'update.availableDesc': 'A new version is ready to download',
        'update.downloading': 'Downloading v{{version}}…',
        'update.downloadingProgress': 'Downloading update…',
        'update.download': 'Download',
        'update.skipVersion': 'Skip this version',
        'update.whatsNew': "What's new",
        'update.ready': 'Update v{{version}} Ready',
        'update.readyDesc': 'Restart the app to install the update',
        'update.restartInstall': 'Restart & Install',
        'update.failed': 'Update Failed',
        'update.retry': 'Retry',
        'update.upToDate': "You're up to date!",
        'update.dismiss': 'Dismiss',
      }
      let text = translations[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
        }
      }
      return text
    },
    i18n: { language: 'en-US' },
  }),
}))

// ── Mocks ──────────────────────────────────────────────────────────

function createMockUpdater(overrides: Partial<ElectronUpdaterApi> = {}): ElectronUpdaterApi {
  return {
    check: vi.fn().mockResolvedValue({ available: false }),
    download: vi.fn().mockResolvedValue(undefined),
    install: vi.fn().mockResolvedValue(undefined),
    skip: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
    onProgress: vi.fn().mockReturnValue(vi.fn()),
    onAvailable: vi.fn().mockReturnValue(vi.fn()),
    onDownloaded: vi.fn().mockReturnValue(vi.fn()),
    onError: vi.fn().mockReturnValue(vi.fn()),
    onNotAvailable: vi.fn().mockReturnValue(vi.fn()),
    onChecking: vi.fn().mockReturnValue(vi.fn()),
    ...overrides,
  }
}

beforeEach(() => {
  // Reset the store before each test
  useUpdaterStore.setState({
    status: 'idle',
    version: null,
    releaseNotes: null,
    progress: 0,
    downloadSpeed: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    errorMessage: null,
    skippedVersion: null,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as Partial<Window>).electronAPI
})

// ── Helper to make the updater available in window ─────────────────

function mockElectronAPI(updater?: ElectronUpdaterApi) {
  Object.defineProperty(window, 'electronAPI', {
    value: updater ? { db: {} as ElectronDBApi, updater } : undefined,
    writable: true,
    configurable: true,
  })
}

// ── Tests ──────────────────────────────────────────────────────────

describe('UpdateNotification', () => {
  describe('idle state', () => {
    it('renders nothing when status is idle', () => {
      const { container } = render(<UpdateNotification />)
      expect(container.innerHTML).toBe('')
    })
  })

  describe('checking state', () => {
    it('renders checking banner with spinner', () => {
      useUpdaterStore.setState({ status: 'checking' })
      render(<UpdateNotification />)
      expect(screen.getByText(/checking for updates/i)).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText(/please wait/i)).toBeInTheDocument()
    })

    it('has aria-live="polite" for checking state', () => {
      useUpdaterStore.setState({ status: 'checking' })
      render(<UpdateNotification />)
      const statusEl = screen.getByRole('status')
      expect(statusEl).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('available state', () => {
    beforeEach(() => {
      useUpdaterStore.setState({
        status: 'available',
        version: '2.0.0',
        releaseNotes: 'Bug fixes and improvements',
      })
    })

    it('renders update available banner with version', () => {
      render(<UpdateNotification />)
      expect(screen.getByText(/update v2\.0\.0 available/i)).toBeInTheDocument()
      expect(screen.getByText(/a new version is ready/i)).toBeInTheDocument()
    })

    it('renders Download button', () => {
      render(<UpdateNotification />)
      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument()
    })

    it('renders Skip this version link', () => {
      render(<UpdateNotification />)
      expect(screen.getByText(/skip this version/i)).toBeInTheDocument()
    })

    it('has role="alert"', () => {
      render(<UpdateNotification />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('has aria-live="polite"', () => {
      render(<UpdateNotification />)
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite')
    })

    it('shows release notes in expandable section', () => {
      render(<UpdateNotification />)
      const summary = screen.getByText(/what's new/i)
      expect(summary).toBeInTheDocument()
    })

    it('dismisses when close button is clicked', () => {
      render(<UpdateNotification />)
      const dismissButton = screen.getByLabelText('Dismiss')
      act(() => {
        fireEvent.click(dismissButton)
      })
      expect(useUpdaterStore.getState().status).toBe('idle')
    })

    it('triggers download when Download button is clicked', () => {
      const mockUpdater = createMockUpdater()
      mockElectronAPI(mockUpdater)
      render(<UpdateNotification />)
      const downloadButton = screen.getByRole('button', { name: /download/i })
      act(() => {
        fireEvent.click(downloadButton)
      })
      expect(useUpdaterStore.getState().status).toBe('downloading')
    })

    it('triggers skip when Skip this version is clicked', async () => {
      const mockUpdater = createMockUpdater()
      mockElectronAPI(mockUpdater)
      render(<UpdateNotification />)
      await act(async () => {
        fireEvent.click(screen.getByText(/skip this version/i))
      })
      await vi.waitFor(() => {
        expect(useUpdaterStore.getState().status).toBe('idle')
      })
      expect(useUpdaterStore.getState().skippedVersion).toBe('2.0.0')
    })

    it('calls updater.skip when skip is clicked with electronAPI', async () => {
      const skip = vi.fn().mockResolvedValue(undefined)
      const mockUpdater = createMockUpdater({ skip })
      mockElectronAPI(mockUpdater)
      render(<UpdateNotification />)
      await act(async () => {
        fireEvent.click(screen.getByText(/skip this version/i))
      })
      await vi.waitFor(() => {
        expect(skip).toHaveBeenCalledWith('2.0.0')
      })
    })
  })

  describe('downloading state', () => {
    beforeEach(() => {
      useUpdaterStore.setState({
        status: 'downloading',
        version: '2.0.0',
        progress: 42,
        downloadSpeed: 2_500_000, // 2.5 MB/s
        downloadedBytes: 21_000_000, // 21 MB
        totalBytes: 50_000_000, // 50 MB
      })
    })

    it('renders downloading state with progress', () => {
      render(<UpdateNotification />)
      expect(screen.getByText(/downloading v2\.0\.0/i)).toBeInTheDocument()
    })

    it('renders progress bar with aria attributes', () => {
      render(<UpdateNotification />)
      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toBeInTheDocument()
      expect(progressbar).toHaveAttribute('aria-valuenow', '42')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
    })

    it('shows downloaded / total bytes', () => {
      render(<UpdateNotification />)
      expect(screen.getByText(/21\.0 MB \/ 50\.0 MB/i)).toBeInTheDocument()
    })

    it('shows download speed', () => {
      render(<UpdateNotification />)
      expect(screen.getByText(/2\.5 MB\/s/i)).toBeInTheDocument()
    })

    it('shows percentage', () => {
      render(<UpdateNotification />)
      expect(screen.getByText(/42%/i)).toBeInTheDocument()
    })

    it('does not show Download button while downloading', () => {
      render(<UpdateNotification />)
      expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument()
    })

    it('does not show Skip while downloading', () => {
      render(<UpdateNotification />)
      expect(screen.queryByText(/skip this version/i)).not.toBeInTheDocument()
    })
  })

  describe('downloaded state', () => {
    beforeEach(() => {
      useUpdaterStore.setState({
        status: 'downloaded',
        version: '2.0.0',
        progress: 100,
      })
    })

    it('renders downloaded banner with version', () => {
      render(<UpdateNotification />)
      expect(screen.getByText(/update v2\.0\.0 ready/i)).toBeInTheDocument()
      expect(screen.getByText(/restart the app/i)).toBeInTheDocument()
    })

    it('renders Restart & Install button', () => {
      render(<UpdateNotification />)
      expect(screen.getByRole('button', { name: /restart & install/i })).toBeInTheDocument()
    })

    it('has role="alert"', () => {
      render(<UpdateNotification />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('has aria-live="assertive" for critical update', () => {
      render(<UpdateNotification />)
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
    })

    it('dismisses when close button is clicked', () => {
      render(<UpdateNotification />)
      fireEvent.click(screen.getByLabelText('Dismiss'))
      expect(useUpdaterStore.getState().status).toBe('idle')
    })

    it('triggers install when Restart & Install is clicked with electronAPI', async () => {
      const install = vi.fn().mockResolvedValue(undefined)
      const mockUpdater = createMockUpdater({ install })
      mockElectronAPI(mockUpdater)
      render(<UpdateNotification />)
      fireEvent.click(screen.getByRole('button', { name: /restart & install/i }))
      await vi.waitFor(() => {
        expect(install).toHaveBeenCalledOnce()
      })
    })
  })

  describe('error state', () => {
    beforeEach(() => {
      useUpdaterStore.setState({
        status: 'error',
        errorMessage: 'Network error: failed to connect',
      })
    })

    it('renders error banner with message', () => {
      render(<UpdateNotification />)
      expect(screen.getByText(/update failed/i)).toBeInTheDocument()
      expect(screen.getByText(/network error: failed to connect/i)).toBeInTheDocument()
    })

    it('renders Retry button', () => {
      render(<UpdateNotification />)
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('has role="alert"', () => {
      render(<UpdateNotification />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('calls onCheck when Retry is clicked and onCheck is provided', () => {
      const onCheck = vi.fn()
      render(<UpdateNotification onCheck={onCheck} />)
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(onCheck).toHaveBeenCalledOnce()
    })

    it('calls checkForUpdates when Retry is clicked and no onCheck prop', async () => {
      // Mock electronAPI so checkForUpdates works
      const check = vi.fn().mockResolvedValue({ available: false })
      const mockUpdater = createMockUpdater({ check })
      mockElectronAPI(mockUpdater)
      render(<UpdateNotification />)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      })
      // checkForUpdates was called (the mock resolves immediately, ending as not-available)
      expect(check).toHaveBeenCalledOnce()
      // After the async check resolves, status becomes 'not-available' (no update found)
      await vi.waitFor(() => {
        expect(useUpdaterStore.getState().status).toBe('not-available')
      })
    })

    it('dismisses when close button is clicked', () => {
      render(<UpdateNotification />)
      fireEvent.click(screen.getByLabelText('Dismiss'))
      expect(useUpdaterStore.getState().status).toBe('idle')
    })
  })

  describe('not-available state', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      useUpdaterStore.setState({
        status: 'not-available',
      })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('renders up-to-date message', () => {
      render(<UpdateNotification />)
      expect(screen.getByText(/you're up to date!/i)).toBeInTheDocument()
    })

    it('has role="status" with aria-live="polite"', () => {
      render(<UpdateNotification />)
      const el = screen.getByRole('status')
      expect(el).toBeInTheDocument()
      expect(el).toHaveAttribute('aria-live', 'polite')
    })

    it('auto-dismisses after 3 seconds', () => {
      render(<UpdateNotification />)
      expect(screen.getByText(/you're up to date!/i)).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(useUpdaterStore.getState().status).toBe('idle')
    })
  })

  describe('CheckForUpdatesButton', () => {
    it('renders with default text', () => {
      render(<CheckForUpdatesButton />)
      expect(screen.getByText(/check for updates/i)).toBeInTheDocument()
    })

    it('is clickable by default', () => {
      const onClick = vi.fn()
      render(<CheckForUpdatesButton onClick={onClick} />)
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledOnce()
    })

    it('shows loading state when checking', () => {
      useUpdaterStore.setState({ status: 'checking' })
      render(<CheckForUpdatesButton />)
      expect(screen.getByText(/checking…/i)).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('has proper aria-label', () => {
      render(<CheckForUpdatesButton />)
      expect(screen.getByLabelText('Check for Updates')).toBeInTheDocument()
    })
  })
})
