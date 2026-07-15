import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Center } from '@react-three/drei'
import { Upload, RotateCcw, AlertCircle } from 'lucide-react'
import type { BufferGeometry } from 'three'
import type { MeshAnalysis } from '@/shared/lib/stlParser'
import { estimatePrintTime } from '@/shared/lib/printTimeEstimator'

export interface FileParseResult {
  geometry: BufferGeometry
  analysis: MeshAnalysis
  volumeCm3: number
  weight: number
  printTimeHours: number
  dimensions: { x: number; y: number; z: number }
  triangleCount: number
}

interface StlPreviewProps {
  onFileParsed?: (data: FileParseResult) => void
  onError?: (message: string) => void
  initialGeometry?: BufferGeometry | null
  /** If true, manages own state (drag-drop, parse, display) */
  standalone?: boolean
}

function Model({ geometry }: { geometry: BufferGeometry }) {
  const geo = useMemo(() => geometry.clone(), [geometry])
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
        <meshBasicMaterial color="#a78bfa" wireframe opacity={0.15} transparent />
      </mesh>
    </Center>
  )
}

function PreviewCanvas({ geometry }: { geometry: BufferGeometry }) {
  const resetView = () => {
    // Trigger re-render with camera reset — OrbitControls reset is implicit
    // by toggling via key prop or manual camera
  }

  return (
    <div className="relative w-full h-full group">
      <Canvas
        camera={{ position: [5, 5, 5], fov: 45 }}
        key={geometry.uuid}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        <Model geometry={geometry} />
        <OrbitControls
          enablePan
          enableZoom
          autoRotate={false}
        />
      </Canvas>
      <button
        type="button"
        onClick={resetView}
        className="absolute top-2 right-2 z-10 min-h-[36px] min-w-[36px] p-2 rounded-lg bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white/80 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        aria-label="Reset view"
        title="Reset view"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
    </div>
  )
}

export function StlPreview({
  onFileParsed,
  onError,
  initialGeometry = null,
  standalone = false,
}: StlPreviewProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [geometry, setGeometry] = useState<BufferGeometry | null>(initialGeometry)
  const [modelInfo, setModelInfo] = useState<FileParseResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isTouchDevice = useMemo(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    [],
  )

  // initialGeometry is used as the initial state value above;
  // consumers that need to reset geometry should use a key prop on StlPreview

  const showError = useCallback(
    (message: string) => {
      setError(message)
      onError?.(message)
      setTimeout(() => setError(null), 4000)
    },
    [onError],
  )

  const processFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !['stl', 'obj', '3mf', 'gcode'].includes(ext)) {
        showError(t('stl.invalidFile'))
        return
      }

      if (file.size > 100 * 1024 * 1024) {
        showError(t('stl.tooLarge'))
        return
      }

      setParsing(true)
      setError(null)

      try {
        if (ext === 'gcode') {
          const { parseGcode } = await import('@/shared/lib/gcodeParser')
          const text = await file.text()
          const gcode = parseGcode(text)
          if (gcode.printTimeMinutes > 0) {
            const hours = gcode.printTimeMinutes / 60
            const result: FileParseResult = {
              geometry: null as unknown as BufferGeometry,
              analysis: {
                triangleCount: 0,
                vertexCount: 0,
                dimensions: { x: gcode.printSize.x, y: gcode.printSize.y, z: gcode.printSize.z },
                volume: 0,
                surfaceArea: 0,
                boundingBox: {
                  min: { x: 0, y: 0, z: 0 },
                  max: { x: gcode.printSize.x, y: gcode.printSize.y, z: gcode.printSize.z },
                },
                integrity: { valid: true, issues: [] },
              },
              volumeCm3: 0,
              weight: gcode.filamentUsedGrams,
              printTimeHours: parseFloat(hours.toFixed(2)),
              dimensions: { x: gcode.printSize.x, y: gcode.printSize.y, z: gcode.printSize.z },
              triangleCount: 0,
            }
            setModelInfo(result)
            onFileParsed?.(result)
          }
        } else {
          const { analyzeMeshFile, volumeToCm3, estimateWeight } = await import(
            '@/shared/lib/stlParser'
          )
          const { geometry: parsedGeometry, analysis } = await analyzeMeshFile(file)
          if (analysis.triangleCount > 2_000_000) {
            showError(t('stl.tooComplex'))
            setParsing(false)
            return
          }
          setGeometry(parsedGeometry)
          const volumeCm3 = volumeToCm3(analysis.volume)
          const weight = estimateWeight(volumeCm3, 1.24, 20, 10)
          const timeEstimate = estimatePrintTime(volumeCm3, analysis.dimensions)
          const result: FileParseResult = {
            geometry: parsedGeometry,
            analysis,
            volumeCm3,
            weight: parseFloat(weight.toFixed(2)),
            printTimeHours: timeEstimate.estimatedHours,
            dimensions: analysis.dimensions,
            triangleCount: analysis.triangleCount,
          }
          setModelInfo(result)
          onFileParsed?.(result)
        }
      } catch {
        showError(t('stl.error'))
      }
      setParsing(false)
    },
    [t, onFileParsed, showError],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      // Reset input so same file can be re-selected
      e.target.value = ''
    },
    [processFile],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const dropZoneText = parsing
    ? t('stl.processing')
    : isDragOver
      ? t('stl.dropActive')
      : isTouchDevice
        ? t('stl.tapToSelect')
        : t('stl.dropzone')

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
            ${isDragOver
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 scale-[1.02]'
              : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-hover)]'
            }
            ${parsing ? 'pointer-events-none opacity-70' : ''}
          `}
          aria-label={dropZoneText}
        >
          {parsing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[var(--color-accent)]">{dropZoneText}</p>
            </div>
          ) : (
            <>
              <Upload
                className={`w-6 h-6 transition-colors ${
                  isDragOver
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)]'
                }`}
              />
              <p
                className={`text-sm transition-colors ${
                  isDragOver
                    ? 'text-[var(--color-accent)] font-medium'
                    : 'text-[var(--color-text-secondary)]'
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
      {geometry && (
        <div className="surface rounded-xl overflow-hidden min-h-[300px] sm:min-h-[400px]">
          <PreviewCanvas geometry={geometry} />
        </div>
      )}

      {/* Model Info Panel */}
      {modelInfo && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {modelInfo.volumeCm3 > 0 && (
            <div className="surface rounded-lg p-2.5 text-center">
              <p className="text-[var(--color-text-muted)] mb-0.5">
                {t('stl.volume')}
              </p>
              <p className="font-semibold text-purple-400">
                {modelInfo.volumeCm3.toFixed(1)} cm³
              </p>
            </div>
          )}
          {modelInfo.weight > 0 && (
            <div className="surface rounded-lg p-2.5 text-center">
              <p className="text-[var(--color-text-muted)] mb-0.5">
                {t('stl.weight')}
              </p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {modelInfo.weight.toFixed(1)} g
              </p>
            </div>
          )}
          <div className="surface rounded-lg p-2.5 text-center">
            <p className="text-[var(--color-text-muted)] mb-0.5">
              {t('stl.dimensions')}
            </p>
            <p className="font-semibold text-[var(--color-text-primary)] text-[11px]">
              {modelInfo.dimensions.x.toFixed(1)}×{modelInfo.dimensions.y.toFixed(1)}×{modelInfo.dimensions.z.toFixed(1)} mm
            </p>
          </div>
          {modelInfo.triangleCount > 0 && (
            <div className="surface rounded-lg p-2.5 text-center">
              <p className="text-[var(--color-text-muted)] mb-0.5">
                {t('stl.triangles')}
              </p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {modelInfo.triangleCount.toLocaleString()}
              </p>
            </div>
          )}
          {modelInfo.printTimeHours > 0 && (
            <div className="surface rounded-lg p-2.5 text-center">
              <p className="text-[var(--color-text-muted)] mb-0.5">
                {t('stl.printTime')}
              </p>
              <p className="font-semibold text-emerald-400">
                {modelInfo.printTimeHours.toFixed(1)} h
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
