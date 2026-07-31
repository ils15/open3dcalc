import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Manages a dismissable popover/dropdown with:
 * - Escape to close (focus returns to the trigger)
 * - Click/touch outside to close
 * - Portal-friendly: pass `contentRef` to the portaled content node and
 *   `triggerRef` to the trigger button — both are checked by the outside
 *   click handler regardless of where the content is rendered.
 */
export function useDismissablePopover<T extends HTMLElement = HTMLButtonElement>(
  initialOpen = false,
) {
  const [open, setOpen] = useState(initialOpen)
  const triggerRef = useRef<T>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((v) => !v), [])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        triggerRef.current?.focus()
      }
    }
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (contentRef.current?.contains(target)) return
      close()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, close])

  return { open, setOpen, close, toggle, triggerRef, contentRef }
}
