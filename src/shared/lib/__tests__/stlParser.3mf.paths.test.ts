import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { DecompressionStream as NodeDecompressionStream } from "node:stream/web";
import { analyzeMeshFile, ZipBombError } from "../stlParser";

interface EntrySpec {
  data: Uint8Array;
  /** Método de compressão ZIP: 0 = stored, 8 = deflate. Default 0. */
  method?: number;
  /** Tamanho descomprimido declarado no diretório central (default: data.length). */
  declaredUncompressed?: number;
  /** Tamanho comprimido declarado no diretório central (default: data.length). */
  declaredCompressed?: number;
}

interface ZipOpts {
  /** Força a contagem de entradas no EOCD (simula EOCD mentiroso). */
  eocdCount?: number;
  /** Bytes de padding entre o diretório central e o EOCD. */
  padAfterCentral?: number;
}

/**
 * ZIP mínimo com controle total sobre os tamanhos declarados no diretório
 * central — o que permite simular headers mentirosos sem alocar os bytes.
 */
function makeZip(
  files: Record<string, string | EntrySpec>,
  opts: ZipOpts = {},
): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const [name, spec] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const fixture =
      typeof spec === "string" ? { data: enc.encode(spec) } : spec;
    const data = fixture.data;
    const method = fixture.method ?? 0;
    const declaredU = fixture.declaredUncompressed ?? data.length;
    const declaredC = fixture.declaredCompressed ?? data.length;

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true); // comprimido real
    lv.setUint32(22, data.length, true); // descomprimido real
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, declaredC, true);
    cv.setUint32(24, declaredU, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const pad = new Uint8Array(opts.padAfterCentral ?? 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  const count = opts.eocdCount ?? centrals.length;
  ev.setUint16(8, count, true);
  ev.setUint16(10, count, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + cdSize + pad.length + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of [...locals, ...centrals, pad, eocd]) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

function file3mf(bytes: Uint8Array, name = "test.3mf"): File {
  return new File([bytes as BlobPart], name);
}

/** Cubo 10×10×10 como <mesh> do 3MF. */
const CUBE_MESH = `<mesh>
  <vertices>
    <vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/>
    <vertex x="10" y="10" z="0"/><vertex x="0" y="10" z="0"/>
    <vertex x="0" y="0" z="10"/><vertex x="10" y="0" z="10"/>
    <vertex x="10" y="10" z="10"/><vertex x="0" y="10" z="10"/>
  </vertices>
  <triangles>
    <triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="3" v3="2"/>
    <triangle v1="4" v2="5" v3="6"/><triangle v1="4" v2="6" v3="7"/>
    <triangle v1="0" v2="1" v3="5"/><triangle v1="0" v2="5" v3="4"/>
    <triangle v1="1" v2="2" v3="6"/><triangle v1="1" v2="6" v3="5"/>
    <triangle v1="2" v2="3" v3="7"/><triangle v1="2" v2="7" v3="6"/>
    <triangle v1="3" v2="0" v3="4"/><triangle v1="3" v2="4" v3="7"/>
  </triangles>
</mesh>`;

function model(body: string): string {
  // xmlns:p sempre declarado: p:path sem o prefixo declarado é um erro de
  // well-formedness e o parser rejeita a parte antes de chegar no grafo.
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter"
 xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
 xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
${body}
</model>`;
}

const ROOT_WITH_CUBE = model(
  `  <resources><object id="1" type="model">${CUBE_MESH}</object></resources>
  <build><item objectid="1"/></build>`,
);

/** Polya deflate só quando o teste precisa (jsdom não tem DecompressionStream). */
function withDecompressionStream<T>(fn: () => Promise<T>): Promise<T> {
  const had = typeof globalThis.DecompressionStream !== "undefined";
  if (!had) {
    globalThis.DecompressionStream =
      NodeDecompressionStream as unknown as typeof DecompressionStream;
  }
  return fn().finally(() => {
    if (!had)
      delete (globalThis as Record<string, unknown>).DecompressionStream;
  });
}

describe("3MF — robustez do contêiner ZIP", () => {
  it("rejeita bytes que não são um ZIP (sem EOCD)", async () => {
    await expect(
      analyzeMeshFile(file3mf(new Uint8Array([1, 2, 3, 4]))),
    ).rejects.toThrow(/not a valid ZIP archive/);
  });

  it("tolera um EOCD que declara mais entradas do que existem", async () => {
    // O diretório central tem 1 entrada; o EOCD declara 3 e há padding entre
    // o diretório central e o EOCD. O scan precisa parar (break) no padding
    // sem corromper o pacote.
    const zip = makeZip(
      { "3D/3dmodel.model": ROOT_WITH_CUBE },
      { eocdCount: 3, padAfterCentral: 8 },
    );
    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.volume).toBeCloseTo(1000);
  });

  it("rejeita pacote que declara mais de 1 GB descomprimido no total", async () => {
    // 3 entradas declarando 400 MB descomprimidas cada (1,2 GB no total),
    // cada uma com 10 MB comprimidos declarados — ratio 40:1 abaixo do cap,
    // e cada entrada abaixo do cap individual de 512 MB. Só o cap TOTAL dispara.
    const spec = {
      data: new Uint8Array(8),
      declaredUncompressed: 400 * 1024 * 1024,
      declaredCompressed: 10 * 1024 * 1024,
    };
    const zip = makeZip({
      "3D/3dmodel.model": spec,
      "3D/a.model": spec,
      "3D/b.model": spec,
    });
    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(ZipBombError);
    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(/bytes total/);
  });

  it("rejeita método de compressão desconhecido", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": {
        data: new TextEncoder().encode(ROOT_WITH_CUBE),
        method: 1, // nem stored (0) nem deflate (8)
      },
    });
    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
      /Unsupported compression method: 1/,
    );
  });
});

describe("3MF — seleção do modelo raiz", () => {
  it("usará o primeiro .model do pacote quando não houver 3D/3dmodel.model", async () => {
    const zip = makeZip({
      "[Content_Types].xml": '<?xml version="1.0"?><Types/>',
      "3D/alternate.model": ROOT_WITH_CUBE,
    });
    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.volume).toBeCloseTo(1000);
  });

  it("rejeita pacote sem nenhuma parte .model", async () => {
    const zip = makeZip({
      "[Content_Types].xml": '<?xml version="1.0"?><Types/>',
      "Metadata/myprofile.xml": '<?xml version="1.0"?><Profile/>',
    });
    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
      /does not contain a valid 3D model/,
    );
  });
});

describe("3MF — caminhos de parte (p:path)", () => {
  it("rejeita parte referenciada que não existe no pacote", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": model(
        `  <resources>
    <object id="1" type="model">
      <components>
        <component p:path="/3D/Objects/missing.model" objectid="2"/>
      </components>
    </object>
  </resources>
  <build><item objectid="1"/></build>`,
      ),
    });
    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
      /3MF part not found/,
    );
  });

  it("rejeita XML malformado em uma parte", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": '<?xml version="1.0"?><model><unclosed>',
    });
    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(/3MF XML/);
  });

  it("reaproveita o cache case-insensitive em uma segunda referência", async () => {
    // A mesma parte é referenciada duas vezes com casings diferentes. A
    // primeira referência popula o cache; a segunda precisa acertar o
    // fallback case-insensitive e achar o documento em cache.
    const zip = makeZip({
      "3D/3dmodel.model": model(
        `  <resources>
    <object id="1" type="model">
      <components>
        <component p:path="/3d/objects/object_1.model" objectid="2"/>
        <component p:path="/3D/OBJECTS/object_1.model" objectid="2"/>
      </components>
    </object>
  </resources>
  <build><item objectid="1"/></build>`,
      ),
      "3D/Objects/Object_1.MODEL": model(
        `  <resources><object id="2" type="model">${CUBE_MESH}</object></resources>
  <build/>`,
      ),
    });
    const { analysis } = await analyzeMeshFile(file3mf(zip));
    // Dois componentes → duas cópias do cubo.
    expect(analysis.triangleCount).toBe(24);
  });
});

describe("3MF — grafo de objetos", () => {
  it("emite malha solta quando <build> está vazio", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": model(
        `  <resources><object id="1" type="model">${CUBE_MESH}</object></resources>
  <build/>`,
      ),
    });
    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.volume).toBeCloseTo(1000);
  });

  it("pula item sem objectid e cai na malha solta", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": model(
        `  <resources><object id="1" type="model">${CUBE_MESH}</object></resources>
  <build><item transform="1 0 0 0 1 0 0 0 1 0 0 0"/></build>`,
      ),
    });
    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
  });

  it("pula componente sem objectid", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": model(
        `  <resources>
    <object id="1" type="model">
      <components><component p:path="/3D/Objects/x.model"/></components>
    </object>
  </resources>
  <build><item objectid="1"/></build>`,
      ),
    });
    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
      /No triangles found/,
    );
  });

  it("ignora item cujo objectid não existe e ainda emite a malha solta", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": model(
        `  <resources><object id="1" type="model">${CUBE_MESH}</object></resources>
  <build><item objectid="999"/></build>`,
      ),
    });
    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
  });

  it("trata transform inválido como identidade", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": model(
        `  <resources><object id="1" type="model">${CUBE_MESH}</object></resources>
  <build><item objectid="1" transform="not-a-matrix"/></build>`,
      ),
    });
    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.volume).toBeCloseTo(1000);
  });
});

describe("3MF — tolerância de malha", () => {
  it("tolera atributos ausentes e triângulos degenerados/fora do range", async () => {
    // Vértices sem x/y/z (→ 0) e triângulos sem v1/v2/v3 (→ 0); um triângulo
    // referencia o índice 99 (não existe → descartado) e os demais são
    // degenerados (normal de comprimento 0 → fallback || 1, nunca NaN).
    const zip = makeZip({
      "3D/3dmodel.model": model(
        `  <resources>
  <object id="1" type="model">
    <mesh>
      <vertices>
        <vertex y="5" z="5"/>
        <vertex x="10" z="0"/>
        <vertex x="0" y="10"/>
      </vertices>
      <triangles>
        <triangle v1="0" v2="1"/>
        <triangle v2="0" v3="2"/>
        <triangle v1="0" v3="2"/>
        <triangle v1="0" v2="1" v3="99"/>
      </triangles>
    </mesh>
  </object>
</resources>
  <build><item objectid="1"/></build>`,
      ),
    });
    const { analysis } = await analyzeMeshFile(file3mf(zip));
    // 3 triângulos válidos (99 descartado); todos degenerados → volume 0.
    expect(analysis.triangleCount).toBe(3);
    expect(analysis.volume).toBe(0);
    expect(Number.isFinite(analysis.surfaceArea)).toBe(true);
  });
});

describe("3MF — deflate", () => {
  it("rejeita entrada inflate que expande além do declarado", async () => {
    await withDecompressionStream(async () => {
      const content = new TextEncoder().encode(ROOT_WITH_CUBE);
      // Conteúdo real (~1,2 KB) maior que o declarado (50 bytes): o contador
      // de stream dispara antes do fim. Ratio declarado (50/comprimido) fica
      // abaixo do cap para o filtro do diretório central passar.
      const compressed = new Uint8Array(deflateRawSync(content));
      const zip = makeZip({
        "3D/3dmodel.model": {
          data: compressed,
          method: 8,
          declaredUncompressed: 50,
          declaredCompressed: compressed.length,
        },
      });
      await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(ZipBombError);
      await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
        /expanded past its declared/,
      );
    });
  });

  it("envolve erro de decompressão (bytes corrompidos) sem vazar ZipBombError", async () => {
    await withDecompressionStream(async () => {
      const corrupted = new Uint8Array([0x78, 0x9c, 0xff, 0xff, 0x00, 0x00]);
      // 50 bytes declarados sobre 6 comprimidos: ratio ~8:1 passa no cap e
      // deixa o erro de decompressão chegar (não o zip-bomb do diretório).
      const zip = makeZip({
        "3D/3dmodel.model": {
          data: corrupted,
          method: 8,
          declaredUncompressed: 50,
          declaredCompressed: corrupted.length,
        },
      });
      await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
        /Error decompressing 3MF entry/,
      );
      await expect(analyzeMeshFile(file3mf(zip))).rejects.not.toThrow(
        ZipBombError,
      );
    });
  });

  it("rejeita deflate quando DecompressionStream não está disponível", async () => {
    const saved = (globalThis as Record<string, unknown>).DecompressionStream;
    delete (globalThis as Record<string, unknown>).DecompressionStream;
    try {
      const content = new TextEncoder().encode(ROOT_WITH_CUBE);
      const compressed = new Uint8Array(deflateRawSync(content));
      const zip = makeZip({
        "3D/3dmodel.model": {
          data: compressed,
          method: 8,
          declaredUncompressed: content.length,
          declaredCompressed: compressed.length,
        },
      });
      await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
        /DecompressionStream is unavailable/,
      );
    } finally {
      if (saved !== undefined) {
        (globalThis as Record<string, unknown>).DecompressionStream = saved;
      }
    }
  });
});
