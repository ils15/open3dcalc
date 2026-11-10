import { create } from "zustand";
import { guardedStorage } from "@/shared/lib/manifestStorage";

export const WORKSHOP_PROFILE_KEY = "open3dcalc_workshop_profile_v1";

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: "quick" | "quote" | "production" | "ready" | "followup" | "custom";
  content: string;
}

export interface WorkshopProfile {
  workshopName: string;
  ownerName: string;
  document: string; // CNPJ ou CPF
  phone: string; // WhatsApp
  email: string;
  instagram: string;
  website: string;
  address: string;
  pixKey: string;
  pixType: "cnpj" | "cpf" | "email" | "phone" | "random";
  logoUrl?: string; // base64 data URL
  defaultPaymentTerms: string;
  defaultLeadTime: string;
  defaultWarranty: string;
  reportPrimaryColor: string; // Cor principal para cabeçalho do PDF
}

export interface WhatsAppTemplateContext {
  cliente?: string;
  empresa?: string;
  projeto?: string;
  itens?: string;
  valor_total?: string;
  prazo?: string;
  condicoes_pagamento?: string;
  validade?: string;
  chave_pix?: string;
  tipo_chave_pix?: string;
  nome_oficina?: string;
  telefone_oficina?: string;
  responsavel?: string;
  observacoes?: string;
}

export const DEFAULT_WORKSHOP_PROFILE: WorkshopProfile = {
  workshopName: "Minha Oficina 3D",
  ownerName: "",
  document: "",
  phone: "",
  email: "",
  instagram: "",
  website: "",
  address: "",
  pixKey: "",
  pixType: "cnpj",
  logoUrl: "",
  defaultPaymentTerms: "50% de entrada no pedido e 50% na conclusão",
  defaultLeadTime: "3 a 5 dias úteis",
  defaultWarranty: "Garantia de 90 dias contra defeitos dimensionais de fabricação",
  reportPrimaryColor: "#2563eb",
};

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "quick_quote",
    name: "Proposta Rápida",
    category: "quick",
    content:
      "Olá, *{cliente}*! 👋 Segue a proposta rápida para sua peça 3D:\n\n" +
      "📋 Projeto: *{projeto}*\n" +
      "💰 Valor Total: *R$ {valor_total}*\n" +
      "⏱️ Prazo de produção: *{prazo}*\n" +
      "💳 Pagamento: {condicoes_pagamento}\n\n" +
      "Qualquer dúvida estou à disposição para iniciar a impressão! 🚀\n" +
      "— *{nome_oficina}*",
  },
  {
    id: "detailed_quote",
    name: "Orçamento Comercial Completo",
    category: "quote",
    content:
      "Olá, *{cliente}*! É um prazer atendê-lo(a). Segue o orçamento formal de impressão 3D:\n\n" +
      "📌 *ORÇAMENTO DE FABRICAÇÃO • {nome_oficina}*\n" +
      "• Projeto: *{projeto}*\n" +
      "• Itens: {itens}\n" +
      "• Prazo estimado de fabricação: *{prazo}*\n" +
      "• Validade da proposta: {validade}\n\n" +
      "💰 *Investimento Total: R$ {valor_total}*\n" +
      "💳 Condições Comerciais: {condicoes_pagamento}\n" +
      "🔑 Chave PIX ({tipo_chave_pix}): `{chave_pix}`\n\n" +
      "Gostaria de aprovar a proposta para colocarmos a peça na fila de impressão? 😊",
  },
  {
    id: "in_production",
    name: "Início de Fabricação",
    category: "production",
    content:
      "Ótimas notícias, *{cliente}*! 🎉\n\n" +
      "Seu projeto *{projeto}* acabou de entrar na fila de impressão 3D!\n" +
      "⚙️ Estamos preparando os parâmetros técnicos e aquecendo a máquina.\n" +
      "⏱️ Previsão de término e acabamento: *{prazo}*.\n\n" +
      "Assim que passar pela inspeção final avisamos você! 👍\n" +
      "— *{nome_oficina}*",
  },
  {
    id: "order_ready",
    name: "Peça Pronta para Retirada / Envio",
    category: "ready",
    content:
      "Olá, *{cliente}*! Sua peça 3D está prontinha! ✨\n\n" +
      "📦 Projeto: *{projeto}*\n" +
      "🔍 Inspeção dimensional e remoção de suportes concluídos com sucesso.\n\n" +
      "Podemos combinar a retirada no local ou a postagem para envio? 🚚\n" +
      "— *{nome_oficina}* • {telefone_oficina}",
  },
  {
    id: "followup_friendly",
    name: "Acompanhamento & Follow-up",
    category: "followup",
    content:
      "Olá, *{cliente}*! Tudo bem com você?\n\n" +
      "Passando para saber se conseguiu dar uma olhada na proposta da peça *{projeto}* (*R$ {valor_total}*).\n\n" +
      "Se precisar de algum ajuste de prazo, material ou acabamento, fico à disposição para ajudar a viabilizar o projeto! 😉\n" +
      "— *{nome_oficina}*",
  },
];

/**
 * Renderiza uma mensagem de WhatsApp substituindo os placeholders contextuais.
 */
export function renderWhatsAppMessage(
  templateContent: string,
  context: WhatsAppTemplateContext,
): string {
  let result = templateContent;
  const map: Record<string, string> = {
    "{cliente}": context.cliente || "Cliente",
    "{empresa}": context.empresa || "",
    "{projeto}": context.projeto || "Projeto 3D",
    "{itens}": context.itens || context.projeto || "1x Peça Personalizada",
    "{valor_total}": context.valor_total || "0,00",
    "{prazo}": context.prazo || "3 a 5 dias úteis",
    "{condicoes_pagamento}":
      context.condicoes_pagamento || "A combinar / PIX",
    "{validade}": context.validade || "10 dias",
    "{chave_pix}": context.chave_pix || "",
    "{tipo_chave_pix}": (context.tipo_chave_pix || "PIX").toUpperCase(),
    "{nome_oficina}": context.nome_oficina || "Oficina 3D",
    "{telefone_oficina}": context.telefone_oficina || "",
    "{responsavel}": context.responsavel || "",
    "{observacoes}": context.observacoes || "",
  };

  for (const [key, value] of Object.entries(map)) {
    result = result.replaceAll(key, value);
  }

  return result.trim();
}

interface WorkshopProfileStoreState {
  profile: WorkshopProfile;
  templates: WhatsAppTemplate[];
  updateProfile: (patch: Partial<WorkshopProfile>) => void;
  setLogoUrl: (dataUrl: string) => void;
  removeLogo: () => void;
  addTemplate: (template: Omit<WhatsAppTemplate, "id">) => string;
  updateTemplate: (id: string, patch: Partial<WhatsAppTemplate>) => void;
  removeTemplate: (id: string) => void;
  resetTemplatesToDefault: () => void;
  resetAll: () => void;
}

interface PersistedPayload {
  profile: WorkshopProfile;
  templates: WhatsAppTemplate[];
}

function loadInitialState(): PersistedPayload {
  if (typeof window === "undefined") {
    return {
      profile: { ...DEFAULT_WORKSHOP_PROFILE },
      templates: [...DEFAULT_WHATSAPP_TEMPLATES],
    };
  }
  try {
    const raw = guardedStorage.getItem(WORKSHOP_PROFILE_KEY);
    if (!raw) {
      return {
        profile: { ...DEFAULT_WORKSHOP_PROFILE },
        templates: [...DEFAULT_WHATSAPP_TEMPLATES],
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedPayload>;
    return {
      profile: {
        ...DEFAULT_WORKSHOP_PROFILE,
        ...(parsed.profile || {}),
      },
      templates:
        Array.isArray(parsed.templates) && parsed.templates.length > 0
          ? parsed.templates
          : [...DEFAULT_WHATSAPP_TEMPLATES],
    };
  } catch {
    return {
      profile: { ...DEFAULT_WORKSHOP_PROFILE },
      templates: [...DEFAULT_WHATSAPP_TEMPLATES],
    };
  }
}

function saveToStorage(state: {
  profile: WorkshopProfile;
  templates: WhatsAppTemplate[];
}): void {
  try {
    guardedStorage.setItem(
      WORKSHOP_PROFILE_KEY,
      JSON.stringify({
        profile: state.profile,
        templates: state.templates,
      }),
    );
  } catch {
    // safe fallback
  }
}

const initial = loadInitialState();

export const useWorkshopProfileStore = create<WorkshopProfileStoreState>(
  (set, get) => ({
    profile: initial.profile,
    templates: initial.templates,

    updateProfile: (patch) => {
      const profile = { ...get().profile, ...patch };
      saveToStorage({ profile, templates: get().templates });
      set({ profile });
    },

    setLogoUrl: (logoUrl) => {
      const profile = { ...get().profile, logoUrl };
      saveToStorage({ profile, templates: get().templates });
      set({ profile });
    },

    removeLogo: () => {
      const profile = { ...get().profile, logoUrl: "" };
      saveToStorage({ profile, templates: get().templates });
      set({ profile });
    },

    addTemplate: (tpl) => {
      const id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newTemplate: WhatsAppTemplate = {
        id,
        name: tpl.name.trim() || "Novo Modelo",
        category: tpl.category || "custom",
        content: tpl.content.trim(),
      };
      const templates = [...get().templates, newTemplate];
      saveToStorage({ profile: get().profile, templates });
      set({ templates });
      return id;
    },

    updateTemplate: (id, patch) => {
      const templates = get().templates.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      );
      saveToStorage({ profile: get().profile, templates });
      set({ templates });
    },

    removeTemplate: (id) => {
      const templates = get().templates.filter((t) => t.id !== id);
      saveToStorage({ profile: get().profile, templates });
      set({ templates });
    },

    resetTemplatesToDefault: () => {
      const templates = [...DEFAULT_WHATSAPP_TEMPLATES];
      saveToStorage({ profile: get().profile, templates });
      set({ templates });
    },

    resetAll: () => {
      const profile = { ...DEFAULT_WORKSHOP_PROFILE };
      const templates = [...DEFAULT_WHATSAPP_TEMPLATES];
      saveToStorage({ profile, templates });
      set({ profile, templates });
    },
  }),
);
