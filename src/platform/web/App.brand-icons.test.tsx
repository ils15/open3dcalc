import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SecondaryNavigation } from "./SecondaryNavigation";

describe("SecondaryNavigation brand icons", () => {
  it("renders the GitHub and Telegram brand SVG paths", () => {
    const { container } = render(<SecondaryNavigation onInternalNavigate={() => undefined} />);

    const [github, telegram] = Array.from(container.querySelectorAll("svg"));

    expect(github).toBeInTheDocument();
    expect(telegram).toBeInTheDocument();
    expect(github.querySelector("path")?.getAttribute("d")).toContain(
      "M12 0C5.37 0 0 5.37 0 12",
    );
    expect(telegram.querySelector("path")?.getAttribute("d")).toContain(
      "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12",
    );
    expect(github.getAttribute("aria-hidden")).toBe("true");
    expect(telegram.getAttribute("aria-hidden")).toBe("true");
  });
});
