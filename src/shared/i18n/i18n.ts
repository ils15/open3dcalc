import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import ptBR from './locales/pt-BR.json'
import enUS from './locales/en-US.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      'en-US': { translation: enUS },
    },
    fallbackLng: 'pt-BR',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

// Sync <html lang> with i18n language so <input type="date"> uses the correct locale format
i18n.on('languageChanged', (lng) => {
  const htmlLang = lng === 'pt-BR' ? 'pt-BR' : 'en-US'
  document.documentElement.lang = htmlLang
})
// Set initial lang
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language === 'pt-BR' ? 'pt-BR' : 'en-US'
}

export default i18n
