import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChangelogPage } from "../ChangelogPage";

const i18nState = vi.hoisted(() => ({ language: "en-US" }));

const versions = [
  {
    version: "1.9.2",
    date: "",
    sections: [{ title: "Features", items: ["A new feature"] }],
  },
  {
    version: "1.9.1",
    date: "2026-07-02",
    sections: [{ title: "Bug Fixes", items: ["A fix", "Another fix"] }],
  },
];

const translations: Record<string, Record<string, string>> = {
  "en-US": {
    "changelog.title": "Changelog",
    "changelog.summary": "{{versions}} · {{changes}}",
    "changelog.versionsCount": "{{count}} versions",
    "changelog.changesCount": "{{count}} changes",
    "changelog.latest": "Latest",
    "changelog.releaseDate": "Released {{date}}",
    "changelog.viewAllOnGitHub": "View all releases on GitHub",
    "changelog.github": "GitHub",
    "changelog.telegram": "Telegram",
    "changelog.partner": "ofertachina.com.br",
    "changelog.categories.features": "Features",
    "changelog.categories.fixes": "Fixes",
  },
  "pt-BR": {
    "changelog.title": "Novidades",
    "changelog.summary": "{{versions}} · {{changes}}",
    "changelog.versionsCount": "{{count}} versões",
    "changelog.changesCount": "{{count}} mudanças",
    "changelog.latest": "Atual",
    "changelog.releaseDate": "Lançado em {{date}}",
    "changelog.viewAllOnGitHub": "Ver todas as releases no GitHub",
    "changelog.github": "GitHub",
    "changelog.telegram": "Telegram",
    "changelog.partner": "ofertachina.com.br",
    "changelog.categories.features": "Funcionalidades",
    "changelog.categories.fixes": "Correções",
  },
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: i18nState.language,
      resolvedLanguage: i18nState.language,
    },
    t: (
      key: string,
      options?: {
        count?: number;
        versions?: string;
        changes?: string;
        returnObjects?: boolean;
      },
    ) => {
      if (key === "changelog.versions" && options?.returnObjects)
        return versions;

      const template = translations[i18nState.language][key] ?? key;
      return template
        .replace("{{count}}", String(options?.count ?? ""))
        .replace("{{versions}}", options?.versions ?? "")
        .replace("{{changes}}", options?.changes ?? "");
    },
  }),
}));

describe("ChangelogPage", () => {
  it.each([
    ["en-US", "2 versions · 3 changes"],
    ["pt-BR", "2 versões · 3 mudanças"],
  ])("localizes count and labels in %s", (language, summary) => {
    i18nState.language = language;

    render(<ChangelogPage />);

    expect(screen.getByText(summary)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: language === "en-US" ? "Changelog" : "Novidades",
      }),
    ).toBeInTheDocument();
  });

  it.each([
    ["en-US", "Jul 2, 2026"],
    ["pt-BR", "02 de jul. de 2026"],
  ])("formats dates in %s", (language, formattedDate) => {
    i18nState.language = language;

    render(<ChangelogPage />);

    expect(screen.getByTestId("version-date-1.9.1")).toHaveTextContent(
      formattedDate,
    );
  });

  it("handles a version without a confirmed date and marks only the latest version", () => {
    i18nState.language = "en-US";

    render(<ChangelogPage />);

    expect(screen.queryByTestId("version-date-1.9.2")).not.toBeInTheDocument();
    expect(screen.getByTestId("latest-badge-1.9.2")).toHaveTextContent(
      "Latest",
    );
    expect(screen.queryByTestId("latest-badge-1.9.1")).not.toBeInTheDocument();

    const undatedHeading = screen.getByTestId("version-heading-1.9.2");
    expect(undatedHeading.textContent).not.toContain("·");
  });

  it("keeps version and date in separate layout elements", () => {
    i18nState.language = "en-US";

    render(<ChangelogPage />);

    const heading = screen.getByTestId("version-heading-1.9.1");
    expect(screen.getByTestId("version-label-1.9.1")).toHaveTextContent(
      "v1.9.1",
    );
    expect(screen.getByTestId("version-date-1.9.1")).toHaveTextContent(
      "Jul 2, 2026",
    );
    expect(
      heading.querySelector('[data-testid="version-date-1.9.1"]'),
    ).toBeTruthy();
    expect(heading.textContent).toContain("·");
  });

  it("localizes known category titles from English source data", () => {
    i18nState.language = "pt-BR";

    render(<ChangelogPage />);
    fireEvent.click(screen.getByRole("button", { name: /v1\.9\.2/i }));

    expect(screen.getByText("Funcionalidades")).toBeInTheDocument();
  });

  it("uses translated footer link labels", () => {
    i18nState.language = "pt-BR";

    render(<ChangelogPage />);

    expect(
      screen.getByRole("link", { name: "Ver todas as releases no GitHub" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Telegram" })).toBeInTheDocument();
  });
});
