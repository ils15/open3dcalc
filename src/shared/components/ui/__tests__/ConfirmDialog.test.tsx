import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
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

  it('moves focus to the confirm button once opened', async () => {
    render(
      <ConfirmDialog open={true} message="Test" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus(),
    )
  })

  // Companion to the restoration tests: the 50ms focus timer must still fire
  // while the dialog is open, so the fix above cannot be "solved" by deleting
  // the timer — only by cancelling it correctly on close.
  it('still focuses the confirm button 50ms after opening', async () => {
    render(
      <ConfirmDialog open={true} message="Test" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(document.body).toHaveFocus()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80))
    })
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus()
  })

  it('cancels the pending focus timer when closed before it fires', async () => {
    const { rerender } = render(
      <ConfirmDialog open={true} message="Test" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    // Close immediately, before the 50ms focus timer can run.
    rerender(
      <ConfirmDialog open={false} message="Test" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400))
    })
    // Focus must not have been moved to the (now closing) confirm button.
    expect(document.body).toHaveFocus()
  })
})
