import { useEffect, useRef } from "react";

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

/**
 * Registers global keyboard shortcuts.
 *
 * Shortcuts are suppressed when the user is typing in `<input>`, `<textarea>`,
 * or `contentEditable` elements to avoid accidental triggers.
 *
 * Uses a ref internally so the event listener is registered only once and
 * always has access to the latest handlers — no need to memoize `shortcuts`.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const shortcutsRef = useRef(shortcuts);

  // Sync ref after render, not during render — avoids react-hooks/refs lint error
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const s of shortcutsRef.current) {
        const ctrl = s.ctrl ?? false;
        const shift = s.shift ?? false;
        const alt = s.alt ?? false;

        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          e.ctrlKey === ctrl &&
          e.shiftKey === shift &&
          e.altKey === alt
        ) {
          // Don't trigger when typing in inputs — let the browser handle
          // native text editing (e.g. Ctrl+Z undo inside a text field).
          if (isEditableTarget(e.target)) {
            continue;
          }

          e.preventDefault();
          s.handler();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

/**
 * True when the event target is a text-editing surface: `<input>`,
 * `<textarea>`, or a `contentEditable` element. Checks both the
 * `isContentEditable` property (real browsers) and the `contenteditable`
 * attribute (covers jsdom and elements where the property is not computed).
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  const attr = target.getAttribute("contenteditable");
  return attr !== null && attr !== "false";
}
