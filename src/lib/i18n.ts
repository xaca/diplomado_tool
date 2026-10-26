import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import enCommon from '@/locales/en/common.json'
import esCommon from '@/locales/es/common.json'

// Spanish is the default and fallback (PLAN.md → Internationalization).
// Order: saved choice (localStorage, synced from users.locale) → browser language → Spanish.

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const resources = {
  es: { common: esCommon },
  en: { common: enCommon },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS: 'common',
    fallbackLng: 'es',
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'pbl.lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

// Keep <html lang> in sync for accessibility and Excalidraw
i18n.on('languageChanged', (lng) =>
  document.documentElement.setAttribute('lang', lng),
)

export { i18n }
