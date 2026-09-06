import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EstimationModeSection } from "../EstimationModeSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function gcodeFile(name: string, text: string): File {
  const file = new File([text], name, { type: "text/plain" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  return file;
}

describe("EstimationModeSection", () => {
  const baseProps = {
    mode: "simple" as const,
    onModeChange: vi.fn(),
    calibrationK: 1,
    onCalibrationKChange: vi.fn(),
    gcodeAnchor: null,
    onGcodeAnchor: vi.fn(),
    onClearGcodeAnchor: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("default simples: exibe o segmento sem controles avançados visíveis", () => {
    render(<EstimationModeSection {...baseProps} />);

    expect(
      screen.getByRole("radio", { name: "stl.estimationModeSimple" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "stl.estimationModeAdvanced" }),
    ).not.toBeChecked();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(
      screen.queryByText("stl.advancedUncertainty"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("stl.gcodeUpload")).not.toBeInTheDocument();
  });

  it("clicar em Avançado troca o modo", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(
      <EstimationModeSection {...baseProps} onModeChange={onModeChange} />,
    );

    await user.click(
      screen.getByRole("radio", { name: "stl.estimationModeAdvanced" }),
    );
    expect(onModeChange).toHaveBeenCalledWith("advanced");
  });

  it("modo avançado revela k, upload de G-code e nota de incerteza", () => {
    render(<EstimationModeSection {...baseProps} mode="advanced" />);

    expect(
      screen.getByRole("slider", { name: "stl.calibrationK" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "stl.calibrationK" }),
    ).toBeInTheDocument();
    expect(screen.getByText("stl.gcodeUpload")).toBeInTheDocument();
    expect(screen.getByText("stl.advancedUncertainty")).toBeInTheDocument();
  });

  it("alterar o slider k propaga o valor", async () => {
    const user = userEvent.setup();
    const onCalibrationKChange = vi.fn();
    render(
      <EstimationModeSection
        {...baseProps}
        mode="advanced"
        onCalibrationKChange={onCalibrationKChange}
      />,
    );

    fireEvent.change(screen.getByRole("slider", { name: "stl.calibrationK" }), {
      target: { value: "1.5" },
    });
    expect(onCalibrationKChange).toHaveBeenCalledWith(1.5);
    expect(user).toBeDefined();
  });

  it("upload .gcode ancora E e tempo", async () => {
    const onGcodeAnchor = vi.fn();
    render(
      <EstimationModeSection
        {...baseProps}
        mode="advanced"
        onGcodeAnchor={onGcodeAnchor}
      />,
    );

    const file = gcodeFile(
      "peca.gcode",
      "G1 X10 Y10 E100\nG1 X20 Y20 E150\n;TIME:3600\n",
    );
    fireEvent.change(screen.getByLabelText("stl.gcodeUpload"), {
      target: { files: [file] },
    });

    await waitFor(() => expect(onGcodeAnchor).toHaveBeenCalledTimes(1));
    const anchor = onGcodeAnchor.mock.calls[0][0] as {
      fileName: string;
      grams: number;
      minutes?: number;
    };
    expect(anchor.fileName).toBe("peca.gcode");
    expect(anchor.grams).toBeGreaterThan(0);
    expect(anchor.minutes).toBe(60);
  });

  it("arquivo acima de 50MB mostra erro e não ancora", async () => {
    const onGcodeAnchor = vi.fn();
    render(
      <EstimationModeSection
        {...baseProps}
        mode="advanced"
        onGcodeAnchor={onGcodeAnchor}
      />,
    );

    const file = gcodeFile("grande.gcode", "G1 X0 E1\n");
    Object.defineProperty(file, "size", { value: 51 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("stl.gcodeUpload"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "stl.gcodeTooLarge",
    );
    expect(onGcodeAnchor).not.toHaveBeenCalled();
  });

  it("extensão inválida mostra erro e não ancora", async () => {
    const onGcodeAnchor = vi.fn();
    render(
      <EstimationModeSection
        {...baseProps}
        mode="advanced"
        onGcodeAnchor={onGcodeAnchor}
      />,
    );

    const file = gcodeFile("notas.txt", "G1 X0 E1\n");
    fireEvent.change(screen.getByLabelText("stl.gcodeUpload"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "stl.gcodeInvalidType",
    );
    expect(onGcodeAnchor).not.toHaveBeenCalled();
  });

  it("âncora exibe arquivo, E e tempo com botão limpar", async () => {
    const user = userEvent.setup();
    const onClearGcodeAnchor = vi.fn();
    render(
      <EstimationModeSection
        {...baseProps}
        mode="advanced"
        gcodeAnchor={{ fileName: "peca.gcode", grams: 12.5, minutes: 60 }}
        onClearGcodeAnchor={onClearGcodeAnchor}
      />,
    );

    expect(screen.getByText(/peca\.gcode/)).toBeInTheDocument();
    expect(screen.getByText(/12\.5/)).toBeInTheDocument();
    expect(screen.getByText(/60/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "stl.gcodeClear" }));
    expect(onClearGcodeAnchor).toHaveBeenCalledTimes(1);
  });
});
