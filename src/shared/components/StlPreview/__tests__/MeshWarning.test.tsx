import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MeshWarning } from "../MeshWarning";
import {
  isMeshSuspicious,
  type MeshValidation,
} from "@/shared/lib/meshValidation";

// `t` identidade: os testes validam as CHAVES (pt-BR e en-US são espelho
// estrutural — o contrato i18n está em locales.test.ts).
const t = (key: string) => key;

function baseValidation(
  overrides: Partial<MeshValidation> = {},
): MeshValidation {
  return {
    windingInconsistent: false,
    nonManifoldEdges: 0,
    openEdges: 0,
    degenerateTriangles: 0,
    partial: false,
    ...overrides,
  };
}

describe("MeshWarning — malha íntegra (baseline)", () => {
  it("renderiza nada para uma malha limpa", () => {
    const { container } = render(
      <MeshWarning validation={baseValidation()} t={t} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("MeshWarning — malhas suspeitas", () => {
  it("mostra o aviso e a contagem para malha aberta", () => {
    render(<MeshWarning validation={baseValidation({ openEdges: 4 })} t={t} />);
    expect(screen.getByText("stl.meshWarning.title")).toBeInTheDocument();
    expect(screen.getByText("stl.meshWarning.open")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("mostra o aviso para winding inconsistente (sem contagem)", () => {
    render(
      <MeshWarning
        validation={baseValidation({ windingInconsistent: true })}
        t={t}
      />,
    );
    expect(screen.getByText("stl.meshWarning.winding")).toBeInTheDocument();
    // Nenhum chip de contagem para a flag booleana.
    expect(screen.queryByText("stl.meshWarning.open")).not.toBeInTheDocument();
  });

  it("mostra a contagem de arestas non-manifold", () => {
    render(
      <MeshWarning
        validation={baseValidation({ nonManifoldEdges: 3 })}
        t={t}
      />,
    );
    expect(screen.getByText("stl.meshWarning.nonManifold")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("mostra a contagem de degenerados", () => {
    render(
      <MeshWarning
        validation={baseValidation({ degenerateTriangles: 12 })}
        t={t}
      />,
    );
    expect(screen.getByText("stl.meshWarning.degenerate")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("mostra a nota parcial para malhas acima do threshold", () => {
    render(
      <MeshWarning validation={baseValidation({ partial: true })} t={t} />,
    );
    expect(screen.getByText("stl.meshWarning.partial")).toBeInTheDocument();
  });

  it("lista múltiplas issues juntas + badge de não-confiável", () => {
    render(
      <MeshWarning
        validation={baseValidation({ openEdges: 2, windingInconsistent: true })}
        t={t}
      />,
    );
    expect(screen.getByText("stl.meshWarning.open")).toBeInTheDocument();
    expect(screen.getByText("stl.meshWarning.winding")).toBeInTheDocument();
    expect(screen.getByText("stl.meshWarning.badge")).toBeInTheDocument();
  });

  it("é acessível: role=alert e tooltip ligados", () => {
    render(<MeshWarning validation={baseValidation({ openEdges: 1 })} t={t} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("title", "stl.meshWarning.tooltip");
  });
});

describe("isMeshSuspicious", () => {
  it("undefined → false (G-code e resultados legados)", () => {
    expect(isMeshSuspicious(undefined)).toBe(false);
  });

  it("malha limpa → false", () => {
    expect(isMeshSuspicious(baseValidation())).toBe(false);
  });

  it("qualquer flag → true", () => {
    expect(isMeshSuspicious(baseValidation({ openEdges: 1 }))).toBe(true);
    expect(
      isMeshSuspicious(baseValidation({ windingInconsistent: true })),
    ).toBe(true);
    expect(isMeshSuspicious(baseValidation({ nonManifoldEdges: 1 }))).toBe(
      true,
    );
    expect(isMeshSuspicious(baseValidation({ degenerateTriangles: 1 }))).toBe(
      true,
    );
    expect(isMeshSuspicious(baseValidation({ partial: true }))).toBe(true);
  });
});
