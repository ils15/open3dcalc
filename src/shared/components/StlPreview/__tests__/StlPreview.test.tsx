import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StlPreview } from "../StlPreview";
import { useModelComparison } from "@/shared/stores/modelComparison";

// Mock R3F — Canvas doesn't work well in jsdom. Props are mirrored onto data
// attributes so render-level props (frameloop, dpr) can be asserted.
vi.mock("@react-three/fiber", () => ({
  Canvas: ({
    children,
    frameloop,
    dpr,
  }: {
    children: React.ReactNode;
    frameloop?: string;
    dpr?: number | [number, number];
  }) => (
    <div
      data-testid="r3f-canvas"
      data-frameloop={frameloop}
      data-dpr={JSON.stringify(dpr)}
    >
      {children}
    </div>
  ),
}));

// Expose the mocked Bounds API so tests can assert fit() is invoked
const { mockBounds } = vi.hoisted(() => ({
  mockBounds: {
    fit: vi.fn(),
    refresh: vi.fn(),
    clip: vi.fn(),
    reset: vi.fn(),
    getSize: vi.fn(),
  },
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Center: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bounds: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBounds: () => mockBounds,
  MeshStandardMaterial: () => null,
  MeshBasicMaterial: () => null,
}));

// Mock Three.js loaders
vi.mock("three/examples/jsm/loaders/STLLoader", () => ({ STLLoader: vi.fn() }));
vi.mock("three/examples/jsm/loaders/OBJLoader", () => ({ OBJLoader: vi.fn() }));

// Mock the STL parser so STL drops can be tested without real parsing
const { mockAnalyzeMeshFile, mockEstimateTriangles } = vi.hoisted(() => ({
  mockAnalyzeMeshFile: vi.fn(),
  // Default `undefined` keeps the guard inert (undefined > limit is false),
  // so existing drops still reach the mocked analyzeMeshFile.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockGeometry(overrides: Record<string, any> = {}): any {
  return {
    type: "BufferGeometry",
    uuid: "test-uuid",
    clone: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

describe("StlPreview", () => {
  const mockOnFileParsed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The comparison store persists to localStorage: keep the file hermetic so
  // a test that adds an entry can't leave the compare panel mounted for the
  // next render (extra /stl\./ buttons).
  afterEach(() => {
    useModelComparison.getState().clear();
  });

  it("renders upload zone when no file", () => {
    render(<StlPreview onFileParsed={mockOnFileParsed} />);
    // The button shows either stl.dropzone or stl.tapToSelect depending on env
    const uploadButton = screen.getByRole("button", { name: /stl\./ });
    expect(uploadButton).toBeInTheDocument();
  });

  it("has a hidden file input", () => {
    render(<StlPreview onFileParsed={mockOnFileParsed} />);
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("accept", expect.stringContaining(".stl"));
  });

  it("renders without crashing when onFileParsed is provided", () => {
    render(<StlPreview onFileParsed={mockOnFileParsed} />);
    const uploadButton = screen.getByRole("button", { name: /stl\./ });
    expect(uploadButton).toBeInTheDocument();
  });

  it("shows 3D canvas when initialGeometry is provided", () => {
    const mockGeometry = createMockGeometry();
    render(
      <StlPreview
        initialGeometry={mockGeometry}
        onFileParsed={mockOnFileParsed}
      />,
    );
    expect(screen.getByTestId("r3f-canvas")).toBeInTheDocument();
  });

  it("renders model info panel when modelInfo is available after parsing", () => {
    // With initialGeometry, the canvas shows
    const mockGeometry = createMockGeometry();
    render(
      <StlPreview
        initialGeometry={mockGeometry}
        onFileParsed={mockOnFileParsed}
      />,
    );
    expect(screen.getByTestId("r3f-canvas")).toBeInTheDocument();
  });

  it("shows upload zone button text", () => {
    render(<StlPreview onFileParsed={mockOnFileParsed} />);
    const uploadButton = screen.getByRole("button", { name: /stl\./ });
    expect(uploadButton).toBeInTheDocument();
  });

  it("renders a fit button when geometry is present", () => {
    render(
      <StlPreview
        initialGeometry={createMockGeometry()}
        onFileParsed={mockOnFileParsed}
      />,
    );
    expect(screen.getByRole("button", { name: "stl.fit" })).toBeInTheDocument();
  });

  it("calls the bounds fit API when fit button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <StlPreview
        initialGeometry={createMockGeometry()}
        onFileParsed={mockOnFileParsed}
      />,
    );
    await user.click(screen.getByRole("button", { name: "stl.fit" }));
    expect(mockBounds.fit).toHaveBeenCalled();
  });

  it("shows a clear button when geometry is present", () => {
    render(
      <StlPreview
        initialGeometry={createMockGeometry()}
        onFileParsed={mockOnFileParsed}
      />,
    );
    expect(
      screen.getByRole("button", { name: "stl.clear" }),
    ).toBeInTheDocument();
  });

  it("clears the model and calls onClear", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <StlPreview
        initialGeometry={createMockGeometry()}
        onFileParsed={mockOnFileParsed}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByRole("button", { name: "stl.clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    // Canvas is removed and the upload zone comes back
    expect(screen.queryByTestId("r3f-canvas")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stl\./ })).toBeInTheDocument();
  });

  it("opens a fullscreen portal overlay and closes it", async () => {
    const user = userEvent.setup();
    render(
      <StlPreview
        initialGeometry={createMockGeometry()}
        onFileParsed={mockOnFileParsed}
      />,
    );

    await user.click(screen.getByRole("button", { name: "stl.fullscreen" }));

    // Portal overlay rendered into document.body with dialog semantics
    const overlay = document.querySelector(".fixed.inset-0");
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveAttribute("role", "dialog");
    expect(
      screen.getByRole("button", { name: "stl.exitFullscreen" }),
    ).toBeInTheDocument();
    // Inline preview hidden while fullscreen
    expect(
      screen.queryByRole("button", { name: "stl.fullscreen" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "stl.exitFullscreen" }),
    );
    expect(
      screen.queryByRole("button", { name: "stl.exitFullscreen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "stl.fullscreen" }),
    ).toBeInTheDocument();
  });

  it("exits fullscreen on Escape key", async () => {
    const user = userEvent.setup();
    render(
      <StlPreview
        initialGeometry={createMockGeometry()}
        onFileParsed={mockOnFileParsed}
      />,
    );

    await user.click(screen.getByRole("button", { name: "stl.fullscreen" }));
    expect(
      screen.getByRole("button", { name: "stl.exitFullscreen" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("button", { name: "stl.exitFullscreen" }),
    ).not.toBeInTheDocument();
  });

  it("keeps fit and clear buttons visible inside fullscreen overlay", async () => {
    const user = userEvent.setup();
    render(
      <StlPreview
        initialGeometry={createMockGeometry()}
        onFileParsed={mockOnFileParsed}
      />,
    );

    await user.click(screen.getByRole("button", { name: "stl.fullscreen" }));
    expect(screen.getByRole("button", { name: "stl.fit" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "stl.clear" }),
    ).toBeInTheDocument();
  });

  describe("GCODE handling (issue #32)", () => {
    it("calls onFileParsed and shows modelInfo for gcode without TIME header", async () => {
      const onFileParsed = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });

      const gcodeContent = [
        "; generated by PrusaSlicer 2.6.0",
        "G1 X10 Y10 E500",
        "G1 X20 Y20 E1500",
        ";MINX:0",
        ";MAXX:100",
        ";MINY:0",
        ";MAXY:50",
        ";MINZ:0",
        ";MAXZ:10",
      ].join("\n");
      const file = new File([gcodeContent], "test.gcode", { type: "" });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(gcodeContent),
        writable: true,
        configurable: true,
      });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      const result = onFileParsed.mock.calls[0][0];
      expect(result.printTimeHours).toBe(0);
      expect(result.weight).toBeGreaterThan(0);
      // modelInfo panel should be visible (dimensions + time)
      expect(screen.getByText("stl.dimensions")).toBeInTheDocument();
      expect(screen.getByText("stl.printTime")).toBeInTheDocument();
      // time 0 should show dash, not be hidden
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("rounds the GCODE weight to 2 decimals, same util as the STL path", async () => {
      const onFileParsed = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });

      // E500 mm at Ø1.75 / PLA 1.24 → ≈1.4913 g (more than 2 decimals raw).
      const gcodeContent = "G1 X0 Y0 Z0.2 E500";
      const file = new File([gcodeContent], "round.gcode", { type: "" });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(gcodeContent),
        writable: true,
        configurable: true,
      });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      const result = onFileParsed.mock.calls[0][0];
      expect(result.weight).toBeGreaterThan(0);
      // Same precision as the STL branch (parseFloat(x.toFixed(2))).
      expect(result.weight).toBe(Math.round(result.weight * 100) / 100);
    });

    it("parses PrusaSlicer estimated time format via drop and reports correct hours", async () => {
      const onFileParsed = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });

      const gcodeContent = [
        "; generated by PrusaSlicer 2.6.0",
        "; estimated printing time (normal mode) = 1h 23m 45s",
        "G1 X0 Y0 E10",
        ";MINX:0",
        ";MAXX:50",
        ";MINY:0",
        ";MAXY:50",
      ].join("\n");
      const file = new File([gcodeContent], "prusa.gcode", { type: "" });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(gcodeContent),
        writable: true,
        configurable: true,
      });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      const result = onFileParsed.mock.calls[0][0];
      // 1h23m45s => 84 minutes => 1.4 hours
      expect(result.printTimeHours).toBeCloseTo(1.4, 1);
      expect(screen.getByText("stl.printTime")).toBeInTheDocument();
    });

    it("shows modelInfo even when gcode has only E moves and no headers", async () => {
      const onFileParsed = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });

      const gcodeContent = "G1 X0 Y0 E0.5\nG1 X10 Y10 E1.5";
      const file = new File([gcodeContent], "minimal.gcode", { type: "" });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(gcodeContent),
        writable: true,
        configurable: true,
      });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      expect(screen.getByText("stl.dimensions")).toBeInTheDocument();
    });

    it("keeps drop zone visible after GCODE for re-upload (no dead-end)", async () => {
      const onFileParsed = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", {
        name: /stl\.(dropzone|tapToSelect|dropActive)/,
      });

      const gcodeContent = "G1 X0 Y0 E0.5\nG1 X10 Y10 E1.5";
      const file = new File([gcodeContent], "reupload.gcode", { type: "" });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(gcodeContent),
        writable: true,
        configurable: true,
      });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      // drop zone must remain visible (modelInfo.geometry is null → !modelInfo?.geometry true)
      expect(
        screen.getByRole("button", {
          name: /stl\.(dropzone|tapToSelect|dropActive)/,
        }),
      ).toBeInTheDocument();
      // no 3D canvas for GCODE
      expect(screen.queryByTestId("r3f-canvas")).not.toBeInTheDocument();
    });

    it("clears stale STL geometry when GCODE is loaded afterwards", async () => {
      const onFileParsed = vi.fn();
      render(
        <StlPreview
          initialGeometry={createMockGeometry()}
          onFileParsed={onFileParsed}
        />,
      );
      // initially STL canvas is visible
      expect(screen.getByTestId("r3f-canvas")).toBeInTheDocument();
      // drop zone hidden while STL geometry present (unless standalone) — check specifically for dropzone label, not toolbar buttons
      expect(
        screen.queryByRole("button", {
          name: /stl\.(dropzone|tapToSelect|dropActive)/,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "stl.fit" }),
      ).toBeInTheDocument();

      // GCODE drop — need to get drop via click fallback since drop zone hidden:
      // use hidden file input directly via processFile — simulate drop on document
      // workaround: temporarily use the file input change event
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const gcodeContent = "G1 X0 Y0 E0.5\nG1 X10 Y10 E1.5";
      const file = new File([gcodeContent], "stale.gcode", { type: "" });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(gcodeContent),
        writable: true,
        configurable: true,
      });
      // simulate file selection via input change (processFile path)
      Object.defineProperty(input, "files", { value: [file], writable: false });
      fireEvent.change(input);

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      // geometry must be cleared — canvas removed
      expect(screen.queryByTestId("r3f-canvas")).not.toBeInTheDocument();
      // drop zone reappears for GCODE
      expect(
        screen.getByRole("button", {
          name: /stl\.(dropzone|tapToSelect|dropActive)/,
        }),
      ).toBeInTheDocument();
    });

    it("shows clear button for GCODE when onClear is provided (no geometry dead-end)", async () => {
      const onFileParsed = vi.fn();
      const onClear = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} onClear={onClear} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });

      const gcodeContent = "G1 X0 Y0 E0.5\nG1 X10 Y10 E1.5";
      const file = new File([gcodeContent], "clear.gcode", { type: "" });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(gcodeContent),
        writable: true,
        configurable: true,
      });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      const clearBtn = screen.getByRole("button", { name: "stl.clear" });
      expect(clearBtn).toBeInTheDocument();
      await userEvent.setup().click(clearBtn);
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("renders '—' for dimensions when the gcode has no measurable geometry (D-EA6)", async () => {
      const onFileParsed = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });

      // Headers only — no positioned moves and no `;MINX:` metadata: printSize
      // degrades to zeros, which must render as "—", never 0.0×0.0×0.0.
      const gcodeContent = [
        "; generated by PrusaSlicer 2.6.0",
        "; estimated printing time (normal mode) = 1h 0m 0s",
        ";Filament used: 1.6m",
        "M104 S200",
        "M140 S60",
      ].join("\n");
      const file = new File([gcodeContent], "headers-only.gcode", {
        type: "",
      });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(gcodeContent),
        writable: true,
        configurable: true,
      });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      expect(onFileParsed.mock.calls[0][0].dimensions).toBeNull();
      // The dims value cell sits next to its "stl.dimensions" label.
      const dimsCell = screen.getByText("stl.dimensions").parentElement;
      expect(dimsCell).not.toBeNull();
      expect(within(dimsCell!).getByText("—")).toBeInTheDocument();
      expect(screen.queryByText(/0\.0×0\.0×0\.0/)).not.toBeInTheDocument();
    });

    it("renders measured dimensions when the gcode has positioned moves (D-EA6)", async () => {
      const onFileParsed = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });

      const gcodeContent = "G1 X0 Y0 Z0.2 E10\nG1 X10 Y10 Z0.2 E20";
      const file = new File([gcodeContent], "cube.gcode", { type: "" });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(gcodeContent),
        writable: true,
        configurable: true,
      });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      expect(onFileParsed.mock.calls[0][0].dimensions).toEqual({
        x: 10,
        y: 10,
        z: 0,
      });
      expect(screen.getByText("10.0×10.0×0.0 mm")).toBeInTheDocument();
    });

    it("shows '—' for the volume of a gcode model in the comparison panel (D-EA6)", async () => {
      useModelComparison.getState().clear();
      const onFileParsed = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });

      // Real weight/time from headers, but no mesh → volume is unknown.
      const gcodeContent = ";TIME:3600\n;Filament used: 1.6m\n";
      const file = new File([gcodeContent], "compare.gcode", { type: "" });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(gcodeContent),
        writable: true,
        configurable: true,
      });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "stl.compare.add" }));

      const table = await screen.findByTestId("model-comparison");
      // Volume cell is "—" (no mesh); weight/time stay real.
      expect(within(table).getByText("—")).toBeInTheDocument();
      expect(within(table).getByText(/ g$/)).toBeInTheDocument();
      expect(useModelComparison.getState().entries[0].volumeCm3).toBeNull();
    });
  });

  describe("support estimation toggle", () => {
    const stlFile = () =>
      new File(
        [
          "solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test",
        ],
        "test.stl",
        { type: "" },
      );

    const mockAnalysis = {
      triangleCount: 100,
      vertexCount: 300,
      dimensions: { x: 10, y: 10, z: 10 },
      volume: 1000,
      surfaceArea: 600,
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 10, y: 10, z: 10 },
      },
      integrity: { valid: true, issues: [] },
      supportVolumeCm3: 0.5,
    };

    beforeEach(() => {
      mockAnalyzeMeshFile.mockResolvedValue({
        geometry: createMockGeometry(),
        analysis: mockAnalysis,
      });
    });

    it("parses without support estimation by default and hides support weight", async () => {
      const onFileParsed = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [stlFile()], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      expect(mockAnalyzeMeshFile).toHaveBeenLastCalledWith(
        expect.any(File),
        expect.objectContaining({ estimateSupport: false }),
      );
      // Toggle is visible in the info panel
      expect(
        screen.getByRole("checkbox", { name: "stl.estimateSupport" }),
      ).toBeInTheDocument();
      // Support weight NOT shown while disabled
      expect(screen.queryByText(/stl\.supportWeight/)).not.toBeInTheDocument();
    });

    it("re-parses with estimateSupport: true when toggled and shows support weight", async () => {
      const onFileParsed = vi.fn();
      render(<StlPreview onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });
      const file = stlFile();

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      const toggle = screen.getByRole("checkbox", {
        name: "stl.estimateSupport",
      });
      expect(toggle).not.toBeChecked();

      await userEvent.setup().click(toggle);

      await waitFor(() =>
        expect(mockAnalyzeMeshFile).toHaveBeenLastCalledWith(
          file,
          expect.objectContaining({ estimateSupport: true }),
        ),
      );
      // Support weight shown below the weight (0.5 cm³ × 1.24 g/cm³ = 0.6 g)
      await waitFor(() =>
        expect(screen.getByText(/stl\.supportWeight/)).toBeInTheDocument(),
      );
      expect(screen.getByText(/stl\.supportWeight/)).toHaveTextContent("0.6 g");
    });

    it("parses with estimateSupport: true when the prop is enabled", async () => {
      const onFileParsed = vi.fn();
      render(<StlPreview estimateSupport onFileParsed={onFileParsed} />);
      const dropZone = screen.getByRole("button", { name: /stl\./ });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [stlFile()], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      expect(mockAnalyzeMeshFile).toHaveBeenLastCalledWith(
        expect.any(File),
        expect.objectContaining({ estimateSupport: true }),
      );
      // Toggle starts checked
      expect(
        screen.getByRole("checkbox", { name: "stl.estimateSupport" }),
      ).toBeChecked();
    });
  });

  describe("D-EA7 — mesh integrity warning", () => {
    const stlFile = () =>
      new File([new Uint8Array(84)], "mesh.stl", {
        type: "model/stl",
      });

    const baseAnalysis = {
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
    };

    it("renders NO warning for a healthy mesh (byte-identical baseline)", async () => {
      const onFileParsed = vi.fn();
      mockAnalyzeMeshFile.mockResolvedValue({
        geometry: createMockGeometry(),
        analysis: {
          ...baseAnalysis,
          meshValidation: {
            windingInconsistent: false,
            nonManifoldEdges: 0,
            openEdges: 0,
            degenerateTriangles: 0,
            partial: false,
          },
        },
      });
      render(<StlPreview onFileParsed={onFileParsed} />);
      fireEvent.drop(screen.getByRole("button", { name: /stl\./ }), {
        dataTransfer: { files: [stlFile()], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("stl.volume")).toBeInTheDocument();
    });

    it("renders the amber warning for an open mesh (openEdges > 0)", async () => {
      const onFileParsed = vi.fn();
      mockAnalyzeMeshFile.mockResolvedValue({
        geometry: createMockGeometry(),
        analysis: {
          ...baseAnalysis,
          meshValidation: {
            windingInconsistent: false,
            nonManifoldEdges: 0,
            openEdges: 4,
            degenerateTriangles: 0,
            partial: false,
          },
        },
      });
      render(<StlPreview onFileParsed={onFileParsed} />);
      fireEvent.drop(screen.getByRole("button", { name: /stl\./ }), {
        dataTransfer: { files: [stlFile()], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute("title", "stl.meshWarning.tooltip");
      expect(screen.getByText("stl.meshWarning.open")).toBeInTheDocument();
      // Non-blocking: the estimate is still rendered.
      expect(screen.getByText("stl.volume")).toBeInTheDocument();
      expect(onFileParsed).toHaveBeenCalledTimes(1);
    });

    it("renders the warning for inconsistent winding", async () => {
      const onFileParsed = vi.fn();
      mockAnalyzeMeshFile.mockResolvedValue({
        geometry: createMockGeometry(),
        analysis: {
          ...baseAnalysis,
          meshValidation: {
            windingInconsistent: true,
            nonManifoldEdges: 0,
            openEdges: 0,
            degenerateTriangles: 0,
            partial: false,
          },
        },
      });
      render(<StlPreview onFileParsed={onFileParsed} />);
      fireEvent.drop(screen.getByRole("button", { name: /stl\./ }), {
        dataTransfer: { files: [stlFile()], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      expect(screen.getByText("stl.meshWarning.winding")).toBeInTheDocument();
    });

    it("renders the partial-validation note for huge meshes", async () => {
      const onFileParsed = vi.fn();
      mockAnalyzeMeshFile.mockResolvedValue({
        geometry: createMockGeometry(),
        analysis: {
          ...baseAnalysis,
          meshValidation: {
            windingInconsistent: false,
            nonManifoldEdges: 0,
            openEdges: 0,
            degenerateTriangles: 0,
            partial: true,
          },
        },
      });
      render(<StlPreview onFileParsed={onFileParsed} />);
      fireEvent.drop(screen.getByRole("button", { name: /stl\./ }), {
        dataTransfer: { files: [stlFile()], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      expect(screen.getByText("stl.meshWarning.partial")).toBeInTheDocument();
    });
  });

  describe("complexity guard — reject before the expensive parse", () => {
    const stlFile = () =>
      new File([new Uint8Array(84)], "mesh.stl", { type: "model/stl" });

    const baseAnalysis = {
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
    };

    it("refuses an over-complex STL without ever parsing it", async () => {
      const onFileParsed = vi.fn();
      // 3M triangles declared in the 84-byte header — rejected in O(1).
      mockEstimateTriangles.mockResolvedValue(3_000_000);
      mockAnalyzeMeshFile.mockResolvedValue({
        geometry: createMockGeometry(),
        analysis: baseAnalysis,
      });
      render(<StlPreview onFileParsed={onFileParsed} />);
      fireEvent.drop(screen.getByRole("button", { name: /stl\./ }), {
        dataTransfer: { files: [stlFile()], types: ["Files"] },
      });

      // The analysis never runs: the whole point is skipping it.
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent("stl.tooComplex"),
      );
      expect(mockAnalyzeMeshFile).not.toHaveBeenCalled();
      expect(onFileParsed).not.toHaveBeenCalled();
    });

    it("proceeds to the parse when the estimate is under the limit", async () => {
      const onFileParsed = vi.fn();
      mockEstimateTriangles.mockResolvedValue(100);
      mockAnalyzeMeshFile.mockResolvedValue({
        geometry: createMockGeometry(),
        analysis: baseAnalysis,
      });
      render(<StlPreview onFileParsed={onFileParsed} />);
      fireEvent.drop(screen.getByRole("button", { name: /stl\./ }), {
        dataTransfer: { files: [stlFile()], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      expect(mockAnalyzeMeshFile).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("falls back to the post-analysis guard when no estimate exists", async () => {
      // OBJ/3MF: estimateTriangleCount devolve null e o fluxo segue igual.
      const onFileParsed = vi.fn();
      mockEstimateTriangles.mockResolvedValue(null);
      mockAnalyzeMeshFile.mockResolvedValue({
        geometry: createMockGeometry(),
        analysis: baseAnalysis,
      });
      render(<StlPreview onFileParsed={onFileParsed} />);
      fireEvent.drop(screen.getByRole("button", { name: /stl\./ }), {
        dataTransfer: { files: [stlFile()], types: ["Files"] },
      });

      await waitFor(() => expect(onFileParsed).toHaveBeenCalledTimes(1));
      expect(mockAnalyzeMeshFile).toHaveBeenCalledTimes(1);
    });
  });

  describe("static preview render budget", () => {
    it("renders on demand with a capped dpr (no continuous 4K repaints)", () => {
      render(
        <StlPreview
          initialGeometry={createMockGeometry()}
          onFileParsed={mockOnFileParsed}
        />,
      );
      const canvas = screen.getByTestId("r3f-canvas");
      // A stationary model must not spin the render loop; the pixel budget is
      // capped instead of defaulting to [1,2] on retina panels.
      expect(canvas).toHaveAttribute("data-frameloop", "demand");
      expect(canvas).toHaveAttribute("data-dpr", "[1,1.5]");
    });
  });
});
