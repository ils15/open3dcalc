import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import enUS from "@/shared/i18n/locales/en-US.json";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import { ChangelogPage } from "../ChangelogPage";
import {
  getLocalizedCategoryTitle,
  normalizeCategoryKey,
} from "../categoryLocalization";

type TestVersion = {
  version: string;
  date: string;
  sections: { title: string; items: string[] }[];
};

const i18nState = vi.hoisted(() => ({
  language: "en-US",
  versions: [] as TestVersion[],
}));

const versions: TestVersion[] = [
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

i18nState.versions = versions;

const localeData = {
  "en-US": enUS,
  "pt-BR": ptBR,
} as const;

const realVersions = {
  "en-US": enUS.changelog.versions as TestVersion[],
  "pt-BR": ptBR.changelog.versions as TestVersion[],
} as const;

const translations: Record<string, Record<string, string>> = {
  "en-US": {
    "changelog.title": enUS.changelog.title,
    "changelog.summary": "{{versions}} · {{changes}}",
    "changelog.versionsCount": "{{count}} versions",
    "changelog.changesCount": "{{count}} changes",
    "changelog.latest": enUS.changelog.latest,
    "changelog.releaseDate": enUS.changelog.releaseDate,
    "changelog.viewAllOnGitHub": enUS.changelog.viewAllOnGitHub,
    "changelog.github": enUS.changelog.github,
    "changelog.telegram": enUS.changelog.telegram,
    "changelog.partner": enUS.changelog.partner,
    ...Object.fromEntries(
      Object.entries(enUS.changelog.categories).map(([key, value]) => [
        `changelog.categories.${key}`,
        value,
      ]),
    ),
  },
  "pt-BR": {
    "changelog.title": ptBR.changelog.title,
    "changelog.summary": "{{versions}} · {{changes}}",
    "changelog.versionsCount": "{{count}} versões",
    "changelog.changesCount": "{{count}} mudanças",
    "changelog.latest": ptBR.changelog.latest,
    "changelog.releaseDate": ptBR.changelog.releaseDate,
    "changelog.viewAllOnGitHub": ptBR.changelog.viewAllOnGitHub,
    "changelog.github": ptBR.changelog.github,
    "changelog.telegram": ptBR.changelog.telegram,
    "changelog.partner": ptBR.changelog.partner,
    ...Object.fromEntries(
      Object.entries(ptBR.changelog.categories).map(([key, value]) => [
        `changelog.categories.${key}`,
        value,
      ]),
    ),
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
        return i18nState.versions;

      const template = translations[i18nState.language][key] ?? key;
      return template
        .replace("{{count}}", String(options?.count ?? ""))
        .replace("{{versions}}", options?.versions ?? "")
        .replace("{{changes}}", options?.changes ?? "");
    },
  }),
}));

describe("ChangelogPage", () => {
  beforeEach(() => {
    i18nState.versions = versions;
  });

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

  it("exposes the version menu state through aria-expanded", () => {
    i18nState.language = "en-US";

    render(<ChangelogPage />);

    const versionButton = screen.getByRole("button", { name: /v1\.9\.2/i });
    expect(versionButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(versionButton);

    expect(versionButton).toHaveAttribute("aria-expanded", "true");
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

  it.each(["en-US", "pt-BR"] as const)(
    "renders real locale category headings in %s",
    (language) => {
      i18nState.language = language;
      i18nState.versions = realVersions[language];

      render(<ChangelogPage />);
      const categories = localeData[language].changelog.categories as Record<
        string,
        string
      >;

      realVersions[language].forEach((version) => {
        fireEvent.click(
          screen.getByRole("button", {
            name: new RegExp(`v${version.version}`, "i"),
          }),
        );
        const versionCard = screen
          .getByTestId(`version-heading-${version.version}`)
          .closest("div.surface");
        expect(versionCard).not.toBeNull();

        version.sections.forEach((section) => {
          const categoryKey = normalizeCategoryKey(section.title);
          const expectedTitle = categoryKey
            ? categories[categoryKey]
            : section.title;

          expect(
            within(versionCard as HTMLElement).getAllByRole("heading", {
              level: 2,
              name: expectedTitle,
            }),
          ).not.toHaveLength(0);
        });

        fireEvent.click(
          screen.getByRole("button", {
            name: new RegExp(`v${version.version}`, "i"),
          }),
        );
      });

      const ciTitles = realVersions[language]
        .flatMap((version) => version.sections)
        .map((section) => section.title)
        .filter((title) => normalizeCategoryKey(title) === "ciCd");
      expect(ciTitles.length).toBeGreaterThan(0);
      expect(ciTitles).toEqual(
        expect.arrayContaining(
          language === "en-US"
            ? ["🤖 CI", "🤖 CI & Automation"]
            : ["🤖 CI/CD", "🤖 CI & Automação"],
        ),
      );
      expect(localeData[language].changelog.categories.ciCd).toBe("CI/CD");
      expect(
        realVersions[language]
          .flatMap((version) => version.sections)
          .map((section) => normalizeCategoryKey(section.title))
          .filter((key) => key === "ciCd"),
      ).not.toHaveLength(0);
    },
  );

  it.each([
    ["CI", "ciCd"],
    ["CI/CD", "ciCd"],
    ["CI & Automation", "ciCd"],
    ["CI & Automação", "ciCd"],
    ["CI e Automação", "ciCd"],
    ["CI and Automation", "ciCd"],
    ["ci automation", "ciCd"],
    ["ci e automacao", "ciCd"],
    [" cI / cD ", "ciCd"],
    ["CI   &   AUTOMAÇÃO", "ciCd"],
    ["ci__and__automation", "ciCd"],
    ["Técnico", "technical"],
    ["Testes", "tests"],
    ["Novo — Fase 5", "new"],
    ["Visual Polish & Mobile", "visualMobile"],
    ["Bug Fixes", "fixes"],
    ["Quality Gates", "qualityGates"],
  ])("normalizes %s to canonical category key", (title, key) => {
    expect(normalizeCategoryKey(title)).toBe(key);
  });

  it("uses the real locale category values for canonical keys", () => {
    const translate = (locale: typeof enUS) => (key: string) => {
      const category = key
        .split(".")
        .at(-1) as keyof typeof locale.changelog.categories;
      return locale.changelog.categories[category] ?? key;
    };

    expect(getLocalizedCategoryTitle("🔧 Técnico", translate(enUS))).toBe(
      "Technical",
    );
    expect(
      getLocalizedCategoryTitle("🎨 Visual Polish & Mobile", translate(ptBR)),
    ).toBe("Polimento Visual e Mobile");
  });

  it("falls back to the source title when a category translation is unavailable", () => {
    expect(
      getLocalizedCategoryTitle("Unmapped category", () => "missing"),
    ).toBe("Unmapped category");
    expect(getLocalizedCategoryTitle("Technical", (key) => key)).toBe(
      "Technical",
    );
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
