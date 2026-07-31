import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { renderInlineMarkdown } from './renderInlineMarkdown'

interface VersionSection {
  title: string
  items: string[]
}

interface VersionEntry {
  version: string
  date: string
  sections: VersionSection[]
}

const CATEGORY_ALIASES: Record<string, string> = {
  features: 'features',
  fixes: 'fixes',
  'bug fixes': 'fixes',
  other: 'other',
  ci: 'ci',
  contributors: 'contributors',
  'visual polish mobile': 'visualMobile',
  'quality gates': 'qualityGates',
  'auto-update': 'autoUpdate',
  documentation: 'documentation',
  'ui/ux': 'uiUx',
  technical: 'technical',
  tests: 'tests',
  new: 'new',
  ux: 'ux',
  quality: 'quality',
  'ci automation': 'ciAutomation',
  data: 'data',
}

function normalizeCategoryTitle(title: string): string {
  return title
    .replace(/[^\p{L}\p{N}&/ -]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function getLocalizedCategoryTitle(title: string, translate: (key: string) => string): string {
  const categoryKey = CATEGORY_ALIASES[normalizeCategoryTitle(title)]
  return categoryKey ? translate(`changelog.categories.${categoryKey}`) : title
}

function formatChangelogDate(date: string, locale: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  if (!match) return undefined

  const parsedDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(parsedDate.getTime())) return undefined

  return new Intl.DateTimeFormat(locale, {
    day: locale.toLowerCase().startsWith('pt') ? '2-digit' : 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsedDate)
}

function compareVersions(a: VersionEntry, b: VersionEntry): number {
  const versionA = a.version.split('.').map(Number)
  const versionB = b.version.split('.').map(Number)

  for (let index = 0; index < 3; index += 1) {
    if (versionA[index] !== versionB[index]) return (versionB[index] ?? 0) - (versionA[index] ?? 0)
  }

  return 0
}

export function ChangelogPage() {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState<string>('')
  const locale = i18n.resolvedLanguage || i18n.language || 'en-US'

  const raw = t('changelog.versions', { returnObjects: true })
  const changelogData: VersionEntry[] = (Array.isArray(raw) ? (raw as VersionEntry[]) : []).slice().sort(compareVersions)
  const totalChanges = changelogData.reduce(
    (sum, version) => sum + version.sections.reduce((sectionSum, section) => sectionSum + section.items.length, 0),
    0,
  )

  const toggleVersion = (version: string) => {
    setExpanded(previous => previous === version ? '' : version)
  }

  return (
    <div className="space-y-5">
      <div className="surface rounded-xl p-5 text-center sm:p-6">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
          <h1 className="text-lg font-bold gradient-text">{t('changelog.title')}</h1>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t('changelog.summary', {
            versions: t('changelog.versionsCount', { count: changelogData.length }),
            changes: t('changelog.changesCount', { count: totalChanges }),
          })}
        </p>
      </div>

      <div className="relative space-y-4">
        {changelogData.map((entry, index) => {
          const isLatest = index === 0
          const isOpen = expanded === entry.version
          const formattedDate = formatChangelogDate(entry.date, locale)

          return (
            <div key={entry.version} className="surface min-w-0 overflow-hidden rounded-xl transition-all">
              <button
                onClick={() => toggleVersion(entry.version)}
                className="flex w-full min-w-0 items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-[var(--color-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:p-5"
                aria-expanded={isOpen}
              >
                <div data-testid={`version-heading-${entry.version}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    data-testid={`version-label-${entry.version}`}
                    className={`shrink-0 text-sm font-bold ${isLatest ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}
                  >
                    v{entry.version}
                  </span>
                  {formattedDate && (
                    <>
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]" aria-hidden="true">·</span>
                      <time
                        data-testid={`version-date-${entry.version}`}
                        dateTime={entry.date}
                        aria-label={t('changelog.releaseDate', { date: formattedDate })}
                        className="min-w-0 break-words text-xs text-[var(--color-text-secondary)]"
                      >
                        {formattedDate}
                      </time>
                    </>
                  )}
                  {isLatest && (
                    <span
                      data-testid={`latest-badge-${entry.version}`}
                      className="shrink-0 rounded-md bg-[var(--color-accent)]/20 px-2 py-1 text-[12px] font-semibold leading-none text-[var(--color-accent)]"
                    >
                      {t('changelog.latest')}
                    </span>
                  )}
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" aria-hidden="true" />}
              </button>

              {isOpen && (
                <div className="min-w-0 space-y-4 border-t border-[var(--color-border)] px-4 pb-5 pt-4 animate-fade-in sm:px-5">
                  {entry.sections.map(section => (
                    <div key={section.title} className="min-w-0">
                      <h2 className="mb-2 break-words text-[12px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
                        {getLocalizedCategoryTitle(section.title, t)}
                      </h2>
                      <ul className="space-y-1.5">
                        {section.items.map((item, itemIndex) => (
                          <li key={itemIndex} className="flex min-w-0 items-start gap-2 break-words pl-1 text-xs text-[var(--color-text-secondary)]">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]/50" aria-hidden="true" />
                            <span className="min-w-0 break-words">{renderInlineMarkdown(item)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="surface space-y-3 rounded-xl p-5 text-center">
        <p className="text-xs text-[var(--color-text-secondary)]">
          <a href="https://github.com/ils15/open3dcalc/releases" target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center break-words text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent)]">
            {t('changelog.viewAllOnGitHub')}
          </a>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-secondary)]">
          <a href="https://github.com/ils15/open3dcalc" target="_blank" rel="noopener noreferrer" className="break-words transition-colors hover:text-[var(--color-text-primary)]">
            {t('changelog.github')}
          </a>
          <a href="https://t.me/Impressao3DBR" target="_blank" rel="noopener noreferrer" className="break-words transition-colors hover:text-[var(--color-text-primary)]">
            {t('changelog.telegram')}
          </a>
          <span aria-hidden="true">·</span>
          <a href="https://ofertachina.com.br" target="_blank" rel="noopener noreferrer" className="break-words transition-colors hover:text-[var(--color-text-primary)]">
            {t('changelog.partner')}
          </a>
        </div>
      </div>
    </div>
  )
}
