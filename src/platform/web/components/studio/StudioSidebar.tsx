import React from "react";
import {
  Box,
  Calculator,
  BarChart3,
  Grid3x3,
  Warehouse,
  Clock,
  Users,
  BookOpen,
  FileText,
  Package,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Tab } from "@/shared/components/AppShell/tabs";
import { BrandIcon } from "@/shared/components/BrandIcon";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "@/shared/version";

interface StudioSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Optional per-module decoration (static hint and/or live count). */
  modules?: StudioModule[];
}

export interface StudioSubModule {
  id: Tab;
  label: string;
  countBadge?: number;
  badgeCount?: number;
}

export interface StudioModule {
  id: Tab;
  label: string;
  icon: React.ReactElement;
  group?: "production" | "commercial" | "workshop";
  /** Small static hint rendered after the label (e.g. "beta"). */
  badge?: string;
  /** Live count badge, e.g. the number of quotes awaiting action. */
  countBadge?: number;
  /** Optional direct 1-click sub-routes rendered when the sidebar is expanded. */
  subItems?: StudioSubModule[];
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  modules,
}) => {
  const { t } = useTranslation();
  const allModules: StudioModule[] = [
    {
      id: "calculator" as Tab,
      label: t("nav.calculator"),
      icon: <Calculator className="w-4 h-4" />,
      group: "production",
    },
    {
      id: "dashboard" as Tab,
      label: t("nav.dashboard"),
      icon: <BarChart3 className="w-4 h-4" />,
      group: "production",
    },
    {
      id: "infill" as Tab,
      label: t("nav.infill"),
      icon: <Grid3x3 className="w-4 h-4" />,
      group: "production",
    },
    {
      id: "quotes" as Tab,
      label: t("nav.quotes"),
      icon: <FileText className="w-4 h-4" />,
      group: "commercial",
    },
    {
      id: "history" as Tab,
      label: t("nav.history"),
      icon: <Clock className="w-4 h-4" />,
      group: "commercial",
    },
    {
      id: "customers" as Tab,
      label: t("nav.customers"),
      icon: <Users className="w-4 h-4" />,
      group: "commercial",
    },
    {
      id: "products" as Tab,
      label: t("nav.products"),
      icon: <Package className="w-4 h-4" />,
      group: "commercial",
    },
    {
      id: "catalog" as Tab,
      label: t("nav.catalog"),
      icon: <Warehouse className="w-4 h-4" />,
      group: "workshop",
      subItems: [
        {
          id: "catalog" as Tab,
          label: t("nav.workshopSubPrinters"),
        },
        {
          id: "inventory" as Tab,
          label: t("nav.workshopSubInventory"),
        },
        {
          id: "marketplace" as Tab,
          label: t("nav.workshopSubMarketplace"),
        },
      ],
    },
    {
      id: "privacy" as Tab,
      label: t("nav.privacy"),
      icon: <ShieldCheck className="w-4 h-4" />,
      group: "workshop",
    },
  ];

  // Beta is a Web-only synthetic channel: the privacy route is gated in
  // StudioLayout (`activeTab === "privacy" && !isBetaChannel`), so leaving the
  // sidebar entry visible would land Beta on a blank view. Mirror
  // StudioSubHeader's filter and hide it here too.
  const visibleModules = isBetaChannel
    ? allModules.filter((m) => m.id !== "privacy")
    : allModules;

  // The caller may override a module to attach a badge/count; unknown ids fall
  // back to the default entry so a typo degrades to a plain item instead of
  // dropping a navigation destination.
  const resolvedModules = visibleModules.map((m) => {
    const override = modules?.find((o) => o.id === m.id);
    if (!override) return m;
    const mergedSubItems = m.subItems?.map((sub) => {
      const subOverride = override.subItems?.find((so) => so.id === sub.id);
      return subOverride ? { ...sub, ...subOverride } : sub;
    });
    return {
      ...m,
      ...override,
      group: m.group,
      subItems: mergedSubItems ?? override.subItems ?? m.subItems,
    };
  });

  const moduleGroups: Array<{
    key: NonNullable<StudioModule["group"]>;
    label: string;
    items: StudioModule[];
  }> = [
    {
      key: "production" as const,
      label: t("nav.groupProduction"),
      items: resolvedModules.filter((m) => m.group === "production"),
    },
    {
      key: "commercial" as const,
      label: t("nav.groupCommercial"),
      items: resolvedModules.filter((m) => m.group === "commercial"),
    },
    {
      key: "workshop" as const,
      label: t("nav.groupWorkshop"),
      items: resolvedModules.filter((m) => m.group === "workshop"),
    },
  ].filter((g) => g.items.length > 0);

  const resources = [
    {
      label: t("nav.docsWiki"),
      icon: <BookOpen className="w-3.5 h-3.5" />,
      tab: "wiki" as Tab,
    },
    {
      label: t("nav.releaseNotes"),
      icon: <FileText className="w-3.5 h-3.5" />,
      tab: "changelog" as Tab,
    },
    {
      label: t("nav.github"),
      icon: <BrandIcon brand="github" className="w-3.5 h-3.5" />,
      href: "https://github.com/ils15/open3dcalc",
    },
    {
      label: t("nav.communityTelegram"),
      icon: <BrandIcon brand="telegram" className="w-3.5 h-3.5" />,
      href: "https://t.me/open3dcalc",
    },
  ];

  // The sidebar is now the only module navigation at every breakpoint, so its
  // collapsed rail and all destinations must remain usable as 44px targets.
  const navTarget = "min-h-11 min-w-11";
  const railWidth = collapsed ? "w-[68px]" : "w-56";
  const sidebarTopClassName = "flex-1 min-h-0 overflow-y-auto";
  const sidebarBottomClassName =
    "shrink-0 p-3 border-t border-[var(--color-border)]";

  return (
    /* Beta keeps the dock in document flow and uses an internal sidebar
       scroller so currency + collapse stay reachable at short heights. Stable
       keeps the fixed dock and reserves its page clearance in the dock itself.
       The workspace starts below the 48px header + 44px subheader; subtract
       both in Beta so its pinned bottom controls remain inside the viewport. */
    <aside
      className={
        isBetaChannel
          ? `bg-surface-raised border-r border-border-subtle flex flex-col select-none shrink-0 transition-all duration-200 z-30 sticky top-0 h-[calc(100vh-92px)] ${railWidth}`
          : `bg-surface-raised border-r border-border-subtle flex flex-col select-none shrink-0 transition-all duration-200 z-30 h-full min-h-0 overflow-hidden ${railWidth}`
      }
    >
      {/* Top branding and navigation; Beta makes this block internally scrollable. */}
      <div className={sidebarTopClassName}>
        <div className="h-12 border-b border-[var(--color-border)] px-3.5 flex items-center gap-2.5 bg-[var(--color-bg-elevated)]/60">
          <div className="w-8 h-8 rounded-xl bg-[var(--color-accent-fill)] flex items-center justify-center text-[var(--color-accent-fill-fg)] shadow-sm shrink-0">
            <Box className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-extrabold text-sm text-[var(--color-text-primary)] tracking-tight leading-none truncate">
                  Open3DCalc
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-border-accent)] inline-block leading-none shrink-0">
                  v{APP_VERSION}
                </span>
              </div>
              <span className="mt-1 text-[10px] font-medium text-[var(--color-text-muted)] leading-none truncate">
                3D Print Studio
              </span>
            </div>
          )}
        </div>

        {/* Grouped Modules Navigation */}
        <div className="px-2.5 py-2.5">
          <nav
            id="beta-sidebar-nav"
            aria-label={t("nav.mainNavigation")}
            className="flex flex-col gap-3"
          >
            {moduleGroups.map((group, groupIdx) => (
              <div key={group.key} className="flex flex-col gap-0.5">
                {!collapsed ? (
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-muted)] px-2 mb-1">
                    {group.label}
                  </p>
                ) : (
                  groupIdx > 0 && (
                    <div
                      aria-hidden="true"
                      className="h-px bg-[var(--color-border)] mx-2 mb-1.5"
                    />
                  )
                )}
                {group.items.map((m) => {
                  const isActive =
                    activeTab === m.id ||
                    (m.id === "catalog" &&
                      (activeTab === "inventory" ||
                        activeTab === "marketplace"));
                  const hasCount =
                    typeof m.countBadge === "number" && m.countBadge > 0;
                  return (
                    <div key={m.id} className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => onTabChange(m.id)}
                        title={m.label}
                        aria-label={m.label}
                        aria-current={isActive ? "page" : undefined}
                        className={`relative w-full flex ${navTarget} items-center ${
                          collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                        } py-1.5 rounded-xl text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] ${
                          isActive
                            ? "bg-[var(--color-accent-wash)] text-[var(--color-accent)] border border-[var(--color-border-accent)] shadow-xs"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-transparent"
                        }`}
                      >
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[var(--color-accent)]"
                          />
                        )}
                        <span
                          className={`relative shrink-0 ${
                            isActive
                              ? "text-[var(--color-accent)]"
                              : "text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {m.icon}
                          {collapsed && hasCount && (
                            <span
                              aria-hidden="true"
                              className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-bg-surface)]"
                            />
                          )}
                        </span>
                        {!collapsed && (
                          <div className="flex-1 flex items-center justify-between gap-1.5 overflow-hidden text-left">
                            <span className="truncate">{m.label}</span>
                            {m.badge && (
                              <span className="text-[9px] font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded border border-[var(--color-border)] shrink-0">
                                {m.badge}
                              </span>
                            )}
                            {hasCount && (
                              <span className="text-[10px] font-mono font-bold text-[var(--color-accent)] bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-full border border-[var(--color-border-accent)] shrink-0 leading-none">
                                {m.countBadge! > 99 ? "99+" : m.countBadge}
                              </span>
                            )}
                          </div>
                        )}
                      </button>

                      {!collapsed && m.subItems && m.subItems.length > 0 && (
                        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-[var(--color-border)] pl-2.5">
                          {m.subItems.map((sub) => {
                            const isSubActive = activeTab === sub.id;
                            const subBadgeCount =
                              sub.countBadge ?? sub.badgeCount;
                            const hasSubCount =
                              typeof subBadgeCount === "number" &&
                              subBadgeCount > 0;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => onTabChange(sub.id)}
                                title={sub.label}
                                aria-label={sub.label}
                                aria-pressed={isSubActive}
                                className={`flex min-h-11 w-full items-center justify-between gap-1.5 rounded-lg px-2 py-1 text-left text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                                  isSubActive
                                    ? "bg-[var(--color-accent-subtle)] font-semibold text-[var(--color-accent)]"
                                    : "font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                                }`}
                              >
                                <span className="flex min-w-0 items-center gap-1.5 truncate">
                                  <span
                                    aria-hidden="true"
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                      isSubActive
                                        ? "bg-[var(--color-accent)]"
                                        : "bg-[var(--color-text-muted)]"
                                    }`}
                                  />
                                  <span className="truncate">{sub.label}</span>
                                </span>
                                {hasSubCount && (
                                  <span className="shrink-0 rounded-full border border-[var(--color-border-accent)] bg-[var(--color-accent-subtle)] px-1.5 py-0.5 font-mono text-[9px] font-bold leading-none text-[var(--color-accent)]">
                                    {subBadgeCount! > 99
                                      ? "99+"
                                      : subBadgeCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Resources Section */}
        <div className="px-2.5 py-2 border-t border-[var(--color-border)]">
          {!collapsed && (
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-muted)] px-2 mb-1">
              {t("nav.resources")}
            </p>
          )}
          <nav
            aria-label={t("nav.resources")}
            className="flex flex-col gap-0.5"
          >
            {resources.map((r, i) => {
              if (r.href) {
                return (
                  <a
                    key={i}
                    href={r.href}
                    target="_blank"
                    rel="noreferrer"
                    title={r.label}
                    aria-label={r.label}
                    className={`w-full flex ${navTarget} items-center ${
                      collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                    } py-1.5 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]`}
                  >
                    {r.icon}
                    {!collapsed && (
                      <div className="flex-1 flex items-center justify-between text-left min-w-0">
                        <span className="truncate">{r.label}</span>
                        <ExternalLink
                          className="w-3 h-3 shrink-0 text-[var(--color-text-muted)]"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </a>
                );
              }
              const isActive = activeTab === r.tab;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => r.tab && onTabChange(r.tab)}
                  title={r.label}
                  aria-label={r.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative w-full flex ${navTarget} items-center ${
                    collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                  } py-1.5 rounded-xl text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                    isActive
                      ? "text-[var(--color-accent)] bg-[var(--color-accent-wash)] border border-[var(--color-border-accent)] font-semibold"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-transparent"
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[var(--color-accent)]"
                    />
                  )}
                  {r.icon}
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between text-left min-w-0">
                      <span className="truncate">{r.label}</span>
                      <ChevronRight
                        className={`w-3 h-3 shrink-0 ${
                          isActive
                            ? "text-[var(--color-accent)]"
                            : "text-[var(--color-text-muted)] opacity-60"
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom: Collapse toggle (pinned on Beta). */}
      <div className={sidebarBottomClassName}>
        {!collapsed ? (
          <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-surface-sunken border border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-positive inline-block animate-pulse shrink-0" />
              <span className="font-mono text-xs font-bold text-text-primary">
                v{APP_VERSION}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onTabChange("changelog")}
              className="text-[11px] font-medium text-accent hover:underline"
            >
              {t("nav.releaseNotes")}
            </button>
          </div>
        ) : (
          <div
            className="mb-2 flex justify-center"
            title={`Open3DCalc v${APP_VERSION}`}
          >
            <span className="px-1.5 py-0.5 rounded-md bg-surface-sunken border border-border-subtle font-mono text-[10px] font-bold text-text-secondary">
              v{APP_VERSION}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-controls="beta-sidebar-nav"
          aria-label={collapsed ? t("nav.expandPanel") : t("nav.collapsePanel")}
          title={
            collapsed ? `v${APP_VERSION} • ${t("nav.expandPanel")}` : undefined
          }
          className={`w-full flex ${navTarget} items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] transition-colors`}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>{t("nav.collapsePanel")}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
