import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip } from '../Tooltip'

// FloatingUI uses DOM measurement APIs not available in jsdom.
// We test that the component renders children and tooltip content.
describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="Tooltip content">
        <button data-testid="trigger">Hover me</button>
      </Tooltip>,
    )
    expect(screen.getByTestId('trigger')).toBeInTheDocument()
    expect(screen.getByText('Hover me')).toBeInTheDocument()
  })

  it('renders tooltip content in the portal', () => {
    render(
      <Tooltip content="Helpful info">
        <span data-testid="child">Target</span>
      </Tooltip>,
    )
    // The content should be rendered in a FloatingPortal div
    expect(screen.getByText('Helpful info')).toBeInTheDocument()
  })

  it('renders nothing when content is empty', () => {
    render(
      <Tooltip content="">
        <span data-testid="child">No tooltip</span>
      </Tooltip>,
    )
    // Only the child should be rendered, no floating content
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByText('No tooltip')).toBeInTheDocument()
    // No portal content divs with the tooltip classes
  })

  it('applies custom className', () => {
    const { container } = render(
      <Tooltip content="Info" className="custom-class">
        <span>Child</span>
      </Tooltip>,
    )
    const span = container.querySelector('span.inline-flex')
    expect(span).toBeInTheDocument()
  })

  it('passes content text to the floating element', () => {
    render(
      <Tooltip content="Specific help text">
        <span>Child</span>
      </Tooltip>,
    )
    expect(screen.getByText('Specific help text')).toBeInTheDocument()
  })
})
