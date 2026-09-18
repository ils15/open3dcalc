import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StlPreview } from "../StlPreview";

// Mock R3F — Canvas doesn't work in jsdom (same stubs as StlPreview.test.tsx).
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Center: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bounds: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBounds: () => ({
    fit: vi.fn(),
    refresh: vi.fn(),
    clip: vi.fn(),
    reset: vi.fn(),
    getSize: vi.fn(),
  }),
  MeshStandardMaterial: () => null,
  MeshBasicMaterial: () => null,
}));

vi.mock("three/examples/jsm/loaders/STLLoader", () => ({ STLLoader: vi.fn() }));
vi.mock("three/examples/jsm/loaders/OBJLoader", () => ({ OBJLoader: vi.fn() }));

// Mock the STL parser so an STL sample resolves without real mesh parsing.
const { mockAnalyzeMeshFile, mockEstimateTriangles } = vi.hoisted(() => ({
  mockAnalyzeMeshFile: vi.fn(),
  mockEstimateTriangles: vi.fn(),
}));

vi.mock("@/shared/lib/stlParser", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/lib/stlParser")>();
  return {
    ...actual,
    analyzeMeshFile: mockAnalyzeMeshFile,
    estimateTriangleCount: mockEstimateTriangles,
  };
});

// Mock the G-code parser so a G-code sample resolves without real parsing.
const { mockParseGcode } = vi.hoisted(() => ({
  mockParseGcode: vi.fn(),
}));

vi.mock("@/shared/lib/gcodeParser", () => ({
  parseGcode: mockParseGcode,
}));

// Minimal successful fetch response carrying a small blob.
function mockOkResponse(): Response {
  return {
    ok: true,
    status: 200,
    blob: () => Promise.resolve(new Blob(["fake-sample-body"])),
  } as unknown as Response;
}

describe("StlPreview — embedded sample loader", () => {
  const mockOnFileParsed = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
    mockEstimateTriangles.mockResolvedValue(undefined);
    mockAnalyzeMeshFile.mockResolvedValue({
      geometry: { clone: () => ({}), boundingBox: { max: { z: 10 } } },
      analysis: {
        triangleCount: 12,
        vertexCount: 36,
        dimensions: { x: 10, y: 10, z: 10 },
        volume: 1000,
        surfaceArea: 600,
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 10, y: 10, z: 10 },
        },
        integrity: { valid: true, issues: [] },
      },
    });
    mockParseGcode.mockReturnValue({
      printTimeMinutes: 60,
      filamentUsedGrams: 10,
      printSize: { x: 10, y: 10, z: 10 },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders both sample buttons in the empty state", () => {
    render(<StlPreview onFileParsed={mockOnFileParsed} />);
    expect(
      screen.getByRole("button", { name: "stl.samples.stl" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "stl.samples.gcode" }),
    ).toBeInTheDocument();
  });

  it("downloads and parses the STL sample when its button is clicked", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as Mock).mockResolvedValue(mockOkResponse());
    render(<StlPreview onFileParsed={mockOnFileParsed} />);

    await user.click(screen.getByRole("button", { name: "stl.samples.stl" }));

    await waitFor(() => expect(mockAnalyzeMeshFile).toHaveBeenCalledTimes(1));
    const fetchedUrl = (globalThis.fetch as Mock).mock.calls[0][0] as string;
    expect(fetchedUrl).toContain("samples/3DBenchy.stl");
    const passedFile = mockAnalyzeMeshFile.mock.calls[0][0] as File;
    expect(passedFile.name).toBe("3DBenchy.stl");
  });

  it("downloads and parses the G-code sample when its button is clicked", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as Mock).mockResolvedValue(mockOkResponse());
    render(<StlPreview onFileParsed={mockOnFileParsed} />);

    await user.click(screen.getByRole("button", { name: "stl.samples.gcode" }));

    await waitFor(() => expect(mockParseGcode).toHaveBeenCalledTimes(1));
    const fetchedUrl = (globalThis.fetch as Mock).mock.calls[0][0] as string;
    expect(fetchedUrl).toContain("samples/3DBenchy.gcode");
  });

  it("shows loading feedback and disables the buttons while downloading", async () => {
    const user = userEvent.setup();
    let resolveDownload!: (value: unknown) => void;
    (globalThis.fetch as Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveDownload = resolve;
      }),
    );
    render(<StlPreview onFileParsed={mockOnFileParsed} />);

    await user.click(screen.getByRole("button", { name: "stl.samples.stl" }));

    expect(screen.getByText("stl.samples.loading")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "stl.samples.stl" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "stl.samples.gcode" }),
    ).toBeDisabled();

    // Finish the download — loading state clears and buttons recover.
    resolveDownload(mockOkResponse());
    await waitFor(() =>
      expect(screen.queryByText("stl.samples.loading")).not.toBeInTheDocument(),
    );
  });

  it("shows a friendly error when the download fails", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as Mock).mockRejectedValue(new Error("network down"));
    render(<StlPreview onFileParsed={mockOnFileParsed} />);

    await user.click(screen.getByRole("button", { name: "stl.samples.stl" }));

    await waitFor(() =>
      expect(screen.getByText("stl.samples.error")).toBeInTheDocument(),
    );
    expect(mockAnalyzeMeshFile).not.toHaveBeenCalled();
    // Buttons are usable again after the failure.
    expect(
      screen.getByRole("button", { name: "stl.samples.gcode" }),
    ).not.toBeDisabled();
  });
});
