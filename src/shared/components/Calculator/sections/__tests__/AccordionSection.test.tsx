import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccordionSection } from '../AccordionSection'

describe('AccordionSection', () => {
  const defaultProps = {
    id: 'test-section',
    title: 'Test Title',
    icon: <span data-testid="test-icon">🔧</span>,
    children: <div data-testid="accordion-content">Content</div>,
  }

  it('renders title and icon', () => {
    render(<AccordionSection {...defaultProps} />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
  })

  it('is closed by default', () => {
    render(<AccordionSection {...defaultProps} />)
    const content = screen.getByTestId('accordion-content')
    // Content should exist but be visually hidden
    const container = content.parentElement
    expect(container).toHaveClass('max-h-0')
    expect(container).toHaveClass('opacity-0')
  })

  it('opens when toggle is clicked', () => {
    render(<AccordionSection {...defaultProps} />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    const container = screen.getByTestId('accordion-content').parentElement
    expect(container).toHaveClass('opacity-100')
    expect(container).toHaveClass('max-h-[2000px]')
    expect(container).toHaveClass('mb-4')
  })

  it('toggles open/close on click', () => {
    render(<AccordionSection {...defaultProps} />)
    const button = screen.getByRole('button')
    // Open
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    // Close
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('starts open when defaultOpen is true', () => {
    render(<AccordionSection {...defaultProps} defaultOpen={true} />)
    const container = screen.getByTestId('accordion-content').parentElement
    expect(container).toHaveClass('opacity-100')
    expect(container).toHaveClass('max-h-[2000px]')
  })

  it('renders children', () => {
    render(
      <AccordionSection {...defaultProps} defaultOpen={true}>
        <div data-testid="child-content">Child Content</div>
      </AccordionSection>,
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Child Content')).toBeInTheDocument()
  })
})
