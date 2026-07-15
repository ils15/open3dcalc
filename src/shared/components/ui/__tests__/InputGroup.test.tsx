import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { InputGroup } from '../InputGroup'

describe('InputGroup', () => {
  it('renders label and input', () => {
    render(<InputGroup label="Test Label" value="" onChange={vi.fn()} />)
    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders number input when type is number', () => {
    render(<InputGroup label="Number" value={42} onChange={vi.fn()} type="number" />)
    const input = screen.getByRole('spinbutton')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue(42)
  })

  it('calls onChange when input value changes', () => {
    const onChange = vi.fn()
    render(<InputGroup label="Test" value="" onChange={onChange} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'new value' } })
    expect(onChange).toHaveBeenCalledWith('new value')
  })

  it('renders unit suffix when provided', () => {
    render(<InputGroup label="Test" value="" onChange={vi.fn()} unit="kg" />)
    expect(screen.getByText('kg')).toBeInTheDocument()
  })

  it('renders prefix when provided', () => {
    render(<InputGroup label="Test" value="" onChange={vi.fn()} prefix="R$" />)
    expect(screen.getByText('R$')).toBeInTheDocument()
  })

  it('renders placeholder text', () => {
    render(<InputGroup label="Test" value="" onChange={vi.fn()} placeholder="Enter value" />)
    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument()
  })

  it('renders error message when provided', () => {
    render(<InputGroup label="Test" value="" onChange={vi.fn()} error="Invalid value" />)
    expect(screen.getByText('Invalid value')).toBeInTheDocument()
  })

  it('renders tooltip icon when tooltip is provided', () => {
    render(<InputGroup label="Test" value="" onChange={vi.fn()} tooltip="Help text" />)
    // Tooltip renders an Info icon
    const infoIcon = document.querySelector('.lucide-info')
    expect(infoIcon).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <InputGroup label="Test" value="" onChange={vi.fn()} className="custom-class" />,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('custom-class')
  })
})
