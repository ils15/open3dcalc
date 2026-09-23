/**
 * Social quote sharing — pure library (Wave 7-lib / ROADMAP Phase 7b).
 *
 * Generates **official, key-free** web intents and per-network copy for sharing
 * a quote. Generation is 100% local: no network call is ever made here — the
 * caller hands the returned URL to the OS/browser, which opens the intent.
 *
 * Capability reality (feasibility research, ROADMAP Phase 7b):
 * - WhatsApp  `https://api.whatsapp.com/send?text=`        — official, key-less
 * - Telegram  `https://t.me/share/url?url=&text=`           — official, key-less
 * - X         `https://twitter.com/intent/tweet?text=`      — official, ≤280 chars
 * - E-mail    `mailto:?subject=&body=`                      — universal
 * - Instagram / Facebook — **no** official caption-prefill URL, so they are
 *   `copyOnly`: `buildShareUrl` returns `null` and the UI offers the adapted
 *   copy instead. No undocumented/deep links are ever produced.
 *
 * Copy templates live in the dedicated i18next namespace `share`
 * (`src/shared/i18n/locales/share.pt-BR.json` / `.en-US.json`), separate from
 * the default `translation` locales. This module reads those files directly so
 * it stays pure and deterministic (no i18next init, no global state); the
 * namespace is also registered in `i18n.ts` for the UI wave.
 */

import sharePtBR from "@/shared/i18n/locales/share.pt-BR.json";
import shareEnUS from "@/shared/i18n/locales/share.en-US.json";

/** Networks supported by the sharing surface. */
export type ShareNetworkId =
  "whatsapp" | "telegram" | "x" | "email" | "instagram" | "facebook";

/** Locales with dedicated share copy. Anything else falls back to pt-BR. */
export type ShareLocale = "pt-BR" | "en-US";

/** Static descriptor of one sharing network (registry leaf). */
export interface ShareNetwork {
  readonly id: ShareNetworkId;
  readonly label: string;
  /** Character limit the network enforces (X = 280, Instagram caption = 2200). */
  readonly charLimit?: number;
  /** Whether the official intent can carry a URL alongside the text. */
  readonly supportsUrl: boolean;
  /** True when no official caption URL exists → copy-to-clipboard fallback. */
  readonly copyOnly: boolean;
}

/** Input to the share builders; only `text` is required. */
export interface SharePayload {
  readonly text: string;
  /** Calculation link (already produced by `calculationLink.ts`). */
  readonly url?: string;
  /** E-mail only; ignored by every other network. */
  readonly subject?: string;
}

/** Character accounting for UI counters/overflow warnings. */
export interface CharCount {
  readonly count: number;
  readonly limit: number;
  readonly overflow: number;
  readonly remaining: number;
}

/** Copy templates for one locale (mirrors the `share` i18next namespace). */
interface ShareTemplates {
  readonly fallback: string;
  readonly whatsapp: { readonly emoji: string; readonly linkLabel: string };
  readonly telegram: { readonly emoji: string; readonly linkLabel: string };
  readonly x: { readonly hashtags: readonly string[] };
  readonly instagram: { readonly hashtags: readonly string[] };
  readonly facebook: { readonly emoji: string; readonly linkLabel: string };
  readonly email: {
    readonly subject: string;
    readonly intro: string;
    readonly linkLabel: string;
    readonly signoff: string;
  };
}

const templates: Record<ShareLocale, ShareTemplates> = {
  "pt-BR": sharePtBR as ShareTemplates,
  "en-US": shareEnUS as ShareTemplates,
};

/** App default locale; used by the locale-less `buildShareUrl` and as fallback. */
const DEFAULT_LOCALE: ShareLocale = "pt-BR";

/** X (Twitter) hard per-post limit. */
export const X_CHAR_LIMIT = 280;

/**
 * Practical Instagram caption limit. The API technically accepts 2200
 * characters; beyond that the app truncates the caption, so the counter warns
 * early instead of promising a caption the network will cut.
 */
export const INSTAGRAM_CAPTION_LIMIT = 2200;

/** Official web-intent endpoints. */
const WHATSAPP_ENDPOINT = "https://api.whatsapp.com/send";
const TELEGRAM_ENDPOINT = "https://t.me/share/url";
const X_ENDPOINT = "https://twitter.com/intent/tweet";

/**
 * Typed registry of the six networks. `copyOnly` drives the honest null return
 * in `buildShareUrl`; `charLimit` feeds UI counters via `CHAR_LIMITS`.
 */
export const SHARE_NETWORKS: Readonly<Record<ShareNetworkId, ShareNetwork>> = {
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    supportsUrl: true,
    copyOnly: false,
  },
  telegram: {
    id: "telegram",
    label: "Telegram",
    supportsUrl: true,
    copyOnly: false,
  },
  x: {
    id: "x",
    label: "X",
    charLimit: X_CHAR_LIMIT,
    supportsUrl: true,
    copyOnly: false,
  },
  email: { id: "email", label: "E-mail", supportsUrl: true, copyOnly: false },
  instagram: {
    id: "instagram",
    label: "Instagram",
    charLimit: INSTAGRAM_CAPTION_LIMIT,
    supportsUrl: false,
    copyOnly: true,
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    supportsUrl: false,
    copyOnly: true,
  },
};

/** Per-network character limits for UI counters; `undefined` means unlimited. */
export const CHAR_LIMITS: Readonly<Record<ShareNetworkId, number | undefined>> =
  {
    whatsapp: undefined,
    telegram: undefined,
    x: X_CHAR_LIMIT,
    email: undefined,
    instagram: INSTAGRAM_CAPTION_LIMIT,
    facebook: undefined,
  };

/**
 * Coerces an untrusted payload value into a string (never throws on NaN /
 * undefined / null), returning "" for anything that is not already a string.
 */
function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Returns the value when it carries visible content, otherwise the fallback —
 * so an empty/whitespace/absent message still yields a shareable line.
 */
function coalesceText(value: unknown, fallback: string): string {
  const text = toText(value);
  return text.trim().length > 0 ? text : fallback;
}

/**
 * Collapses line breaks and runs of whitespace into single spaces. X cannot
 * render newlines in a tweet, so its copy is always flattened to one line.
 */
function singleLine(text: string): string {
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function templatesFor(locale: ShareLocale | undefined): ShareTemplates {
  return (locale && templates[locale]) || templates[DEFAULT_LOCALE];
}

/**
 * Builds a chat-style copy: message + emoji, then the link label and URL on
 * their own lines when a URL is present (WhatsApp, Telegram, Facebook).
 */
function chatCopy(
  text: string,
  url: string,
  tmpl: { readonly emoji: string; readonly linkLabel: string },
): string {
  const head = `${text} ${tmpl.emoji}`;
  if (!url) return head;
  return `${head}\n${tmpl.linkLabel}\n${url}`;
}

/**
 * Builds an X tweet: single-line message + URL + hashtags, hard-capped at 280.
 * An over-long message is truncated with an ellipsis so the hashtags and link
 * always survive and the result never exceeds the limit.
 */
function xCopy(text: string, url: string, tmpl: ShareTemplates): string {
  const core = singleLine(text);
  const tags = tmpl.x.hashtags.join(" ");
  const tail = `${url ? ` ${url}` : ""}${tags ? ` ${tags}` : ""}`;
  const budget = X_CHAR_LIMIT - tail.length;

  let body: string;
  if (budget <= 0) {
    body = core;
  } else if (core.length > budget) {
    body = `${core.slice(0, Math.max(0, budget - 1)).trimEnd()}…`;
  } else {
    body = core;
  }

  // Defensive last resort: a pathological URL/hashtag set can still overflow.
  return `${body}${tail}`.slice(0, X_CHAR_LIMIT);
}

/**
 * Builds an Instagram caption: message (+ URL on its own line), a blank line,
 * then the hashtag block always last.
 */
function instagramCopy(
  text: string,
  url: string,
  tmpl: ShareTemplates,
): string {
  const tags = tmpl.instagram.hashtags.join(" ");
  const head = url ? `${text}\n${url}` : text;
  return `${head}\n\n${tags}`;
}

/**
 * Builds a structured e-mail body: greeting, message, optional link block, and
 * a signoff line.
 */
function emailCopy(text: string, url: string, tmpl: ShareTemplates): string {
  const lines = [tmpl.email.intro, "", text];
  if (url) {
    lines.push("", tmpl.email.linkLabel, url);
  }
  lines.push("", tmpl.email.signoff);
  return lines.join("\n");
}

/**
 * Builds the **official** share URL for a network.
 *
 * @returns The web-intent URL with correctly encoded params, or `null` when the
 * network is copy-only (Instagram/Facebook) or unknown — the caller must then
 * fall back to `buildShareCopy`. No network call is made; the browser/OS opens
 * the intent.
 */
export function buildShareUrl(
  network: ShareNetworkId,
  payload: SharePayload,
): string | null {
  const config = SHARE_NETWORKS[network];
  if (!config || config.copyOnly) return null;

  const tmpl = templatesFor(DEFAULT_LOCALE);
  const text = coalesceText(payload?.text, tmpl.fallback);
  const url = toText(payload?.url).trim();

  switch (network) {
    case "whatsapp": {
      const body = url ? `${text}\n${url}` : text;
      return `${WHATSAPP_ENDPOINT}?text=${encodeURIComponent(body)}`;
    }
    case "telegram": {
      return (
        `${TELEGRAM_ENDPOINT}?url=${encodeURIComponent(url)}` +
        `&text=${encodeURIComponent(text)}`
      );
    }
    case "x": {
      const body = buildShareCopy("x", payload, DEFAULT_LOCALE);
      return `${X_ENDPOINT}?text=${encodeURIComponent(body)}`;
    }
    case "email": {
      const subject = coalesceText(payload?.subject, tmpl.email.subject);
      const body = url ? `${text}\n\n${url}` : text;
      return (
        `mailto:?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`
      );
    }
    default:
      return null;
  }
}

/**
 * Builds network-adapted copy in the requested locale (falls back to pt-BR).
 *
 * - WhatsApp / Telegram / Facebook: plain text, line breaks, moderate emoji.
 * - X: single line, hashtags, hard-capped at 280 characters.
 * - Instagram: caption with line breaks and a trailing hashtag block.
 * - E-mail: structured body (greeting, message, link, signoff).
 * - Unknown networks: generic plain text + URL.
 */
export function buildShareCopy(
  network: ShareNetworkId,
  payload: SharePayload,
  locale: ShareLocale = DEFAULT_LOCALE,
): string {
  const tmpl = templatesFor(locale);
  const text = coalesceText(payload?.text, tmpl.fallback);
  const url = toText(payload?.url).trim();

  switch (network) {
    case "whatsapp":
      return chatCopy(text, url, tmpl.whatsapp);
    case "telegram":
      return chatCopy(text, url, tmpl.telegram);
    case "facebook":
      return chatCopy(text, url, tmpl.facebook);
    case "x":
      return xCopy(text, url, tmpl);
    case "instagram":
      return instagramCopy(text, url, tmpl);
    case "email":
      return emailCopy(text, url, tmpl);
    default:
      return url ? `${text}\n${url}` : text;
  }
}

/**
 * Counts characters against a limit so the UI can warn about overflow
 * (X truncation, Instagram caption cut). Non-string text counts as 0 and a
 * non-finite/non-positive limit is neutralized to 0 — never NaN/Infinity.
 */
export function countChars(text: string, limit: number): CharCount {
  const count = typeof text === "string" ? text.length : 0;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
  return {
    count,
    limit: safeLimit,
    overflow: Math.max(0, count - safeLimit),
    remaining: safeLimit - count,
  };
}
