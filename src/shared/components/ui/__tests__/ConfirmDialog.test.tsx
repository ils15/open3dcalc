import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConfirmDialog } from '../ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders message and buttons when open', () => {
    render(
      <ConfirmDialog open={true} message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('renders custom button labels', () => {
    render(
      <ConfirmDialog
        open={true}
        message="Test"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog open={true} message="Test" onConfirm={onConfirm} onCancel={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog open={true} message="Test" onConfirm={vi.fn()} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when backdrop is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog open={true} message="Test" onConfirm={vi.fn()} onCancel={onCancel} />,
    )
    const backdrop = screen.getByRole('dialog')
    fireEvent.click(backdrop)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders custom title', () => {
    render(
      <ConfirmDialog open={true} title="Delete Item" message="Test" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('Delete Item')).toBeInTheDocument()
  })

  it('has correct aria attributes', () => {
    render(
      <ConfirmDialog open={true} title="Warning" message="Test" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Warning')
  })

  it('renders close button with aria-label', () => {
    render(
      <ConfirmDialog open={true} message="Test" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByLabelText('Fechar')).toBeInTheDocument()
  })
})
