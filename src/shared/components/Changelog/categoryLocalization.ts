export type ChangelogCategoryKey =
  | 'features'
  | 'fixes'
  | 'improvements'
  | 'security'
  | 'ciCd'
  | 'documentation'
  | 'dependencies'
  | 'breakingChanges'
  | 'other'
  | 'technical'
  | 'tests'
  | 'new'
  | 'visualMobile'
  | 'qualityGates'
  | 'contributors'
  | 'autoUpdate'
  | 'uiUx'
  | 'ux'
  | 'quality'
  | 'ciAutomation'
  | 'data'
  | 'i18n'

const CATEGORY_ALIASES: Record<string, ChangelogCategoryKey> = {
  features: 'features',
  feature: 'features',
  funcionalidades: 'features',
  funcionalidade: 'features',
  novidades: 'features',
  fixes: 'fixes',
  fix: 'fixes',
  'bug fixes': 'fixes',
  correcoes: 'fixes',
  correcao: 'fixes',
  improvements: 'improvements',
  improvement: 'improvements',
  melhorias: 'improvements',
  melhoria: 'improvements',
  security: 'security',
  seguranca: 'security',
  privacy: 'security',
  privacidade: 'security',
  'ci cd': 'ciCd',
  ci: 'ciCd',
  'ci automation': 'ciCd',
  'ci and automation': 'ciCd',
  'ci e automacao': 'ciCd',
  documentation: 'documentation',
  docs: 'documentation',
  documentacao: 'documentation',
  dependencies: 'dependencies',
  dependency: 'dependencies',
  dependencias: 'dependencies',
  'breaking changes': 'breakingChanges',
  breaking: 'breakingChanges',
  'mudancas incompativeis': 'breakingChanges',
  'alteracoes incompativeis': 'breakingChanges',
  other: 'other',
  outros: 'other',
  technical: 'technical',
  tecnico: 'technical',
  tests: 'tests',
  testes: 'tests',
  new: 'new',
  novo: 'new',
  nova: 'new',
  'visual polish mobile': 'visualMobile',
  'visual polish and mobile': 'visualMobile',
  'polimento visual e mobile': 'visualMobile',
  'visual e mobile': 'visualMobile',
  'quality gates': 'qualityGates',
  'portoes de qualidade': 'qualityGates',
  contributors: 'contributors',
  contribuidores: 'contributors',
  'auto update': 'autoUpdate',
  'atualizacao automatica': 'autoUpdate',
  'ui ux': 'uiUx',
  ux: 'ux',
  quality: 'quality',
  qualidade: 'quality',
  data: 'data',
  dados: 'data',
  i18n: 'i18n',
}

function normalizeCategoryTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[/_]+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function normalizeCategoryKey(title: string): ChangelogCategoryKey | undefined {
  const normalizedTitle = normalizeCategoryTitle(title)
  const exactMatch = CATEGORY_ALIASES[normalizedTitle]
  if (exactMatch) return exactMatch

  return Object.entries(CATEGORY_ALIASES)
    .sort(([left], [right]) => right.length - left.length)
    .find(([alias]) => normalizedTitle.startsWith(`${alias} `))?.[1]
}

export function getLocalizedCategoryTitle(title: string, translate: (key: string) => string): string {
  const categoryKey = normalizeCategoryKey(title)
  if (!categoryKey) return title

  const translationKey = `changelog.categories.${categoryKey}`
  const translatedTitle = translate(translationKey)
  return translatedTitle && translatedTitle !== translationKey ? translatedTitle : title
}
