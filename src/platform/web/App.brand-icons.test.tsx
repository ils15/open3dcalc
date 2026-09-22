import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SecondaryNavigation } from "./SecondaryNavigation";

describe("SecondaryNavigation brand icons", () => {
  it("renders the GitHub and Telegram brand SVG paths", () => {
    const { container } = render(
      <SecondaryNavigation onInternalNavigate={() => undefined} />,
    );

    // Scope each brand SVG to its own anchor: the nav also renders lucide
    // BookOpen/Info SVGs before these links, so a positional
    // querySelectorAll("svg") would pick those up instead of the brand marks.
    const githubLink = container.querySelector(
      'a[href="https://github.com/ils15/open3dcalc"]',
    );
    const telegramLink = container.querySelector(
      'a[href="https://t.me/Impressao3DBR"]',
    );

    expect(githubLink).toBeInTheDocument();
    expect(telegramLink).toBeInTheDocument();
    expect(githubLink?.getAttribute("target")).toBe("_blank");
    expect(githubLink?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(telegramLink?.getAttribute("target")).toBe("_blank");
    expect(telegramLink?.getAttribute("rel")).toBe("noopener noreferrer");

    const github = githubLink?.querySelector("svg");
    const telegram = telegramLink?.querySelector("svg");

    expect(github).toBeInTheDocument();
    expect(telegram).toBeInTheDocument();
    // GitHub octocat mark path (a generic ExternalLink icon would not match).
    expect(github?.querySelector("path")?.getAttribute("d")).toContain(
      "M12 0C5.37 0 0 5.37 0 12",
    );
    // Telegram plane-in-circle path.
    expect(telegram?.querySelector("path")?.getAttribute("d")).toContain(
      "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12",
    );
    expect(github?.getAttribute("aria-hidden")).toBe("true");
    expect(telegram?.getAttribute("aria-hidden")).toBe("true");
  });
});
