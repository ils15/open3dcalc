import React, { useState, useRef } from "react";
import {
  Building2,
  Phone,
  QrCode,
  Image as ImageIcon,
  Check,
  Trash2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Clock,
  CreditCard,
} from "lucide-react";
import confetti from "canvas-confetti";
import { BrandIcon } from "@/shared/components/BrandIcon";
import {
  useWorkshopProfileStore,
  type WhatsAppTemplate,
} from "@/shared/stores/workshopProfileStore";
import { StudioWhatsAppModal } from "@/platform/web/components/studio/StudioWhatsAppModal";

const THEME_COLORS = [
  { name: "Azul Studio", hex: "#2563eb" },
  { name: "Índigo Profissional", hex: "#4f46e5" },
  { name: "Roxo Tech", hex: "#7c3aed" },
  { name: "Esmeralda Oficina", hex: "#059669" },
  { name: "Laranja Criativo", hex: "#ea580c" },
  { name: "Grafite Executivo", hex: "#334155" },
];

export const WorkshopBusinessProfileView: React.FC = () => {
  const {
    profile,
    templates,
    updateProfile,
    setLogoUrl,
    removeLogo,
    addTemplate,
    updateTemplate,
    removeTemplate,
    resetTemplatesToDefault,
  } = useWorkshopProfileStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTestWhatsAppOpen, setIsTestWhatsAppOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateEditName, setTemplateEditName] = useState("");
  const [templateEditContent, setTemplateEditContent] = useState("");
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem da logomarca deve ter no máximo 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setLogoUrl(dataUrl);
        confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStartEditTemplate = (tpl: WhatsAppTemplate) => {
    setEditingTemplateId(tpl.id);
    setTemplateEditName(tpl.name);
    setTemplateEditContent(tpl.content);
    setIsCreatingTemplate(false);
  };

  const handleSaveEditTemplate = () => {
    if (!editingTemplateId) return;
    updateTemplate(editingTemplateId, {
      name: templateEditName,
      content: templateEditContent,
    });
    setEditingTemplateId(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleCreateTemplate = () => {
    if (!templateEditName.trim() || !templateEditContent.trim()) return;
    addTemplate({
      name: templateEditName,
      category: "custom",
      content: templateEditContent,
    });
    setIsCreatingTemplate(false);
    setTemplateEditName("");
    setTemplateEditContent("");
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 text-text-primary animate-fade-in pb-12">
      {/* Top Banner Notice */}
      <div className="p-4 rounded-2xl bg-surface-raised border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-subtle border border-border-accent flex items-center justify-center text-accent shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-text-primary">
              Identidade Comercial & Integração WhatsApp
            </h3>
            <p className="text-xs text-text-secondary">
              Personalize o nome da sua oficina, logotipo em PDF, chave PIX e modelos de mensagens.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsTestWhatsAppOpen(true)}
          className="flex min-h-11 items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-positive-fill)] bg-[var(--color-positive-fill)] text-xs font-bold text-[var(--color-positive-fill-fg)] shadow-sm hover:brightness-110 active:scale-[.98] transition-all shrink-0"
        >
          <BrandIcon brand="whatsapp" className="w-4 h-4" />
          <span>Testar Envio WhatsApp</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Workshop Identity & PIX */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Section 1: Logo & Brand */}
          <div className="p-5 rounded-2xl bg-surface-raised border border-border-subtle flex flex-col gap-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <ImageIcon className="w-4 h-4 text-accent" />
              <h4 className="font-bold text-sm text-text-primary">Identidade Visual & Logotipo</h4>
            </div>

            <div className="flex items-center gap-4">
              {/* Logo Preview Avatar */}
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border-subtle bg-surface-sunken flex items-center justify-center overflow-hidden shrink-0 relative group">
                {profile.logoUrl ? (
                  <>
                    <img
                      src={profile.logoUrl}
                      alt="Logomarca da Oficina"
                      className="w-full h-full object-contain p-1"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      title="Remover logotipo"
                      className="absolute inset-0 bg-surface-overlay/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-text-primary transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <ImageIcon className="w-8 h-8 text-text-muted" />
                )}
              </div>

              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <span className="text-xs font-bold text-text-primary">
                  {profile.logoUrl ? "Logotipo Carregado" : "Nenhum Logotipo Enviado"}
                </span>
                <p className="text-[11px] text-text-secondary">
                  Esta imagem é inserida no cabeçalho das propostas em PDF e relatórios técnicos.
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-h-9 items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-sunken text-xs font-semibold text-text-primary hover:bg-surface-raised transition-colors"
                  >
                    <span>Carregar Logo (PNG/JPG)</span>
                  </button>
                  {profile.logoUrl && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="text-xs text-danger hover:underline px-2"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs: Workshop Name & Document */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-subtle">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Nome da Oficina / Estúdio
                </label>
                <input
                  type="text"
                  placeholder="Ex: PrintCraft 3D Studio"
                  value={profile.workshopName}
                  onChange={(e) => updateProfile({ workshopName: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  CNPJ ou CPF
                </label>
                <input
                  type="text"
                  placeholder="00.000.000/0001-00"
                  value={profile.document}
                  onChange={(e) => updateProfile({ document: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            {/* Owner Name & Contact Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Responsável Técnico
                </label>
                <input
                  type="text"
                  placeholder="Ex: Alexandre Santos"
                  value={profile.ownerName}
                  onChange={(e) => updateProfile({ ownerName: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  WhatsApp Oficial da Oficina
                </label>
                <div className="relative flex items-center">
                  <Phone className="w-3.5 h-3.5 absolute left-3 text-text-muted" />
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={profile.phone}
                    onChange={(e) => updateProfile({ phone: e.target.value })}
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </div>
              </div>
            </div>

            {/* Email & Instagram */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  E-mail Comercial
                </label>
                <input
                  type="email"
                  placeholder="contato@minhaoficina.com.br"
                  value={profile.email}
                  onChange={(e) => updateProfile({ email: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Instagram (@usuario)
                </label>
                <input
                  type="text"
                  placeholder="@oficina3d"
                  value={profile.instagram}
                  onChange={(e) => updateProfile({ instagram: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            {/* Report Accent Color Selection */}
            <div className="pt-2 border-t border-border-subtle">
              <label className="text-xs font-medium text-text-secondary mb-2 block">
                Cor de Destaque para Relatórios em PDF
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {THEME_COLORS.map((clr) => {
                  const isSelected = profile.reportPrimaryColor === clr.hex;
                  return (
                    <button
                      key={clr.hex}
                      type="button"
                      onClick={() => updateProfile({ reportPrimaryColor: clr.hex })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? "border-accent bg-accent-subtle text-accent shadow-sm"
                          : "border-border-subtle bg-surface-sunken text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: clr.hex }}
                      />
                      <span>{clr.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: PIX & Commercial Terms */}
          <div className="p-5 rounded-2xl bg-surface-raised border border-border-subtle flex flex-col gap-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <QrCode className="w-4 h-4 text-positive" />
              <h4 className="font-bold text-sm text-text-primary">Chave PIX & Condições Comerciais</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Tipo da Chave
                </label>
                <select
                  value={profile.pixType}
                  onChange={(e) =>
                    updateProfile({
                      pixType: e.target.value as "cnpj" | "cpf" | "email" | "phone" | "random",
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                >
                  <option value="cnpj">CNPJ</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Celular</option>
                  <option value="random">Chave Aleatória</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-text-secondary mb-1 block">
                  Chave PIX para Recebimentos
                </label>
                <input
                  type="text"
                  placeholder="Insira sua chave PIX..."
                  value={profile.pixKey}
                  onChange={(e) => updateProfile({ pixKey: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs font-mono text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            {/* Default Terms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-text-muted" />
                  <span>Condições de Pagamento Padrão</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: 50% entrada e 50% entrega"
                  value={profile.defaultPaymentTerms}
                  onChange={(e) => updateProfile({ defaultPaymentTerms: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary mb-1 block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-text-muted" />
                  <span>Prazo Padrão de Fabricação</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: 3 a 5 dias úteis"
                  value={profile.defaultLeadTime}
                  onChange={(e) => updateProfile({ defaultLeadTime: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-text-muted" />
                <span>Termo de Garantia & Tolerância</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Garantia de 90 dias contra defeitos de fabricação dimensional"
                value={profile.defaultWarranty}
                onChange={(e) => updateProfile({ defaultWarranty: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-surface-sunken border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>
        </div>

        {/* Right Column: WhatsApp Templates Manager */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="p-5 rounded-2xl bg-surface-raised border border-border-subtle flex flex-col gap-4 shadow-sm h-full">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <BrandIcon brand="whatsapp" className="w-4 h-4 text-positive" />
                <h4 className="font-bold text-sm text-text-primary">
                  Modelos de Mensagens para WhatsApp ({templates.length})
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetTemplatesToDefault}
                  className="flex items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-accent transition-colors"
                  title="Restaurar modelos originais de fábrica"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingTemplate(true);
                    setEditingTemplateId(null);
                    setTemplateEditName("");
                    setTemplateEditContent("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] text-xs font-bold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Modelo</span>
                </button>
              </div>
            </div>

            {saveSuccess && (
              <div className="p-2.5 rounded-xl bg-positive-subtle border border-positive/30 text-positive text-xs flex items-center gap-2 animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>Modelo salvo com sucesso!</span>
              </div>
            )}

            {/* Template Editor Drawer (Create or Edit) */}
            {(isCreatingTemplate || editingTemplateId) && (
              <div className="p-4 rounded-xl bg-surface-sunken border border-border-subtle flex flex-col gap-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary">
                    {isCreatingTemplate ? "Novo Modelo Customizado" : "Editar Modelo"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingTemplate(false);
                      setEditingTemplateId(null);
                    }}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    Cancelar
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Nome do Modelo (ex: Notificação de Entrega)"
                  value={templateEditName}
                  onChange={(e) => setTemplateEditName(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-surface-overlay border border-border-subtle text-xs text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />

                <textarea
                  rows={6}
                  placeholder="Texto da mensagem com placeholders ({cliente}, {projeto}, {valor_total}, {chave_pix}...)"
                  value={templateEditContent}
                  onChange={(e) => setTemplateEditContent(e.target.value)}
                  className="p-3 rounded-lg bg-surface-overlay border border-border-subtle text-xs font-mono text-text-primary outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
                />

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 text-[10px] text-text-muted">
                    <span>Dica: Use *texto* para negrito no WhatsApp.</span>
                  </div>
                  <button
                    type="button"
                    onClick={isCreatingTemplate ? handleCreateTemplate : handleSaveEditTemplate}
                    disabled={!templateEditName.trim() || !templateEditContent.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent-fill)] text-[var(--color-accent-fill-fg)] text-xs font-bold disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar Modelo</span>
                  </button>
                </div>
              </div>
            )}

            {/* List of Templates */}
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-3.5 rounded-xl bg-surface-sunken border border-border-subtle flex flex-col gap-2 transition-all hover:border-border-accent/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-text-primary flex items-center gap-2">
                      <span>{tpl.name}</span>
                      <span className="text-[9px] font-mono font-normal uppercase px-1.5 py-0.2 rounded bg-surface-raised border border-border-subtle text-text-secondary">
                        {tpl.category}
                      </span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEditTemplate(tpl)}
                        className="text-[11px] font-medium text-accent hover:underline px-1.5"
                      >
                        Editar
                      </button>
                      {templates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTemplate(tpl.id)}
                          className="text-text-muted hover:text-danger p-1"
                          title="Remover modelo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-text-secondary whitespace-pre-wrap font-sans line-clamp-3 bg-surface-overlay p-2.5 rounded-lg border border-border-subtle/50">
                    {tpl.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive WhatsApp Composer Modal for testing */}
      <StudioWhatsAppModal
        isOpen={isTestWhatsAppOpen}
        onClose={() => setIsTestWhatsAppOpen(false)}
        initialData={{
          clientName: "Cliente Exemplo",
          projectName: "Suporte Articulado Pro",
          totalValue: 85.0,
          leadTime: profile.defaultLeadTime,
          paymentTerms: profile.defaultPaymentTerms,
        }}
      />
    </div>
  );
};
