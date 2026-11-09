import React from "react";
import { ShieldCheck, ExternalLink, BookOpen, Clock } from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { BrandIcon } from "@/shared/components/BrandIcon";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { APP_VERSION } from "@/shared/version";

interface StudioFooterProps {
  onTabChange?: (tab: Tab) => void;
}

export const StudioFooter: React.FC<StudioFooterProps> = ({ onTabChange }) => {
  return (
    <footer className="mt-14 pt-8 pb-6 border-t border-border-subtle bg-surface-raised/40 rounded-3xl p-6 sm:p-8 transition-colors">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Brand & Slogan */}
        <div className="md:col-span-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-subtle flex items-center justify-center text-accent font-black text-xs border border-accent/30">
              3D
            </div>
            <span className="font-bold text-base text-text-primary tracking-tight">
              Open3DCalc Studio
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-subtle border border-accent/30 text-accent font-semibold">
              v{APP_VERSION}
            </span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed max-w-sm">
            Calculadora inteligente de custos, formação de preços e gestão para impressão 3D profissional. 100% gratuito e de código aberto.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-sunken border border-border-subtle text-[11px] text-text-secondary">
            <ShieldCheck className="w-4 h-4 text-positive shrink-0" />
            <span>Local-First: seus dados e arquivos nunca saem deste computador</span>
          </div>
        </div>

        {/* Quick Nav Links */}
        <div className="md:col-span-4 space-y-3">
          <h4 className="text-[11px] font-mono uppercase font-bold tracking-wider text-text-muted">
            Módulos & Ferramentas
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {onTabChange && (
              <>
                <button
                  type="button"
                  onClick={() => onTabChange("calculator")}
                  className="text-left text-text-secondary hover:text-accent transition-colors"
                >
                  Calculadora
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange("catalog")}
                  className="text-left text-text-secondary hover:text-accent transition-colors"
                >
                  Minha Oficina
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange("quotes")}
                  className="text-left text-text-secondary hover:text-accent transition-colors"
                >
                  Orçamentos
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange("customers")}
                  className="text-left text-text-secondary hover:text-accent transition-colors"
                >
                  Clientes
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange("infill")}
                  className="text-left text-text-secondary hover:text-accent transition-colors"
                >
                  Simulador de Infill
                </button>
                {!isBetaChannel && (
                  <button
                    type="button"
                    onClick={() => onTabChange("privacy")}
                    className="text-left text-text-secondary hover:text-accent transition-colors"
                  >
                    Privacidade & Dados
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Resources & Open Source */}
        <div className="md:col-span-3 space-y-3">
          <h4 className="text-[11px] font-mono uppercase font-bold tracking-wider text-text-muted">
            Recursos & Comunidade
          </h4>
          <ul className="space-y-2 text-xs">
            {onTabChange && (
              <>
                <li>
                  <button
                    type="button"
                    onClick={() => onTabChange("wiki")}
                    className="flex items-center gap-1.5 text-text-secondary hover:text-accent transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Base de Conhecimento</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onTabChange("changelog")}
                    className="flex items-center gap-1.5 text-text-secondary hover:text-accent transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Notas de Versão (v{APP_VERSION})</span>
                  </button>
                </li>
              </>
            )}
            <li>
              <a
                href="https://github.com/ils15/open3dcalc"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-text-secondary hover:text-accent transition-colors"
              >
                <BrandIcon brand="github" className="w-3.5 h-3.5" />
                <span>Código Aberto (GitHub)</span>
                <ExternalLink className="w-3 h-3 text-text-muted ml-auto" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar: Copyright & Version info */}
      <div className="mt-8 pt-4 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-text-muted">
        <div>
          <span>Open3DCalc • Licença Aberta MIT • Comunidade Maker & 3D</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-sunken border border-border-subtle font-mono text-xs font-bold text-text-primary shadow-xs">
            <span className="w-2 h-2 rounded-full bg-positive inline-block animate-pulse shrink-0" />
            Versão v{APP_VERSION}
          </span>
          <span className="font-mono text-[11px] text-text-muted hidden sm:inline">
            • Desktop & Web
          </span>
        </div>
      </div>
    </footer>
  );
};
