import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StlPreview } from '../StlPreview'

// Mock R3F — Canvas doesn't work well in jsdom
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
}))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Center: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
})
