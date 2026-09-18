// SPIKE-ONLY: emit a tiny binary STL cube (12 triangles, 20 mm) for the browser
// smoke test. Not production tooling.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const S = 20;
const c = [
  [0, 0, 0],
  [S, 0, 0],
  [S, S, 0],
  [0, S, 0],
  [0, 0, S],
  [S, 0, S],
  [S, S, S],
  [0, S, S],
];
// [normal, v1, v2, v3]
const faces = [
  [[0, 0, 1], 4, 5, 6],
  [[0, 0, 1], 4, 6, 7],
  [[0, 0, -1], 0, 3, 2],
  [[0, 0, -1], 0, 2, 1],
  [[1, 0, 0], 1, 2, 6],
  [[1, 0, 0], 1, 6, 5],
  [[-1, 0, 0], 0, 4, 7],
  [[-1, 0, 0], 0, 7, 3],
  [[0, 1, 0], 3, 7, 6],
  [[0, 1, 0], 3, 6, 2],
  [[0, -1, 0], 0, 1, 5],
  [[0, -1, 0], 0, 5, 4],
];

const buf = Buffer.alloc(84 + faces.length * 50);
buf.write("spike binary STL cube", 0);
buf.writeUInt32LE(faces.length, 80);
let off = 84;
for (const [n, a, b, d] of faces) {
  buf.writeFloatLE(n[0], off);
  buf.writeFloatLE(n[1], off + 4);
  buf.writeFloatLE(n[2], off + 8);
  off += 12;
  for (const vi of [a, b, d]) {
    const v = c[vi];
    buf.writeFloatLE(v[0], off);
    buf.writeFloatLE(v[1], off + 4);
    buf.writeFloatLE(v[2], off + 8);
    off += 12;
  }
  off += 2;
}

const out = join(dirname(fileURLToPath(import.meta.url)), "spike-cube.stl");
writeFileSync(out, buf);
console.log(`wrote ${out}: ${buf.length} bytes, ${faces.length} triangles`);
