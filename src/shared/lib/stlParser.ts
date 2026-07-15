import * as THREE from 'three'

export interface MeshAnalysis {
  triangleCount: number
  vertexCount: number
  dimensions: { x: number; y: number; z: number }
  volume: number
  surfaceArea: number
  boundingBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }
  integrity: { valid: boolean; issues: string[] }
}

function calculateVolume(geometry: THREE.BufferGeometry): number {
  const pos = geometry.attributes.position
  const index = geometry.index
  let volume = 0
  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()
  const v3 = new THREE.Vector3()

  if (!index) {
    for (let i = 0; i < pos.count; i += 3) {
      v1.fromBufferAttribute(pos, i)
      v2.fromBufferAttribute(pos, i + 1)
      v3.fromBufferAttribute(pos, i + 2)
      volume += signedTetraVolume(v1, v2, v3)
    }
  } else {
    for (let i = 0; i < index.count; i += 3) {
      v1.fromBufferAttribute(pos, index.getX(i))
      v2.fromBufferAttribute(pos, index.getX(i + 1))
      v3.fromBufferAttribute(pos, index.getX(i + 2))
      volume += signedTetraVolume(v1, v2, v3)
    }
  }
  return Math.abs(volume / 6)
}

function signedTetraVolume(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
  return a.x * (b.y * c.z - b.z * c.y)
       + b.x * (c.y * a.z - c.z * a.y)
       + c.x * (a.y * b.z - a.z * b.y)
}

function calculateSurfaceArea(geometry: THREE.BufferGeometry): number {
  const pos = geometry.attributes.position
  let area = 0
  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()
  const v3 = new THREE.Vector3()

  const process = (a: number, b: number, c: number) => {
    v1.fromBufferAttribute(pos, a)
    v2.fromBufferAttribute(pos, b)
    v3.fromBufferAttribute(pos, c)
    const ab = v1.distanceTo(v2)
    const bc = v2.distanceTo(v3)
    const ca = v3.distanceTo(v1)
    const s = (ab + bc + ca) / 2
    area += Math.sqrt(Math.max(0, s * (s - ab) * (s - bc) * (s - ca)))
  }

  const index = geometry.index
  if (!index) {
    for (let i = 0; i < pos.count; i += 3) process(i, i + 1, i + 2)
  } else {
    for (let i = 0; i < index.count; i += 3) process(index.getX(i), index.getX(i + 1), index.getX(i + 2))
  }
  return area
}

function validateMesh(geometry: THREE.BufferGeometry) {
  const issues: string[] = []
  const pos = geometry.attributes.position
  if (!pos || pos.count === 0) issues.push('Model does not contain vertices')
  if (pos.count % 3 !== 0) issues.push('Vertex count does not form complete triangles')
  if (!geometry.attributes.normal) {
    issues.push('Model does not contain normals')
    geometry.computeVertexNormals()
  }
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (box && (box.isEmpty() || !isFinite(box.min.x))) issues.push('Invalid bounding box')
  return { valid: issues.length === 0, issues }
}

function analyzeGeometry(geometry: THREE.BufferGeometry): MeshAnalysis {
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  const size = new THREE.Vector3()
  box.getSize(size)
  const pos = geometry.attributes.position

  return {
    triangleCount: pos.count / 3,
    vertexCount: pos.count,
    dimensions: { x: +size.x.toFixed(2), y: +size.y.toFixed(2), z: +size.z.toFixed(2) },
    volume: +calculateVolume(geometry).toFixed(2),
    surfaceArea: +calculateSurfaceArea(geometry).toFixed(2),
    boundingBox: {
      min: { x: +box.min.x.toFixed(2), y: +box.min.y.toFixed(2), z: +box.min.z.toFixed(2) },
      max: { x: +box.max.x.toFixed(2), y: +box.max.y.toFixed(2), z: +box.max.z.toFixed(2) },
    },
    integrity: validateMesh(geometry),
  }
}

export async function analyzeMeshFile(file: File): Promise<{ geometry: THREE.BufferGeometry; analysis: MeshAnalysis }> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === '3mf') {
    return parse3mf(file)
  }

  if (ext === 'stl') {
    const { STLLoader } = await import('three/addons/loaders/STLLoader.js')
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const loader = new STLLoader()
          const geometry = loader.parse(e.target?.result as ArrayBuffer)
          geometry.computeVertexNormals()
          geometry.computeBoundingBox()
          const analysis = analyzeGeometry(geometry)
          resolve({ geometry, analysis })
        } catch (err) {
          reject(new Error(`Error processing STL: ${err}`))
        }
      }
      reader.onerror = () => reject(new Error('Error reading file'))
      reader.readAsArrayBuffer(file)
    })
  }

  if (ext === 'obj') {
    const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js')
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const loader = new OBJLoader()
          const object = loader.parse(e.target?.result as string)
          const geometries: THREE.BufferGeometry[] = []
          object.traverse(child => {
            if ((child as THREE.Mesh).isMesh) geometries.push((child as THREE.Mesh).geometry as THREE.BufferGeometry)
          })
          if (geometries.length === 0) throw new Error('No geometry found in OBJ')
          const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries)
          geometry.computeVertexNormals()
          geometry.computeBoundingBox()
          const analysis = analyzeGeometry(geometry)
          resolve({ geometry, analysis })
        } catch (err) {
          reject(new Error(`Error processing OBJ: ${err}`))
        }
      }
      reader.onerror = () => reject(new Error('Error reading file'))
      reader.readAsText(file)
    })
  }

  throw new Error(`Unsupported format: ${ext}. Use STL, OBJ or 3MF.`)
}

async function parse3mf(file: File): Promise<{ geometry: THREE.BufferGeometry; analysis: MeshAnalysis }> {
  const THREE = await import('three')
  const buffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(buffer)

  // Minimal ZIP parser for 3MF (3MF is a ZIP archive containing XML)
  // Find the End of Central Directory record
  let eocdOffset = -1
  for (let i = uint8.length - 22; i >= 0; i--) {
    if (uint8[i] === 0x50 && uint8[i + 1] === 0x4b && uint8[i + 2] === 0x05 && uint8[i + 3] === 0x06) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid 3MF file: not a valid ZIP archive')

  // Read central directory offset
  const cdOffset = uint8[eocdOffset + 16] | (uint8[eocdOffset + 17] << 8) | (uint8[eocdOffset + 18] << 16) | (uint8[eocdOffset + 19] << 24)
  const numEntries = uint8[eocdOffset + 10] | (uint8[eocdOffset + 11] << 8)

  // Find the 3D/3DModel.model file
  let offset = cdOffset
  for (let i = 0; i < numEntries; i++) {
    if (uint8[offset] !== 0x50 || uint8[offset + 1] !== 0x4b) break

    const fileNameLen = uint8[offset + 28] | (uint8[offset + 29] << 8)
    const extraLen = uint8[offset + 30] | (uint8[offset + 31] << 8)
    const commentLen = uint8[offset + 32] | (uint8[offset + 33] << 8)
    const localHeaderOffset = uint8[offset + 42] | (uint8[offset + 43] << 8) | (uint8[offset + 44] << 16) | (uint8[offset + 45] << 24)
    const compressedSize = uint8[offset + 20] | (uint8[offset + 21] << 8) | (uint8[offset + 22] << 16) | (uint8[offset + 23] << 24)
    const uncompressedSize = uint8[offset + 24] | (uint8[offset + 25] << 8) | (uint8[offset + 26] << 16) | (uint8[offset + 27] << 24)
    const compressionMethod = uint8[offset + 10] | (uint8[offset + 11] << 8)

    const fileName = new TextDecoder().decode(uint8.slice(offset + 46, offset + 46 + fileNameLen))

    if (fileName === '3D/3DModel.model' || fileName.endsWith('.model')) {
      // Extract the file data
      const localHeaderStart = localHeaderOffset
      const localFileNameLen = uint8[localHeaderStart + 26] | (uint8[localHeaderStart + 27] << 8)
      const localExtraLen = uint8[localHeaderStart + 28] | (uint8[localHeaderStart + 29] << 8)
      const dataStart = localHeaderStart + 30 + localFileNameLen + localExtraLen

      if (compressionMethod === 0) {
        // Stored (no compression)
        const xmlData = new TextDecoder().decode(uint8.slice(dataStart, dataStart + uncompressedSize))
        return parse3mfXml(xmlData, THREE)
      } else if (compressionMethod === 8) {
        // Deflate - use DecompressionStream
        const compressed = uint8.slice(dataStart, dataStart + compressedSize)
        const ds = new DecompressionStream('deflate-raw')
        const writer = ds.writable.getWriter()
        writer.write(compressed)
        writer.close()
        const reader = ds.readable.getReader()
        const chunks: Uint8Array[] = []
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
        }
        const totalLen = chunks.reduce((sum, c) => sum + c.length, 0)
        const decompressed = new Uint8Array(totalLen)
        let pos = 0
        for (const chunk of chunks) {
          decompressed.set(chunk, pos)
          pos += chunk.length
        }
        const xmlData = new TextDecoder().decode(decompressed)
        return parse3mfXml(xmlData, THREE)
      } else {
        throw new Error(`Unsupported compression method: ${compressionMethod}`)
      }
    }

    offset += 46 + fileNameLen + extraLen + commentLen
  }

  throw new Error('3MF file does not contain a valid 3D model')
}

function parse3mfXml(xmlData: string, THREE: typeof import('three')): { geometry: THREE.BufferGeometry; analysis: MeshAnalysis } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlData, 'text/xml')

  const error = doc.querySelector('parsererror')
  if (error) throw new Error('Error parsing 3MF XML')

  const objects = doc.querySelectorAll('object')
  const allPositions: number[] = []
  const allNormals: number[] = []

  for (const obj of Array.from(objects)) {
    const mesh = obj.querySelector('mesh')
    if (!mesh) continue

    // Parse vertices
    const vertices = mesh.querySelectorAll('vertex')
    const vertexCoords: [number, number, number][] = []
    for (const v of Array.from(vertices)) {
      const x = parseFloat(v.getAttribute('x') || '0')
      const y = parseFloat(v.getAttribute('y') || '0')
      const z = parseFloat(v.getAttribute('z') || '0')
      vertexCoords.push([x, y, z])
    }

    // Parse triangles
    const triangles = mesh.querySelectorAll('triangle')
    for (const t of Array.from(triangles)) {
      const v1 = parseInt(t.getAttribute('v1') || '0')
      const v2 = parseInt(t.getAttribute('v2') || '0')
      const v3 = parseInt(t.getAttribute('v3') || '0')

      if (v1 < vertexCoords.length && v2 < vertexCoords.length && v3 < vertexCoords.length) {
        const [x1, y1, z1] = vertexCoords[v1]
        const [x2, y2, z2] = vertexCoords[v2]
        const [x3, y3, z3] = vertexCoords[v3]

        allPositions.push(x1, y1, z1, x2, y2, z2, x3, y3, z3)

        // Calculate normal
        const ax = x2 - x1, ay = y2 - y1, az = z2 - z1
        const bx = x3 - x1, by = y3 - y1, bz = z3 - z1
        let nx = ay * bz - az * by
        let ny = az * bx - ax * bz
        let nz = ax * by - ay * bx
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
        nx /= len; ny /= len; nz /= len

        for (let i = 0; i < 3; i++) {
          allNormals.push(nx, ny, nz)
        }
      }
    }
  }

  if (allPositions.length === 0) throw new Error('No triangles found in 3MF file')

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3))
  if (allNormals.length > 0) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(allNormals, 3))
  }
  geometry.computeBoundingBox()

  const volume = calcVolumeFromPositions(allPositions)
  const box = geometry.boundingBox!
  const meshSurfaceArea = calculateSurfaceArea(geometry)
  const analysis: MeshAnalysis = {
    volume,
    triangleCount: allPositions.length / 9,
    vertexCount: allPositions.length / 3,
    dimensions: { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z },
    surfaceArea: +meshSurfaceArea.toFixed(2),
    boundingBox: { min: { x: box.min.x, y: box.min.y, z: box.min.z }, max: { x: box.max.x, y: box.max.y, z: box.max.z } },
    integrity: { valid: true, issues: [] },
  }

  return { geometry, analysis }
}

function calcVolumeFromPositions(positions: number[]): number {
  let volume = 0
  const v1 = new (typeof Float32Array !== 'undefined' ? Float32Array : Array)(3)
  const v2 = new (typeof Float32Array !== 'undefined' ? Float32Array : Array)(3)
  const v3 = new (typeof Float32Array !== 'undefined' ? Float32Array : Array)(3)
  const normal = new (typeof Float32Array !== 'undefined' ? Float32Array : Array)(3)

  for (let i = 0; i < positions.length; i += 9) {
    v1[0] = positions[i]; v1[1] = positions[i + 1]; v1[2] = positions[i + 2]
    v2[0] = positions[i + 3]; v2[1] = positions[i + 4]; v2[2] = positions[i + 5]
    v3[0] = positions[i + 6]; v3[1] = positions[i + 7]; v3[2] = positions[i + 8]

    normal[0] = (v2[1] - v1[1]) * (v3[2] - v1[2]) - (v2[2] - v1[2]) * (v3[1] - v1[1])
    normal[1] = (v2[2] - v1[2]) * (v3[0] - v1[0]) - (v2[0] - v1[0]) * (v3[2] - v1[2])
    normal[2] = (v2[0] - v1[0]) * (v3[1] - v1[1]) - (v2[1] - v1[1]) * (v3[0] - v1[0])

    volume += (normal[0] * (v1[0] + v2[0] + v3[0]) + normal[1] * (v1[1] + v2[1] + v3[1]) + normal[2] * (v1[2] + v2[2] + v3[2])) / 6
  }

  return Math.abs(volume)
}

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry()
  const positions: number[] = []
  const normals: number[] = []
  for (const g of geometries) {
    const pos = g.attributes.position
    const norm = g.attributes.normal
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i))
    }
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (normals.length > 0) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return merged
}

export function volumeToCm3(volumeMm3: number): number {
  return volumeMm3 / 1000
}

export function estimateWeight(volumeCm3: number, density: number, infill: number, purge: number): number {
  const infillRatio = infill / 100
  const purgeRatio = purge / 100
  const effectiveVolume = volumeCm3 * (0.2 + 0.8 * infillRatio)
  const waste = effectiveVolume * purgeRatio
  return (effectiveVolume + waste) * density
}
