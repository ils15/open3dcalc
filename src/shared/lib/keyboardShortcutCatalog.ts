/**
 * The app's global keyboard shortcuts, declared once.
 *
 * `useKeyboardShortcuts` takes handlers, so a shortcut is only "listed"
 * information until something renders it. That is what the keyboard-shortcuts
 * dialog needs, and duplicating the list there would drift from the three
 * bindings `Calculator` actually registers — a help modal that lies is worse
 * than none.
 *
 * So the DECLARATION lives here (key, modifiers, label key) and the handlers
 * live beside it in `Calculator`, which is the only consumer that owns them.
 * The dialog reads this; the Calculator maps it.
 *
 * The action name is a KEY, not a string: a Portuguese literal here would ship
 * to an en-US user and would have to be re-edited when the copy is revised.
 */
export interface ShortcutDeclaration {
  /** Stable id, also used as the React key and the test handle. */
  readonly id: string;
  readonly key: string;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
  /** i18n key for the human-readable action name shown in the dialog. */
  readonly labelKey: string;
}

export const SHORTCUTS: readonly ShortcutDeclaration[] = [
  { id: "undo", key: "z", ctrl: true, labelKey: "quickActions.shortcutUndo" },
  {
    id: "export",
    key: "e",
    ctrl: true,
    labelKey: "quickActions.shortcutExport",
  },
  {
    id: "print",
    key: "p",
    ctrl: true,
    labelKey: "quickActions.shortcutPrint",
  },
];

/** Renders a declaration as the chord a user types, e.g. `Ctrl+Z`. */
export function formatChord(shortcut: ShortcutDeclaration): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  parts.push(shortcut.key.toUpperCase());
  return parts.join("+");
}
