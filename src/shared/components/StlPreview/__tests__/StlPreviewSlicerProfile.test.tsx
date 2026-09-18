import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

function createMockGeometry() {
  return {
    type: "BufferGeometry",
    uuid: "test-uuid",
    clone: vi.fn().mockReturnThis(),
  };
}

/** Cubo de 100 mm: 1000 cm³, 60000 mm² de área (mesma geometria do stlParser.test.ts). */
function meshAnalysisFixture() {
  return {
    triangleCount: 12,
    vertexCount: 36,
    dimensions: { x: 100, y: 100, z: 100 },
    volume: 1_000_000,
    surfaceArea: 60_000,
    boundingBox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 100, y: 100, z: 100 },
    },
    integrity: { valid: true, issues: [] },
  };
}

function stlFile(): File {
  return new File(["solid t\nendsolid t"], "model.stl", {
    type: "model/stl",
  });
}

/** Renderiza, carrega um mesh e desmonta — pronto para a próxima medição. */
async function measure(
  props: Record<string, unknown> = {},
): Promise<FileParseResult> {
  const onFileParsed = vi.fn<(data: FileParseResult) => void>();
  const utils = render(<StlPreview onFileParsed={onFileParsed} {...props} />);
  fireEvent.drop(
    screen.getByRole("button", {
      name: /^stl\.(dropzone|tapToSelect|dropActive|processing)$/,
    }),
    {
      dataTransfer: { files: [stlFile()] },
    },
  );
  await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
  const result = onFileParsed.mock.calls[0][0];
  utils.unmount();
  return result;
}

const PLA = { materialDensity: 1.24, infillPercent: 20 };

describe("StlPreview — slicer profile wiring (D-EA1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyzeMeshFile.mockResolvedValue({
      geometry: createMockGeometry(),
      analysis: meshAnalysisFixture(),
    });
  });

  it("lineWidthMm/topLayers/bottomLayers mudam o peso (casca mais grossa)", async () => {
    const base = await measure({
      ...PLA,
      wallCount: 2,
      lineWidthMm: 0.42,
      topLayers: 4,
      bottomLayers: 4,
      layerHeight: 0.2,
      speed: 60,
    });
    const thick = await measure({
      ...PLA,
      wallCount: 4,
      lineWidthMm: 0.6,
      topLayers: 6,
      bottomLayers: 6,
      layerHeight: 0.2,
      speed: 60,
    });

    expect(thick.weight).toBeGreaterThan(base.weight);
    expect(thick.printTimeHours).toBeGreaterThan(0);
  });

  it("printSpeedMmPerS maior encurta o tempo estimado", async () => {
    const slow = await measure({ ...PLA, layerHeight: 0.2, speed: 60 });
    const fast = await measure({ ...PLA, layerHeight: 0.2, speed: 120 });

    expect(fast.printTimeHours).toBeLessThan(slow.printTimeHours);
  });

  it("sem props de perfil, sai idêntico aos defaults do estimador", async () => {
    const withoutProps = await measure();
    const withDefaults = await measure({
      ...PLA,
      wallCount: 2,
      lineWidthMm: 0.42,
      topLayers: 4,
      bottomLayers: 4,
      layerHeight: 0.2,
      speed: 60,
    });

    expect(withDefaults.weight).toBe(withoutProps.weight);
    expect(withDefaults.printTimeHours).toBe(withoutProps.printTimeHours);
  });
});
