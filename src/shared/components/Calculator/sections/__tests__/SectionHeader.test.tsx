import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wrench } from "lucide-react";
import { SectionHeader } from "../SectionHeader";

describe("SectionHeader", () => {
  it("renders the icon, title, and optional subtitle", () => {
    render(
      <SectionHeader
        Icon={Wrench}
        title="Test Title"
        subtitle="Subtitle text"
      />,
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Subtitle text")).toBeInTheDocument();
    expect(document.querySelector(".lucide-wrench")).toBeInTheDocument();
  });

  it("does not render a section-local field customization control", () => {
    render(
      <>
        <SectionHeader Icon={Wrench} title="Material" />
        <SectionHeader Icon={Wrench} title="Print" />
        <SectionHeader Icon={Wrench} title="Sales" />
      </>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByTitle("calc.customizeFields")).not.toBeInTheDocument();
  });
});
