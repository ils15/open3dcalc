import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Shield } from "lucide-react";
import { useConsentStore } from "@/shared/stores/consentStore";

interface ConsentModalProps {
  open: boolean;
  onRequestClose?: () => void;
}

export function ConsentModal({ open, onRequestClose }: ConsentModalProps) {
  const { t } = useTranslation();
  const giveConsent = useConsentStore((s) => s.giveConsent);
  const dialogRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const [showPolicy, setShowPolicy] = useState(false);

  // Focus trap + ESC close
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => acceptRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Cannot close without consent — but allow closing via policy
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleAccept = () => {
    giveConsent();
    onRequestClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("privacy.consent.title")}
    >
      <div
        ref={dialogRef}
        className="surface rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 rounded-full bg-[var(--color-accent)]/10">
            <Shield className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {t("privacy.consent.title")}
            </h2>
          </div>
        </div>

        {!showPolicy ? (
          <>
            {/* Consent text */}
            <div className="space-y-3 mb-6">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {t("privacy.consent.text1")}
              </p>
              <ol className="space-y-2 text-sm text-[var(--color-text-muted)] list-decimal list-inside leading-relaxed">
                <li>{t("privacy.consent.item1")}</li>
                <li>{t("privacy.consent.item2")}</li>
                <li>{t("privacy.consent.item3")}</li>
                <li>{t("privacy.consent.item4")}</li>
                <li>{t("privacy.consent.item5")}</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row-reverse gap-3">
              <button
                ref={acceptRef}
                onClick={handleAccept}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--accent-fill)] text-[var(--accent-fill-fg)] hover:bg-[var(--accent-fill-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              >
                {t("privacy.consent.accept")}
              </button>
              <button
                onClick={() => setShowPolicy(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
              >
                {t("privacy.consent.readPolicy")}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Privacy Policy inline */}
            <PrivacyPolicyContent onBack={() => setShowPolicy(false)} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Privacy policy content rendered inline inside the consent modal.
 * Must be a separate named function to keep ConsentModal clean.
 */
function PrivacyPolicyContent({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-sm text-[var(--color-text-muted)] leading-relaxed max-h-[50vh] overflow-y-auto pr-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">
          {t("privacy.policy.title")}
        </h3>
        <button
          onClick={onBack}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] p-1 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none text-xs"
        >
          {t("common.back", "Voltar")}
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        Última atualização: 28 de Junho de 2026
      </p>

      <Section title="1. Modelo de Dados">
        <p>
          O Open3DCalc é uma aplicação 100% client-side. Todos os dados
          inseridos pelo usuário — parâmetros de cálculo, dados de clientes,
          orçamentos, configurações — são armazenados exclusivamente no
          navegador do usuário (localStorage). Nenhum dado é enviado,
          transmitido ou armazenado em servidores externos.
        </p>
      </Section>

      <Section title="2. Base Legal (LGPD)">
        <p>Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018):</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Art. 7º, I: mediante consentimento do titular</li>
          <li>Art. 10º: legítimo interesse do controlador</li>
          <li>Art. 46º: segurança dos dados</li>
        </ul>
      </Section>

      <Section title="3. Direitos do Titular (Art. 18 LGPD)">
        <p>Você pode a qualquer momento:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Acessar seus dados (via interface do app)</li>
          <li>Corrigir dados incompletos ou desatualizados</li>
          <li>Excluir seus dados (botão "Limpar todos os dados")</li>
          <li>Exportar seus dados em formato JSON</li>
        </ul>
      </Section>

      <Section title="4. Transferência Internacional">
        <p>
          Não há transferência internacional de dados, pois nenhum dado sai do
          seu dispositivo.
        </p>
      </Section>

      <Section title="5. Retenção de Dados">
        <p>Os dados permanecem no navegador até que você:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Limpe o cache do navegador</li>
          <li>Clique em "Limpar todos os dados"</li>
          <li>Desinstale o aplicativo</li>
        </ul>
      </Section>

      <Section title="6. Segurança (Art. 46 LGPD)">
        <p>Recomendamos:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Fazer backup regular dos dados (export JSON)</li>
          <li>Manter o navegador atualizado</li>
          <li>
            Não utilizar em computadores compartilhados sem limpar os dados ao
            final
          </li>
        </ul>
      </Section>

      <Section title="7. Contato">
        <p>
          Desenvolvido por @ils15. Para questões de privacidade, abra uma issue
          em{" "}
          <a
            href="https://github.com/ils15/open3dcalc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:text-[var(--color-accent-light)] underline underline-offset-2"
          >
            github.com/ils15/open3dcalc
          </a>
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="font-semibold text-[var(--color-text-secondary)] mb-1.5">
        {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
