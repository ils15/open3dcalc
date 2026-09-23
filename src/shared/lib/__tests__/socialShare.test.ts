import { describe, it, expect } from "vitest";

import {
  SHARE_NETWORKS,
  CHAR_LIMITS,
  X_CHAR_LIMIT,
  INSTAGRAM_CAPTION_LIMIT,
  buildShareUrl,
  buildShareCopy,
  countChars,
} from "@/shared/lib/socialShare";
import type {
  ShareNetworkId,
  ShareLocale,
  SharePayload,
} from "@/shared/lib/socialShare";
import sharePtBR from "@/shared/i18n/locales/share.pt-BR.json";
import shareEnUS from "@/shared/i18n/locales/share.en-US.json";

/**
 * Decodes a single query-string parameter from a generated share URL. Pairs are
 * split on raw `&`, which is safe because encodeURIComponent escapes every `&`
 * inside a value to `%26`.
 */
function param(url: string, key: string): string {
  const marker = url.indexOf("?");
  if (marker === -1) return "";
  const query = url.slice(marker + 1);
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    if (eq !== -1 && pair.slice(0, eq) === key) {
      return decodeURIComponent(pair.slice(eq + 1));
    }
  }
  return "";
}

const SAMPLE_TEXT = "Peca articulada — custo R$ 42,90 & lucro de 30%";
const SAMPLE_URL = "https://open3dcalc.app/#calc=abc123";

// ---------------------------------------------------------------------------
// SHARE_NETWORKS registry
// ---------------------------------------------------------------------------

describe("SHARE_NETWORKS", () => {
  it("covers exactly the six verified networks", () => {
    expect(Object.keys(SHARE_NETWORKS).sort()).toEqual(
      ["email", "facebook", "instagram", "telegram", "whatsapp", "x"].sort(),
    );
  });

  it("is a self-consistent static leaf: id matches the key", () => {
    for (const [id, network] of Object.entries(SHARE_NETWORKS)) {
      expect(network.id).toBe(id);
      expect(network.label.trim().length).toBeGreaterThan(0);
      expect(typeof network.supportsUrl).toBe("boolean");
      expect(typeof network.copyOnly).toBe("boolean");
    }
  });

  it("marks Instagram and Facebook as copy-only (no official caption URL)", () => {
    expect(SHARE_NETWORKS.instagram.copyOnly).toBe(true);
    expect(SHARE_NETWORKS.facebook.copyOnly).toBe(true);
    expect(SHARE_NETWORKS.instagram.supportsUrl).toBe(false);
    expect(SHARE_NETWORKS.facebook.supportsUrl).toBe(false);
  });

  it("exposes the four official web-intent networks as non-copy-only", () => {
    for (const id of [
      "whatsapp",
      "telegram",
      "x",
      "email",
    ] as ShareNetworkId[]) {
      expect(SHARE_NETWORKS[id].copyOnly).toBe(false);
      expect(SHARE_NETWORKS[id].supportsUrl).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// CHAR_LIMITS
// ---------------------------------------------------------------------------

describe("CHAR_LIMITS", () => {
  it("enforces X at 280 characters", () => {
    expect(CHAR_LIMITS.x).toBe(280);
    expect(X_CHAR_LIMIT).toBe(280);
  });

  it("documents the Instagram practical caption limit at 2200", () => {
    expect(CHAR_LIMITS.instagram).toBe(2200);
    expect(INSTAGRAM_CAPTION_LIMIT).toBe(2200);
  });

  it("leaves the remaining networks unlimited (undefined)", () => {
    expect(CHAR_LIMITS.whatsapp).toBeUndefined();
    expect(CHAR_LIMITS.telegram).toBeUndefined();
    expect(CHAR_LIMITS.email).toBeUndefined();
    expect(CHAR_LIMITS.facebook).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildShareUrl — official web intents
// ---------------------------------------------------------------------------

describe("buildShareUrl", () => {
  it("builds the official WhatsApp endpoint with text + url in the body", () => {
    const url = buildShareUrl("whatsapp", {
      text: SAMPLE_TEXT,
      url: SAMPLE_URL,
    });
    expect(url).toContain("https://api.whatsapp.com/send?text=");
    expect(param(url as string, "text")).toBe(`${SAMPLE_TEXT}\n${SAMPLE_URL}`);
  });

  it("builds the official Telegram share endpoint with url + text params", () => {
    const url = buildShareUrl("telegram", {
      text: SAMPLE_TEXT,
      url: SAMPLE_URL,
    });
    expect(url).toContain("https://t.me/share/url?");
    expect(param(url as string, "url")).toBe(SAMPLE_URL);
    expect(param(url as string, "text")).toBe(SAMPLE_TEXT);
  });

  it("builds the official X web intent with the tweet-shaped copy", () => {
    const url = buildShareUrl("x", { text: SAMPLE_TEXT, url: SAMPLE_URL });
    expect(url).toContain("https://twitter.com/intent/tweet?text=");
    const body = param(url as string, "text");
    expect(body).toContain(SAMPLE_TEXT);
    expect(body).toContain(SAMPLE_URL);
    expect(body).not.toContain("\n");
  });

  it("builds a mailto with subject + body, url folded into the body", () => {
    const url = buildShareUrl("email", {
      text: SAMPLE_TEXT,
      url: SAMPLE_URL,
      subject: "Meu orcamento",
    });
    expect(url).toMatch(/^mailto:\?subject=/);
    expect(param(url as string, "subject")).toBe("Meu orcamento");
    expect(param(url as string, "body")).toBe(
      `${SAMPLE_TEXT}\n\n${SAMPLE_URL}`,
    );
  });

  it("falls back to the template email subject when none is provided", () => {
    const url = buildShareUrl("email", { text: SAMPLE_TEXT });
    expect(param(url as string, "subject")).toBe(sharePtBR.email.subject);
  });

  it("returns null for copy-only networks instead of a fake deep link", () => {
    expect(buildShareUrl("instagram", { text: SAMPLE_TEXT })).toBeNull();
    expect(
      buildShareUrl("instagram", { text: SAMPLE_TEXT, url: SAMPLE_URL }),
    ).toBeNull();
    expect(buildShareUrl("facebook", { text: SAMPLE_TEXT })).toBeNull();
    expect(
      buildShareUrl("facebook", { text: SAMPLE_TEXT, url: SAMPLE_URL }),
    ).toBeNull();
  });

  it("returns null for unknown network ids", () => {
    expect(
      buildShareUrl("snapchat" as ShareNetworkId, { text: SAMPLE_TEXT }),
    ).toBeNull();
  });

  it("uses the pt-BR fallback text when the payload text is empty", () => {
    const url = buildShareUrl("whatsapp", { text: "" });
    expect(param(url as string, "text")).toBe(sharePtBR.fallback);
  });

  it("survives a hostile payload: undefined/NaN text never throws", () => {
    expect(
      buildShareUrl("telegram", {
        text: undefined as unknown as string,
        url: NaN as unknown as string,
      }),
    ).toContain("https://t.me/share/url?");
    expect(buildShareUrl("telegram", {} as SharePayload)).toContain(
      "https://t.me/share/url?",
    );
  });

  it("encodes reserved characters so the URL survives transport", () => {
    const nasty = `A&B=1?#"${SAMPLE_URL}% +é😀`;
    const url = buildShareUrl("whatsapp", { text: nasty });
    const decoded = param(url as string, "text");
    expect(decoded).toBe(nasty);
    // Raw query must not contain unescaped reserved chars from the value.
    expect(url).not.toMatch(/text=A&B/);
  });

  it("omits the url param value but keeps a valid shape when no url is given", () => {
    const url = buildShareUrl("telegram", { text: SAMPLE_TEXT });
    expect(param(url as string, "text")).toBe(SAMPLE_TEXT);
    expect(param(url as string, "url")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// buildShareCopy — per-network copy, locale aware
// ---------------------------------------------------------------------------

describe("buildShareCopy", () => {
  it("keeps line breaks and a moderate emoji for WhatsApp", () => {
    const copy = buildShareCopy(
      "whatsapp",
      { text: SAMPLE_TEXT, url: SAMPLE_URL },
      "pt-BR",
    );
    expect(copy).toContain(SAMPLE_TEXT);
    expect(copy).toContain(sharePtBR.whatsapp.emoji);
    expect(copy).toContain(sharePtBR.whatsapp.linkLabel);
    expect(copy).toContain(SAMPLE_URL);
    expect(copy).toContain("\n");
  });

  it("keeps line breaks and a moderate emoji for Telegram", () => {
    const copy = buildShareCopy(
      "telegram",
      { text: SAMPLE_TEXT, url: SAMPLE_URL },
      "pt-BR",
    );
    expect(copy).toContain(SAMPLE_TEXT);
    expect(copy).toContain(sharePtBR.telegram.emoji);
    expect(copy).toContain(sharePtBR.telegram.linkLabel);
    expect(copy).toContain(SAMPLE_URL);
    expect(copy).toContain("\n");
  });

  it("produces a single-line tweet with hashtags, capped at 280", () => {
    const copy = buildShareCopy(
      "x",
      { text: SAMPLE_TEXT, url: SAMPLE_URL },
      "pt-BR",
    );
    expect(copy).not.toContain("\n");
    expect(copy).toContain(SAMPLE_TEXT);
    expect(copy).toContain(SAMPLE_URL);
    for (const tag of sharePtBR.x.hashtags) {
      expect(copy).toContain(tag);
    }
    expect(copy.length).toBeLessThanOrEqual(X_CHAR_LIMIT);
  });

  it("truncates an over-long X message with an ellipsis and still fits 280", () => {
    const long = "Peça muito detalhada ".repeat(60).trim();
    const copy = buildShareCopy("x", { text: long, url: SAMPLE_URL }, "pt-BR");
    expect(copy.length).toBeLessThanOrEqual(X_CHAR_LIMIT);
    expect(copy).toContain("…");
    expect(copy).toContain(sharePtBR.x.hashtags[0]);
    expect(copy).not.toContain("\n");
  });

  it("keeps every hashtag even when the message alone is near the limit", () => {
    const nearLimit = "x".repeat(270);
    const copy = buildShareCopy(
      "x",
      { text: nearLimit, url: SAMPLE_URL },
      "pt-BR",
    );
    expect(copy.length).toBeLessThanOrEqual(X_CHAR_LIMIT);
    expect(copy).toContain(
      sharePtBR.x.hashtags[sharePtBR.x.hashtags.length - 1],
    );
  });

  it("still caps at 280 when the URL + hashtags alone exceed the budget", () => {
    const hugeUrl = `https://open3dcalc.app/#calc=${"a".repeat(400)}`;
    const copy = buildShareCopy("x", { text: "p", url: hugeUrl }, "pt-BR");
    expect(copy.length).toBeLessThanOrEqual(X_CHAR_LIMIT);
    expect(() => copy).not.toThrow();
  });

  it("builds an Instagram caption with a trailing hashtag block", () => {
    const copy = buildShareCopy(
      "instagram",
      { text: SAMPLE_TEXT, url: SAMPLE_URL },
      "pt-BR",
    );
    expect(copy).toContain(SAMPLE_TEXT);
    expect(copy).toContain("\n");
    // The hashtag block must come last.
    const lastTag =
      sharePtBR.instagram.hashtags[sharePtBR.instagram.hashtags.length - 1];
    expect(copy.lastIndexOf(lastTag)).toBe(copy.length - lastTag.length);
    for (const tag of sharePtBR.instagram.hashtags) {
      expect(copy).toContain(tag);
    }
  });

  it("builds a structured email body with intro and signoff", () => {
    const copy = buildShareCopy(
      "email",
      { text: SAMPLE_TEXT, url: SAMPLE_URL },
      "pt-BR",
    );
    expect(copy).toContain(sharePtBR.email.intro);
    expect(copy).toContain(SAMPLE_TEXT);
    expect(copy).toContain(sharePtBR.email.linkLabel);
    expect(copy).toContain(SAMPLE_URL);
    expect(copy).toContain(sharePtBR.email.signoff);
    expect(copy).toContain("\n\n");
  });

  it("omits the link lines of the email body when no url is given", () => {
    const copy = buildShareCopy("email", { text: SAMPLE_TEXT }, "pt-BR");
    expect(copy).toContain(sharePtBR.email.intro);
    expect(copy).toContain(sharePtBR.email.signoff);
    expect(copy).not.toContain(sharePtBR.email.linkLabel);
  });

  it("produces English copy for en-US", () => {
    const copy = buildShareCopy(
      "whatsapp",
      { text: SAMPLE_TEXT, url: SAMPLE_URL },
      "en-US",
    );
    expect(copy).toContain(shareEnUS.whatsapp.linkLabel);
    expect(copy).not.toContain(sharePtBR.whatsapp.linkLabel);
  });

  it("falls back to pt-BR for an unsupported locale", () => {
    const copy = buildShareCopy(
      "whatsapp",
      { text: SAMPLE_TEXT, url: SAMPLE_URL },
      "fr-FR" as ShareLocale,
    );
    expect(copy).toContain(sharePtBR.whatsapp.linkLabel);
  });

  it("uses the fallback text when the payload text is empty or blank", () => {
    expect(buildShareCopy("whatsapp", { text: "" }, "pt-BR")).toContain(
      sharePtBR.fallback,
    );
    expect(buildShareCopy("whatsapp", { text: "   \n\t " }, "pt-BR")).toContain(
      sharePtBR.fallback,
    );
  });

  it("produces generic plain copy for unknown networks", () => {
    const copy = buildShareCopy(
      "signal" as ShareNetworkId,
      { text: SAMPLE_TEXT, url: SAMPLE_URL },
      "pt-BR",
    );
    expect(copy).toContain(SAMPLE_TEXT);
    expect(copy).toContain(SAMPLE_URL);
    expect(copy).not.toContain(sharePtBR.whatsapp.emoji);
  });

  it("never throws on hostile payloads across every network", () => {
    const ids = Object.keys(SHARE_NETWORKS) as ShareNetworkId[];
    for (const id of ids) {
      expect(() =>
        buildShareCopy(id, {} as SharePayload, "pt-BR"),
      ).not.toThrow();
      expect(() =>
        buildShareCopy(id, { text: NaN as unknown as string }, "pt-BR"),
      ).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// countChars
// ---------------------------------------------------------------------------

describe("countChars", () => {
  it("counts characters and reports remaining budget", () => {
    expect(countChars("abc", 10)).toEqual({
      count: 3,
      limit: 10,
      overflow: 0,
      remaining: 7,
    });
  });

  it("reports overflow when the text exceeds the limit", () => {
    expect(countChars("abcdef", 3)).toEqual({
      count: 6,
      limit: 3,
      overflow: 3,
      remaining: -3,
    });
  });

  it("handles an exact fit", () => {
    expect(countChars("exactly10x", 10).overflow).toBe(0);
    expect(countChars("exactly10x", 10).remaining).toBe(0);
  });

  it("treats non-string input as zero characters", () => {
    expect(countChars(NaN as unknown as string, 280).count).toBe(0);
    expect(countChars(undefined as unknown as string, 280).count).toBe(0);
  });

  it("neutralizes non-finite or non-positive limits", () => {
    expect(countChars("abc", NaN).limit).toBe(0);
    expect(countChars("abc", Infinity).limit).toBe(0);
    expect(countChars("abc", -5).limit).toBe(0);
    expect(countChars("abc", 0).limit).toBe(0);
  });

  it("floors fractional limits", () => {
    expect(countChars("abc", 10.9).limit).toBe(10);
  });

  it("matches the X limit used by the registry", () => {
    const copy = buildShareCopy("x", { text: SAMPLE_TEXT }, "pt-BR");
    const counted = countChars(copy, CHAR_LIMITS.x as number);
    expect(counted.overflow).toBe(0);
  });
});
