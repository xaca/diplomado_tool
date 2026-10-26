import 'i18next'
import type { resources } from '@/lib/i18n'

// Typed translation keys: a missing or misspelled key fails the build
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: (typeof resources)['es']
  }
}
