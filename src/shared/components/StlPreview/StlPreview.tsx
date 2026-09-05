import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, Bounds, useBounds } from "@react-three/drei";
import type { BoundsApi } from "@react-three/drei";
import {
  Upload,
  AlertCircle,
  Maximize2,
  X,
  Trash2,
  Crosshair,
} from "lucide-react";
import type { BufferGeometry } from "three";
import type { MeshAnalysis } from "@/shared/lib/stlParser";
import type { FilamentFamily } from "@/shared/lib/filamentProfiles";
import { estimatePrintTime } from "@/shared/lib/printTimeEstimator";

export interface FileParseResult {
  geometry: BufferGeometry | null;
  analysis: MeshAnalysis;
  volumeCm3: number;
  weight: number;
  printTimeHours: number;
  dimensions: { x: number; y: number; z: number };
  triangleCount: number;
  /** Estimated support material volume in cm³ (only when estimateSupport is enabled). */
  supportVolumeCm3?: number;
  /** Estimated support material weight in grams (only when estimateSupport is enabled). */
  supportWeightGrams?: number;
}

interface StlPreviewProps {
  onFileParsed?: (data: FileParseResult) => void;
  onError?: (message: string) => void;
  initialGeometry?: BufferGeometry | null;
  /** If true, manages own state (drag-drop, parse, display) */
  standalone?: boolean;
  /** Calculator material density (g/cm³). Default 1.24 (PLA). */
  materialDensity?: number;
  /** Calculator infill percentage. Default 20. */
  infillPercent?: number;
  /** Layer height in mm (from store fdmPrintParams). Default 0.2. */
  layerHeight?: number;
  /** Print speed in mm/s (from store fdmPrintParams). Default 60. */
  speed?: number;
  /** Number of perimeter walls (from store fdmPrintParams). Default 2. */
  wallCount?: number;
  /**
   * Filament family for the MVS speed clamp (default PLA).
   * Density still comes from `materialDensity` when provided.
   */
  material?: FilamentFamily;
  /** When true, estimates support material volume from overhang triangles. Default false. */
  estimateSupport?: boolean;
  /** Called when the user clears the loaded model from the viewer. */
  onClear?: () => void;
}

function Model({ geometry }: { geometry: BufferGeometry }) {
  const geo = useMemo(() => geometry.clone(), [geometry]);
  return (
    <Center>
      <mesh geometry={geo} scale={0.01}>
        <meshStandardMaterial
          color="#8b5cf6"
          metalness={0.3}
          roughness={0.6}
          wireframe={false}
        />
      </mesh>
      <mesh geometry={geo} scale={0.01}>
        <meshBasicMaterial
          color="#a78bfa"
          wireframe
          opacity={0.15}
          transparent
        />
      </mesh>
    </Center>
  );
}

/**
 * Bridges the drei `Bounds` context API (exposed via `useBounds`) to an
 * external ref so toolbar buttons outside the Canvas can trigger `fit()`.
 * drei 10.x does not forward a `ref` on <Bounds>, hence the bridge.
 */
function BoundsBridge({
  apiRef,
}: {
  apiRef: React.MutableRefObject<BoundsApi | null>;
}) {
  const bounds = useBounds();
  useEffect(() => {
    apiRef.current = bounds;
    return () => {
      apiRef.current = null;
    };
  }, [bounds, apiRef]);
  return null;
}

const toolbarButtonClass =
  "min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg " +
  "bg-[var(--color-bg-elevated)]/85 backdrop-blur-sm border border-[var(--color-border)]/60 " +
  "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] " +
  "hover:bg-[var(--color-bg-elevated)] transition-colors " +
  "focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none";

interface PreviewCanvasProps {
  geometry: BufferGeometry;
  /** Rendered inside the fullscreen portal overlay */
  isFullscreen?: boolean;
  /** Toggles fullscreen mode (null hides the button, e.g. inside fullscreen) */
  onToggleFullscreen?: () => void;
  /** Clears the loaded model (null hides the button) */
  onClear?: () => void;
}

function PreviewCanvas({
  geometry,
  isFullscreen = false,
  onToggleFullscreen,
  onClear,
}: PreviewCanvasProps) {
  const { t } = useTranslation();
  const boundsApi = useRef<BoundsApi | null>(null);
  return (
    <div className="relative w-full h-full group">
      <Canvas
        camera={{ position: [5, 5, 5], fov: 45, near: 0.01, far: 2000 }}
        key={geometry.uuid}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        <Bounds fit clip margin={1.2}>
          <Model geometry={geometry} />
        </Bounds>
        <BoundsBridge apiRef={boundsApi} />
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          minDistance={0.5}
          maxDistance={30}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />
      </Canvas>

      {/* Toolbar overlay */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => boundsApi.current?.fit()}
          aria-label={t("stl.fit")}
          title={t("stl.fit")}
          className={toolbarButtonClass}
        >
          <Crosshair className="w-4 h-4" />
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label={t("stl.clear")}
            title={t("stl.clear")}
            className={toolbarButtonClass}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={
              isFullscreen ? t("stl.exitFullscreen") : t("stl.fullscreen")
            }
            title={isFullscreen ? t("stl.exitFullscreen") : t("stl.fullscreen")}
            className={toolbarButtonClass}
          >
            {isFullscreen ? (
              <X className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Drag-and-drop 3D file preview with model info panel.
 *
 * Accepts STL, OBJ, 3MF and GCODE files. When a mesh file is parsed,
 * it estimates weight using the provided `materialDensity` and
 * `infillPercent` props (or sensible defaults for PLA at 20% infill).
 * The Canvas remounts automatically when geometry changes (via `key` prop),
 * and the camera auto-fits to the model bounds on mount. Toolbar buttons
 * offer fit-to-view, fullscreen and clear-model actions.
 */
export function StlPreview({
  onFileParsed,
  onError,
  initialGeometry = null,
  standalone = false,
  materialDensity,
  infillPercent,
  layerHeight,
  speed,
  wallCount,
  material,
  estimateSupport = false,
  onClear,
}: StlPreviewProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);
  const [geometry, setGeometry] = useState<BufferGeometry | null>(
    initialGeometry,
  );
  const [modelInfo, setModelInfo] = useState<FileParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supportEnabled, setSupportEnabled] = useState(estimateSupport);
  const isTouchDevice = useMemo(
    () =>
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    [],
  );

  // initialGeometry is used as the initial state value above;
  // consumers that need to reset geometry should use a key prop on StlPreview

  // Close the fullscreen overlay with the Escape key
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  const handleClear = useCallback(() => {
    setGeometry(null);
    setModelInfo(null);
    setError(null);
    setParsing(false);
    setIsFullscreen(false);
    onClear?.();
  }, [onClear]);

  const showError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
      setTimeout(() => setError(null), 4000);
    },
    [onError],
  );

  const processFile = useCallback(
    async (file: File, supportFlag?: boolean) => {
      const estimateSupportFlag = supportFlag ?? supportEnabled;
      lastFileRef.current = file;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["stl", "obj", "3mf", "gcode"].includes(ext)) {
        showError(t("stl.invalidFile"));
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        showError(t("stl.tooLarge"));
        return;
      }

      setParsing(true);
      setError(null);

      try {
        if (ext === "gcode") {
          const { parseGcode } = await import("@/shared/lib/gcodeParser");
          const text = await file.text();
          const gcode = parseGcode(text);
          const hours = gcode.printTimeMinutes / 60;
          const result: FileParseResult = {
            geometry: null,
            analysis: {
              triangleCount: 0,
              vertexCount: 0,
              dimensions: {
                x: gcode.printSize.x,
                y: gcode.printSize.y,
                z: gcode.printSize.z,
              },
              volume: 0,
              surfaceArea: 0,
              boundingBox: {
                min: { x: 0, y: 0, z: 0 },
                max: {
                  x: gcode.printSize.x,
                  y: gcode.printSize.y,
                  z: gcode.printSize.z,
                },
              },
              integrity: { valid: true, issues: [] },
            },
            volumeCm3: 0,
            weight: gcode.filamentUsedGrams,
            printTimeHours: parseFloat(hours.toFixed(2)),
            dimensions: {
              x: gcode.printSize.x,
              y: gcode.printSize.y,
              z: gcode.printSize.z,
            },
            triangleCount: 0,
          };
          setGeometry(null);
          setModelInfo(result);
          onFileParsed?.(result);
        } else {
          const {
            analyzeMeshFile,
            volumeToCm3,
            estimateWeight,
            estimateMaterialVolumeCm3,
          } = await import("@/shared/lib/stlParser");
          const { geometry: parsedGeometry, analysis } = await analyzeMeshFile(
            file,
            {
              estimateSupport: estimateSupportFlag,
              layerHeight,
              supportDensity: 0.15,
            },
          );
          if (analysis.triangleCount > 2_000_000) {
            showError(t("stl.tooComplex"));
            setParsing(false);
            return;
          }
          setGeometry(parsedGeometry);
          const volumeCm3 = volumeToCm3(analysis.volume);
          const density = materialDensity ?? 1.24;
          const infill = infillPercent ?? 20;
          // A área de superfície entra em mm² (unidade canônica da malha) —
          // a conversão para cm² acontece dentro do estimador.
          const weight = estimateWeight(volumeCm3, {
            densityGcm3: density,
            material,
            infillPercent: infill,
            purgePercent: 10,
            surfaceAreaMm2: analysis.surfaceArea,
            wallCount,
            supportVolumeCm3: analysis.supportVolumeCm3,
          });
          // O tempo tem que usar o plástico REALMENTE extrudado, não o volume
          // maciço do modelo — senão peça oca é cobrada como se fosse sólida.
          const materialVolumeCm3 = estimateMaterialVolumeCm3(volumeCm3, {
            infillPercent: infill,
            surfaceAreaMm2: analysis.surfaceArea,
            wallCount,
            supportVolumeCm3: analysis.supportVolumeCm3,
          });
          const timeEstimate = estimatePrintTime({
            volumeCm3,
            materialVolumeCm3,
            dimensions: analysis.dimensions,
            layerHeightMm: layerHeight,
            printSpeedMmPerS: speed,
            material,
          });
          const result: FileParseResult = {
            geometry: parsedGeometry,
            analysis,
            volumeCm3,
            weight: parseFloat(weight.toFixed(2)),
            printTimeHours: timeEstimate.estimatedHours,
            dimensions: analysis.dimensions,
            triangleCount: analysis.triangleCount,
            supportVolumeCm3: analysis.supportVolumeCm3,
            supportWeightGrams:
              analysis.supportVolumeCm3 != null
                ? parseFloat((analysis.supportVolumeCm3 * density).toFixed(2))
                : undefined,
          };
          setModelInfo(result);
          onFileParsed?.(result);
        }
      } catch {
        showError(t("stl.error"));
      }
      setParsing(false);
    },
    [
      t,
      onFileParsed,
      showError,
      materialDensity,
      infillPercent,
      layerHeight,
      speed,
      wallCount,
      material,
      supportEnabled,
    ],
  );

  const handleToggleSupport = useCallback(() => {
    const next = !supportEnabled;
    setSupportEnabled(next);
    // Re-parse the last loaded model with the new support estimation flag
    if (lastFileRef.current) {
      void processFile(lastFileRef.current, next);
    }
  }, [supportEnabled, processFile]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const dropZoneText = parsing
    ? t("stl.processing")
    : isDragOver
      ? t("stl.dropActive")
      : isTouchDevice
        ? t("stl.tapToSelect")
        : t("stl.dropzone");

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl,.obj,.3mf,.gcode"
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
      />

      {/* Drag-and-drop zone */}
      {(!geometry || standalone) && !modelInfo?.geometry && (
        <button
          type="button"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`
            w-full min-h-[44px] border-2 border-dashed rounded-xl p-6
            text-center cursor-pointer transition-all duration-200
            focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none
            flex flex-col items-center gap-2
            ${
              isDragOver
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 scale-[1.02]"
                : "border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-hover)]"
            }
            ${parsing ? "pointer-events-none opacity-70" : ""}
          `}
          aria-label={dropZoneText}
        >
          {parsing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--color-accent)]">
                {dropZoneText}
              </p>
            </div>
          ) : (
            <>
              <Upload
                className={`w-6 h-6 transition-colors ${
                  isDragOver
                    ? "text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              />
              <p
                className={`text-sm transition-colors ${
                  isDragOver
                    ? "text-[var(--color-accent)] font-medium"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                {dropZoneText}
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                STL, OBJ, 3MF, GCODE &mdash; max 100 MB
              </p>
            </>
          )}
        </button>
      )}

      {/* Error toast */}
      {error && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-[var(--color-danger)]/90 text-[var(--color-text-primary)] border border-red-500/30 shadow-lg"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      )}

      {/* 3D Preview */}
      {geometry && !isFullscreen && (
        <div className="surface rounded-xl overflow-hidden aspect-[4/3] min-h-[300px] sm:min-h-[400px] h-full">
          <PreviewCanvas
            geometry={geometry}
            onToggleFullscreen={() => setIsFullscreen(true)}
            onClear={handleClear}
          />
        </div>
      )}

      {/* Fullscreen 3D Preview (portal overlay) */}
      {isFullscreen &&
        geometry &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/90 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={t("stl.fullscreen")}
          >
            <PreviewCanvas
              geometry={geometry}
              isFullscreen
              onToggleFullscreen={() => setIsFullscreen(false)}
              onClear={handleClear}
            />
          </div>,
          document.body,
        )}

      {/* Model Info Panel */}
      {modelInfo && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={supportEnabled}
              onChange={handleToggleSupport}
              className="w-4 h-4 accent-[var(--color-accent)]"
            />
            <span className="text-[var(--color-text-secondary)]">
              {t("stl.estimateSupport")}
            </span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {modelInfo.volumeCm3 > 0 && (
              <div className="surface rounded-lg p-2.5 text-center">
                <p className="text-[var(--color-text-muted)] mb-0.5">
                  {t("stl.volume")}
                </p>
                <p className="font-semibold text-purple-400">
                  {modelInfo.volumeCm3.toFixed(1)} cm³
                </p>
              </div>
            )}
            {modelInfo.weight > 0 && (
              <div className="surface rounded-lg p-2.5 text-center">
                <p className="text-[var(--color-text-muted)] mb-0.5">
                  {t("stl.weight")}
                </p>
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {modelInfo.weight.toFixed(1)} g
                </p>
                {supportEnabled && modelInfo.supportWeightGrams != null && (
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    {t("stl.supportWeight")}:{" "}
                    {modelInfo.supportWeightGrams.toFixed(1)} g
                  </p>
                )}
              </div>
            )}
            <div className="surface rounded-lg p-2.5 text-center">
              <p className="text-[var(--color-text-muted)] mb-0.5">
                {t("stl.dimensions")}
              </p>
              <p className="font-semibold text-[var(--color-text-primary)] text-[11px]">
                {modelInfo.dimensions.x.toFixed(1)}×
                {modelInfo.dimensions.y.toFixed(1)}×
                {modelInfo.dimensions.z.toFixed(1)} mm
              </p>
            </div>
            {modelInfo.triangleCount > 0 && (
              <div className="surface rounded-lg p-2.5 text-center">
                <p className="text-[var(--color-text-muted)] mb-0.5">
                  {t("stl.triangles")}
                </p>
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {modelInfo.triangleCount.toLocaleString()}
                </p>
              </div>
            )}
            <div className="surface rounded-lg p-2.5 text-center">
              <p className="text-[var(--color-text-muted)] mb-0.5">
                {t("stl.printTime")}
              </p>
              <p className="font-semibold text-emerald-400">
                {modelInfo.printTimeHours > 0
                  ? `${modelInfo.printTimeHours.toFixed(1)} h`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clear button for GCODE (no geometry) — drop zone is also visible, but this gives an explicit clear action */}
      {modelInfo && !geometry && onClear && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClear}
            aria-label={t("stl.clear")}
            title={t("stl.clear")}
            className={toolbarButtonClass}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
