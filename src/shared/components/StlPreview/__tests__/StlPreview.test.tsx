import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StlPreview } from '../StlPreview'

// Mock R3F — Canvas doesn't work well in jsdom
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
}))

// Expose the mocked Bounds API so tests can assert fit() is invoked
const { mockBounds } = vi.hoisted(() => ({
  mockBounds: {
    fit: vi.fn(),
    refresh: vi.fn(),
    clip: vi.fn(),
    reset: vi.fn(),
    getSize: vi.fn(),
  },
}))

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Center: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bounds: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBounds: () => mockBounds,
  MeshStandardMaterial: () => null,
  MeshBasicMaterial: () => null,
}))

// Mock Three.js loaders
vi.mock('three/examples/jsm/loaders/STLLoader', () => ({ STLLoader: vi.fn() }))
vi.mock('three/examples/jsm/loaders/OBJLoader', () => ({ OBJLoader: vi.fn() }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockGeometry(overrides: Record<string, any> = {}): any {
  return {
    type: 'BufferGeometry',
    uuid: 'test-uuid',
    clone: vi.fn().mockReturnThis(),
    ...overrides,
  }
}

describe('StlPreview', () => {
  const mockOnFileParsed = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders upload zone when no file', () => {
    render(<StlPreview onFileParsed={mockOnFileParsed} />)
    // The button shows either stl.dropzone or stl.tapToSelect depending on env
    const uploadButton = screen.getByRole('button', { name: /stl\./ })
    expect(uploadButton).toBeInTheDocument()
  })

  it('has a hidden file input', () => {
    render(<StlPreview onFileParsed={mockOnFileParsed} />)
    const input = document.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('accept', expect.stringContaining('.stl'))
  })

  it('renders without crashing when onFileParsed is provided', () => {
    render(<StlPreview onFileParsed={mockOnFileParsed} />)
    const uploadButton = screen.getByRole('button', { name: /stl\./ })
    expect(uploadButton).toBeInTheDocument()
  })

  it('shows 3D canvas when initialGeometry is provided', () => {
    const mockGeometry = createMockGeometry()
    render(<StlPreview initialGeometry={mockGeometry} onFileParsed={mockOnFileParsed} />)
    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
  })

  it('renders model info panel when modelInfo is available after parsing', () => {
    // With initialGeometry, the canvas shows
    const mockGeometry = createMockGeometry()
    render(<StlPreview initialGeometry={mockGeometry} onFileParsed={mockOnFileParsed} />)
    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
  })

  it('shows upload zone button text', () => {
    render(<StlPreview onFileParsed={mockOnFileParsed} />)
    const uploadButton = screen.getByRole('button', { name: /stl\./ })
    expect(uploadButton).toBeInTheDocument()
  })

  it('renders a fit button when geometry is present', () => {
    render(<StlPreview initialGeometry={createMockGeometry()} onFileParsed={mockOnFileParsed} />)
    expect(screen.getByRole('button', { name: 'stl.fit' })).toBeInTheDocument()
  })

  it('calls the bounds fit API when fit button is clicked', async () => {
    const user = userEvent.setup()
    render(<StlPreview initialGeometry={createMockGeometry()} onFileParsed={mockOnFileParsed} />)
    await user.click(screen.getByRole('button', { name: 'stl.fit' }))
    expect(mockBounds.fit).toHaveBeenCalled()
  })

  it('shows a clear button when geometry is present', () => {
    render(<StlPreview initialGeometry={createMockGeometry()} onFileParsed={mockOnFileParsed} />)
    expect(screen.getByRole('button', { name: 'stl.clear' })).toBeInTheDocument()
  })

  it('clears the model and calls onClear', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <StlPreview
        initialGeometry={createMockGeometry()}
        onFileParsed={mockOnFileParsed}
        onClear={onClear}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'stl.clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
    // Canvas is removed and the upload zone comes back
    expect(screen.queryByTestId('r3f-canvas')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stl\./ })).toBeInTheDocument()
  })

  it('opens a fullscreen portal overlay and closes it', async () => {
    const user = userEvent.setup()
    render(<StlPreview initialGeometry={createMockGeometry()} onFileParsed={mockOnFileParsed} />)

    await user.click(screen.getByRole('button', { name: 'stl.fullscreen' }))

    // Portal overlay rendered into document.body with dialog semantics
    const overlay = document.querySelector('.fixed.inset-0')
    expect(overlay).not.toBeNull()
    expect(overlay).toHaveAttribute('role', 'dialog')
    expect(screen.getByRole('button', { name: 'stl.exitFullscreen' })).toBeInTheDocument()
    // Inline preview hidden while fullscreen
    expect(screen.queryByRole('button', { name: 'stl.fullscreen' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'stl.exitFullscreen' }))
    expect(screen.queryByRole('button', { name: 'stl.exitFullscreen' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'stl.fullscreen' })).toBeInTheDocument()
  })

  it('exits fullscreen on Escape key', async () => {
    const user = userEvent.setup()
    render(<StlPreview initialGeometry={createMockGeometry()} onFileParsed={mockOnFileParsed} />)

    await user.click(screen.getByRole('button', { name: 'stl.fullscreen' }))
    expect(screen.getByRole('button', { name: 'stl.exitFullscreen' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'stl.exitFullscreen' })).not.toBeInTheDocument()
  })

  it('keeps fit and clear buttons visible inside fullscreen overlay', async () => {
    const user = userEvent.setup()
    render(<StlPreview initialGeometry={createMockGeometry()} onFileParsed={mockOnFileParsed} />)

    await user.click(screen.getByRole('button', { name: 'stl.fullscreen' }))
    expect(screen.getByRole('button', { name: 'stl.fit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'stl.clear' })).toBeInTheDocument()
  })
})
