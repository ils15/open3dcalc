import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StlPreview, type FileParseResult } from "../StlPreview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Center: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bounds: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBounds: () => ({}),
  MeshStandardMaterial: () => null,
  MeshBasicMaterial: () => null,
}));

vi.mock("three/examples/jsm/loaders/STLLoader", () => ({ STLLoader: vi.fn() }));
vi.mock("three/examples/jsm/loaders/OBJLoader", () => ({ OBJLoader: vi.fn() }));

const { mockAnalyzeMeshFile } = vi.hoisted(() => ({
  mockAnalyzeMeshFile: vi.fn(),
}));

vi.mock("@/shared/lib/stlParser", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/lib/stlParser")>();
  return {
    ...actual,
    analyzeMeshFile: mockAnalyzeMeshFile,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockGeometry(overrides: Record<string, any> = {}): any {
  return {
    type: "BufferGeometry",
    uuid: "test-uuid",
    clone: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

function meshAnalysisFixture() {
  return {
    triangleCount: 12,
    vertexCount: 36,
    dimensions: { x: 20, y: 20, z: 20 },
    volume: 8000,
    surfaceArea: 2400,
    boundingBox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 20, y: 20, z: 20 },
    },
    integrity: { valid: true, issues: [] },
  };
}

function stlFile(): File {
  return new File(["solid t\nendsolid t"], "model.stl", {
    type: "model/stl",
  });
}

function gcodeFile(name: string, text: string): File {
  const file = new File([text], name, { type: "text/plain" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  return file;
}

describe("StlPreview estimation modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyzeMeshFile.mockResolvedValue({
      geometry: createMockGeometry(),
      analysis: meshAnalysisFixture(),
    });
  });

  async function loadMesh(onFileParsed: Mock<(data: FileParseResult) => void>) {
    render(<StlPreview onFileParsed={onFileParsed} />);
    fireEvent.drop(screen.getByRole("button", { name: /stl\./ }), {
      dataTransfer: { files: [stlFile()] },
    });
    await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
    return onFileParsed.mock.calls[0][0];
  }

  it("default Padrão: sem controles personalizados visíveis", async () => {
    const onFileParsed = vi.fn<(data: FileParseResult) => void>();
    const base = await loadMesh(onFileParsed);

    expect(
      screen.getByRole("radio", { name: "stl.estimationModeStandard" }),
    ).toBeChecked();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(
      screen.queryByText("stl.advancedUncertainty"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(`${base.weight.toFixed(1)} g`)).toBeInTheDocument();
    expect(screen.queryByText("stl.estimatedBadge")).not.toBeInTheDocument();
  });

  it("toggle alterna Padrão/Personalizada com descrições e ajuda", async () => {
    const onFileParsed = vi.fn<(data: FileParseResult) => void>();
    await loadMesh(onFileParsed);

    expect(
      screen.getByRole("radio", { name: "stl.estimationModeStandard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "stl.estimationModeCustom" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("stl.estimationModeStandardDescription"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("stl.estimationModeCustomDescription"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "stl.estimationModeHelp" }),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("radio", { name: "stl.estimationModeCustom" }),
    );
    expect(
      screen.getByRole("radio", { name: "stl.estimationModeCustom" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "stl.estimationModeStandard" }),
    ).not.toBeChecked();
  });

  it("Personalizada com k=1 mantém valores e indica origem estimada", async () => {
    const user = userEvent.setup();
    const onFileParsed = vi.fn<(data: FileParseResult) => void>();
    const base = await loadMesh(onFileParsed);

    await user.click(
      screen.getByRole("radio", { name: "stl.estimationModeCustom" }),
    );

    expect(
      screen.getByRole("slider", { name: "stl.calibrationK" }),
    ).toBeInTheDocument();
    expect(screen.getByText("stl.advancedUncertainty")).toBeInTheDocument();
    expect(screen.getByText(`${base.weight.toFixed(1)} g`)).toBeInTheDocument();
    expect(screen.getAllByText("stl.estimatedBadge")).toHaveLength(2);
  });

  it("k dobra o peso exibido e propaga para onFileParsed", async () => {
    const user = userEvent.setup();
    const onFileParsed = vi.fn<(data: FileParseResult) => void>();
    const base = await loadMesh(onFileParsed);

    await user.click(
      screen.getByRole("radio", { name: "stl.estimationModeCustom" }),
    );
    fireEvent.change(screen.getByRole("slider", { name: "stl.calibrationK" }), {
      target: { value: "2" },
    });

    const doubled = `${(base.weight * 2).toFixed(1)} g`;
    expect(screen.getByText(doubled)).toBeInTheDocument();
    // H1: advanced display rounds hours to 1 decimal while the mesh base keeps
    // billing precision (2 decimals), so switching to Custom already propagates
    // once (call 2) before the k change (call 3).
    await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(3));
    const last = onFileParsed.mock.calls[2][0] as { weight: number };
    expect(last.weight).toBeCloseTo(base.weight * 2, 2);
  });

  it("upload G-code ancora valores com badge e limpar volta a estimar", async () => {
    const user = userEvent.setup();
    const onFileParsed = vi.fn<(data: FileParseResult) => void>();
    const base = await loadMesh(onFileParsed);

    await user.click(
      screen.getByRole("radio", { name: "stl.estimationModeCustom" }),
    );

    const gcode = gcodeFile(
      "peca.gcode",
      "G1 X10 Y10 E50\nG1 X20 Y20 E100\n;TIME:1800\n",
    );
    fireEvent.change(screen.getByLabelText("stl.gcodeUpload"), {
      target: { files: [gcode] },
    });

    // E=100mm → ~0.3 g; ;TIME:1800 → 30 min → 0.5 h
    await waitFor(() =>
      expect(screen.getAllByText("stl.gcodeBadge")).toHaveLength(2),
    );
    expect(screen.getByText("0.3 g")).toBeInTheDocument();
    expect(screen.getByText("0.5 h")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "stl.gcodeClear" }));

    await waitFor(() =>
      expect(screen.getAllByText("stl.estimatedBadge")).toHaveLength(2),
    );
    expect(screen.getByText(`${base.weight.toFixed(1)} g`)).toBeInTheDocument();
  });
});
