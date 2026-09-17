import { useState, useRef, useEffect } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import type { Placement } from "@floating-ui/react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  placement?: Placement;
  delay?: number;
  className?: string;
}

/**
 * Seletor de elementos naturalmente focáveis. Usado para decidir se o wrapper
 * do tooltip precisa de `tabIndex`: WCAG AA 1.4.13 exige que o conteúdo apareça
 * também no foco do teclado, mas não devemos criar um tab stop extra quando o
 * filho já é interativo (botão/link).
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

export function Tooltip({
  content,
  children,
  placement = "top",
  delay = 400,
  className = "",
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  // False enquanto não sabemos se o trigger é naturalmente focável.
  const [needsTabIndex, setNeedsTabIndex] = useState(false);

  const { x, y, strategy, refs, context } = useFloating({
    placement,
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(6), flip(), shift({ padding: 4 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    move: false,
    delay: { open: delay, close: delay },
  });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  const referenceRef = useRef<HTMLSpanElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (referenceRef.current) {
      refs.setReference(referenceRef.current);
    }
    if (floatingRef.current) {
      refs.setFloating(floatingRef.current);
    }
  });

  // WCAG AA 1.4.13: tab stop extra apenas quando o trigger não é
  // naturalmente focável — medição única no mount (DOM é estático).
  useEffect(() => {
    if (referenceRef.current) {
      setNeedsTabIndex(
        referenceRef.current.querySelector(FOCUSABLE_SELECTOR) === null,
      );
    }
  }, []);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        ref={referenceRef}
        {...getReferenceProps()}
        tabIndex={needsTabIndex ? 0 : undefined}
        className={`inline-flex ${className}`}
      >
        {children}
      </span>
      <FloatingPortal>
        <div
          ref={floatingRef}
          style={{
            position: strategy,
            top: y ?? 0,
            left: x ?? 0,
            zIndex: 100,
            ...(!isOpen && { visibility: "hidden", pointerEvents: "none" }),
          }}
          {...getFloatingProps()}
          className="w-56 p-2.5 bg-[var(--color-bg-elevated)] text-[11px] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] shadow-2xl leading-relaxed pointer-events-none select-none"
        >
          {content}
        </div>
      </FloatingPortal>
    </>
  );
}
