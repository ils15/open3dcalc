import { describe, it, expect, beforeEach } from "vitest";
import {
  useWorkshopProfileStore,
  renderWhatsAppMessage,
  DEFAULT_WORKSHOP_PROFILE,
  DEFAULT_WHATSAPP_TEMPLATES,
  WORKSHOP_PROFILE_KEY,
} from "../workshopProfileStore";
import { guardedStorage } from "@/shared/lib/manifestStorage";

describe("workshopProfileStore & WhatsApp Template Engine", () => {
  beforeEach(() => {
    try {
      guardedStorage.removeItem(WORKSHOP_PROFILE_KEY);
    } catch {
      // ignore
    }
    useWorkshopProfileStore.getState().resetAll();
  });

  it("initializes with default profile and default templates", () => {
    const state = useWorkshopProfileStore.getState();
    expect(state.profile.workshopName).toBe(DEFAULT_WORKSHOP_PROFILE.workshopName);
    expect(state.templates.length).toBe(DEFAULT_WHATSAPP_TEMPLATES.length);
    expect(state.templates[0].id).toBe("quick_quote");
  });

  it("updates workshop profile fields and persists", () => {
    const store = useWorkshopProfileStore.getState();
    store.updateProfile({
      workshopName: "Laboratório 3D Avançado",
      document: "12.345.678/0001-90",
      pixKey: "pix@lab3d.com.br",
      pixType: "email",
    });

    const updated = useWorkshopProfileStore.getState().profile;
    expect(updated.workshopName).toBe("Laboratório 3D Avançado");
    expect(updated.document).toBe("12.345.678/0001-90");
    expect(updated.pixKey).toBe("pix@lab3d.com.br");
    expect(updated.pixType).toBe("email");
  });

  it("sets and removes logoUrl", () => {
    const store = useWorkshopProfileStore.getState();
    store.setLogoUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
    expect(useWorkshopProfileStore.getState().profile.logoUrl).toContain("data:image/png;base64");

    store.removeLogo();
    expect(useWorkshopProfileStore.getState().profile.logoUrl).toBe("");
  });

  it("adds, updates and removes custom templates", () => {
    const store = useWorkshopProfileStore.getState();
    const newId = store.addTemplate({
      name: "Promoção Especial de Natal",
      category: "custom",
      content: "Olá {cliente}! Temos desconto especial no projeto {projeto}!",
    });

    expect(newId).toBeDefined();
    const afterAdd = useWorkshopProfileStore.getState().templates;
    expect(afterAdd.some((t) => t.id === newId)).toBe(true);

    store.updateTemplate(newId, {
      content: "Mensagem atualizada para {cliente}",
    });
    const afterUpdate = useWorkshopProfileStore.getState().templates.find((t) => t.id === newId);
    expect(afterUpdate?.content).toBe("Mensagem atualizada para {cliente}");

    store.removeTemplate(newId);
    const afterRemove = useWorkshopProfileStore.getState().templates;
    expect(afterRemove.some((t) => t.id === newId)).toBe(false);
  });

  it("renderWhatsAppMessage replaces all placeholders accurately", () => {
    const template =
      "Olá {cliente} ({empresa})! Projeto {projeto} de {itens}. Valor R$ {valor_total}. Prazo: {prazo}. PIX ({tipo_chave_pix}): {chave_pix}. Da {nome_oficina}.";

    const rendered = renderWhatsAppMessage(template, {
      cliente: "Carlos Andrade",
      empresa: "Tech Corp",
      projeto: "Gabinete Raspberry Pi",
      itens: "2x Gabinetes em ABS Preto",
      valor_total: "150,00",
      prazo: "2 dias",
      tipo_chave_pix: "cnpj",
      chave_pix: "99.888.777/0001-00",
      nome_oficina: "PrintCraft 3D",
    });

    expect(rendered).toContain("Olá Carlos Andrade (Tech Corp)!");
    expect(rendered).toContain("Projeto Gabinete Raspberry Pi de 2x Gabinetes em ABS Preto.");
    expect(rendered).toContain("Valor R$ 150,00.");
    expect(rendered).toContain("Prazo: 2 dias.");
    expect(rendered).toContain("PIX (CNPJ): 99.888.777/0001-00.");
    expect(rendered).toContain("Da PrintCraft 3D.");
  });
});
