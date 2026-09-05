import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { DecompressionStream as NodeDecompressionStream } from "node:stream/web";
import { analyzeMeshFile, MAX_DEPTH, ZipBombError } from "../stlParser";

/**
 * Escreve um ZIP mínimo com entradas STORED (sem compressão).
 * O parser do 3MF não confere CRC, então o campo vai zerado de propósito —
 * o que interessa aqui é a topologia do pacote, não a integridade dele.
 */
interface ZipFixture {
  /** Bytes já prontos (ex.: saída de deflateRawSync para o método 8). */
  data: Uint8Array;
  method?: 0 | 8;
  /**
   * Tamanho descomprimido declarado no diretório central. Quando omitido,
   * vale o tamanho real — informar outro valor simula um header mentiroso.
   */
  declaredSize?: number;
}

function makeZip(files: Record<string, string | ZipFixture>): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const [name, spec] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const fixture: ZipFixture =
      typeof spec === "string" ? { data: enc.encode(spec) } : spec;
    const data = fixture.data;
    const method = fixture.method ?? 0;
    const declared = fixture.declaredSize ?? data.length;

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // assinatura do cabeçalho local
    lv.setUint16(4, 20, true); // versão necessária
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true); // tamanho comprimido
    lv.setUint32(22, data.length, true); // tamanho original
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // assinatura do diretório central
    cv.setUint16(10, method, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, declared, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true); // deslocamento do cabeçalho local
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + cdSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of [...locals, ...centrals, eocd]) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

/** Um cubo 10×10×10 na origem, como <mesh> do 3MF. */
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

function file3mf(bytes: Uint8Array, name = "test.3mf"): File {
  return new File([bytes as BlobPart], name);
}

describe("3MF parsing", () => {
  it("lê um 3MF simples, com a malha embutida no modelo raiz", async () => {
    const zip = makeZip({
      "[Content_Types].xml": '<?xml version="1.0"?><Types/>',
      "_rels/.rels": '<?xml version="1.0"?><Relationships/>',
      "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="1" type="model">${CUBE_MESH}</object></resources>
  <build><item objectid="1"/></build>
</model>`,
    });

    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.dimensions.x).toBeCloseTo(10);
    expect(analysis.volume).toBeCloseTo(1000);
  });

  it("segue p:path para malhas em partes externas (production extension)", async () => {
    // Layout de projeto do OrcaSlicer/BambuStudio: o modelo raiz não tem
    // malha nenhuma, só um componente apontando para outra parte do ZIP.
    const zip = makeZip({
      "[Content_Types].xml": '<?xml version="1.0"?><Types/>',
      "_rels/.rels": '<?xml version="1.0"?><Relationships/>',
      "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter"
 xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
 xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
  <resources>
    <object id="1" type="model">
      <components>
        <component p:path="/3D/Objects/object_1.model" objectid="2"/>
      </components>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`,
      "3D/Objects/object_1.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="2" type="model">${CUBE_MESH}</object></resources>
  <build/>
</model>`,
    });

    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.volume).toBeCloseTo(1000);
  });

  it("aplica as matrizes de <item> e <component>", async () => {
    // Duas cópias do mesmo cubo, uma na origem e outra deslocada 50 mm em X:
    // sem aplicar a matriz, as duas se empilhariam e a caixa daria 10 mm.
    const zip = makeZip({
      "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="1" type="model">${CUBE_MESH}</object></resources>
  <build>
    <item objectid="1"/>
    <item objectid="1" transform="1 0 0 0 1 0 0 0 1 50 0 0"/>
  </build>
</model>`,
    });

    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(24);
    expect(analysis.dimensions.x).toBeCloseTo(60); // 0..10 e 50..60
    expect(analysis.dimensions.y).toBeCloseTo(10);
  });

  it("não trava com componentes que se auto-referenciam", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <components><component objectid="1"/></components>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`,
    });

    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
      /No triangles found/,
    );
  });

  it("não trava com componentes que se referenciam mutuamente (ciclo A<->B)", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <components><component objectid="2"/></components>
    </object>
    <object id="2" type="model">
      <components><component objectid="1"/></components>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`,
    });

    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
      /No triangles found/,
    );
  });

  it("lê uma entrada deflate (método 8) do ZIP", async () => {
    // jsdom não tem DecompressionStream; o Node 22 tem. Os bytes deflate crus
    // vêm de node:zlib (deflateRawSync = raw deflate, o que o ZIP usa).
    if (typeof globalThis.DecompressionStream === "undefined") {
      globalThis.DecompressionStream =
        NodeDecompressionStream as unknown as typeof DecompressionStream;
    }

    const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="1" type="model">${CUBE_MESH}</object></resources>
  <build><item objectid="1"/></build>
</model>`;
    const modelBytes = new TextEncoder().encode(model);
    const compressed = new Uint8Array(deflateRawSync(modelBytes));
    const zip = makeZip({
      "[Content_Types].xml": '<?xml version="1.0"?><Types/>',
      "3D/3dmodel.model": {
        data: compressed,
        method: 8,
        declaredSize: modelBytes.length,
      },
    });

    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.volume).toBeCloseTo(1000);
  });

  it("rejeita p:path com .. que escapa da raiz do pacote", async () => {
    const zip = makeZip({
      "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter"
 xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
 xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
  <resources>
    <object id="1" type="model">
      <components><component p:path="/3D/../../evil.model" objectid="2"/></components>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`,
      "evil.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="2" type="model">${CUBE_MESH}</object></resources>
  <build/>
</model>`,
    });

    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
      /escapes package root/,
    );
  });

  it("resolve p:path com casing divergente via fallback case-insensitive", async () => {
    // ZIP guarda `3D/Objects/Object_1.MODEL`, mas o p:path usa outro casing:
    // o lookup exato falha e o fallback case-insensitive precisa resolver.
    const zip = makeZip({
      "[Content_Types].xml": '<?xml version="1.0"?><Types/>',
      "_rels/.rels": '<?xml version="1.0"?><Relationships/>',
      "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter"
 xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
 xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
  <resources>
    <object id="1" type="model">
      <components>
        <component p:path="/3d/OBJECTS/object_1.model" objectid="2"/>
      </components>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`,
      "3D/Objects/Object_1.MODEL": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources><object id="2" type="model">${CUBE_MESH}</object></resources>
  <build/>
</model>`,
    });

    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.volume).toBeCloseTo(1000);
  });

  it("preserva geometria com nesting >= 3 (dentro do cap)", async () => {
    // Cadeia de 4 níveis: item -> 1 -> 2 -> 3 -> malha. Com o cap antigo
    // (MAX_DEPTH=2) a malha era descartada em silêncio; com o cap atual
    // ela precisa ser emitida.
    const chainDepth = 4;
    let objects = "";
    for (let i = 1; i <= chainDepth; i++) {
      objects +=
        i < chainDepth
          ? `    <object id="${i}" type="model"><components><component objectid="${i + 1}"/></components></object>\n`
          : `    <object id="${i}" type="model">${CUBE_MESH}</object>\n`;
    }
    const zip = makeZip({
      "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
${objects}  </resources>
  <build><item objectid="1"/></build>
</model>`,
    });

    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.volume).toBeCloseTo(1000);
  });

  it("infla entrada deflate grande (> buffer interno) sem deadlock por backpressure", async () => {
    // Regressão: o padrão sequencial `await write -> await close -> read`
    // trava em payloads reais (35KB->164KB trava no close(); só payloads
    // minúsculos cabem no buffer interno do DecompressionStream). A leitura
    // precisa ser concorrente ao close. Este XML repetitivo infla para
    // ~1.5MB — muito acima do buffer — e trava para sempre com o padrão
    // antigo; com o pump concorrente infla em ms.
    if (typeof globalThis.DecompressionStream === "undefined") {
      globalThis.DecompressionStream =
        NodeDecompressionStream as unknown as typeof DecompressionStream;
    }

    // Conteúdo variado de propósito: precisa inflar para >1MB (bem acima
    // do buffer interno do DecompressionStream) mas com ratio baixo (~2:1,
    // como peça real) para não tripar o cap MAX_RATIO=100:1. Um bloco
    // puramente repetitivo comprimiria 400:1+ e seria (corretamente)
    // rejeitado como bomba.
    const padding = Array.from(
      { length: 120000 },
      (_, i) => `v${i}x${((i * 2654435761) >>> 0).toString(36)}`,
    ).join(" "); // ~1.7MB, ratio ~2:1
    const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <!-- ${padding} -->
  <resources><object id="1" type="model">${CUBE_MESH}</object></resources>
  <build><item objectid="1"/></build>
</model>`;
    const modelBytes = new TextEncoder().encode(model);
    expect(modelBytes.length).toBeGreaterThan(1024 * 1024);
    const compressed = new Uint8Array(deflateRawSync(modelBytes));
    const zip = makeZip({
      "[Content_Types].xml": '<?xml version="1.0"?><Types/>',
      "3D/3dmodel.model": {
        data: compressed,
        method: 8,
        declaredSize: modelBytes.length,
      },
    });

    const { analysis } = await analyzeMeshFile(file3mf(zip));
    expect(analysis.triangleCount).toBe(12);
    expect(analysis.volume).toBeCloseTo(1000);
  }, 20000);

  it("estoura o cap de profundidade com ZipBombError em vez de drop silencioso", async () => {
    // Cadeia mais longa que MAX_DEPTH: precisa falhar alto, nunca perder
    // geometria em silêncio.
    const chainLen = MAX_DEPTH + 3;
    let objects = "";
    for (let i = 1; i <= chainLen; i++) {
      objects +=
        i < chainLen
          ? `    <object id="${i}" type="model"><components><component objectid="${i + 1}"/></components></object>\n`
          : `    <object id="${i}" type="model">${CUBE_MESH}</object>\n`;
    }
    const zip = makeZip({
      "3D/3dmodel.model": `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
${objects}  </resources>
  <build><item objectid="1"/></build>
</model>`,
    });

    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(ZipBombError);
    await expect(analyzeMeshFile(file3mf(zip))).rejects.toThrow(
      /maximum component depth/,
    );
  });
});
