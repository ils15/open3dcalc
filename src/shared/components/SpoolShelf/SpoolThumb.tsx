import { memo } from "react";

/**
 * Thumbnail do carretel (padrão OptionThumb do W10a).
 *
 * Renderiza o ícone da bobina na cor resolvida. Quando não há cor alguma
 * cadastrada (dado legado/importado), cai num monograma da marca — decoração
 * visual, `aria-hidden`, porque a informação já está no título do card.
 */
const FALLBACK_HEX = "#6366f1";

interface SpoolThumbProps {
  /** Hex armazenado do carretel; vazio cai no fallback. */
  hex: string;
  /** Texto-base do monograma quando não há cor. */
  monogramFrom: string;
  size?: number;
  className?: string;
}

function SpoolIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="10" cy="22" rx="8" ry="13" fill={color} opacity="0.9" />
      <ellipse cx="34" cy="22" rx="8" ry="13" fill={color} opacity="0.9" />
      <rect x="10" y="15" width="24" height="14" fill={color} opacity="0.25" />
      <rect
        x="10"
        y="17"
        width="24"
        height="3.5"
        rx="1"
        fill={color}
        opacity="0.55"
      />
      <rect
        x="10"
        y="23.5"
        width="24"
        height="3.5"
        rx="1"
        fill={color}
        opacity="0.55"
      />
      <circle cx="22" cy="22" r="3.5" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}

function getMonogram(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0].slice(0, 2).toUpperCase();
}

export const SpoolThumb = memo(function SpoolThumb({
  hex,
  monogramFrom,
  size = 44,
  className = "",
}: SpoolThumbProps) {
  const color = hex.trim();

  if (!color) {
    return (
      <div
        aria-hidden="true"
        className={`shrink-0 rounded-lg bg-[var(--color-accent)]/20 flex items-center justify-center font-bold text-[var(--color-accent)] leading-none select-none ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.2 }}
      >
        {getMonogram(monogramFrom)}
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 rounded-lg p-0.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] ${className}`}
      style={{ width: size, height: size }}
    >
      <SpoolIcon color={color} size={size - 4} />
    </div>
  );
});

export { FALLBACK_HEX };
