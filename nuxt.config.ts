import tailwindcss from '@tailwindcss/vite'

const ISR_TTL_SECONDS = 3600
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8 // 8 h

const publicSections = ['entretien', 'transport', 'comptable', 'placement', 'ccdpaa', 'boissons'] as const

export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@vueuse/motion/nuxt', 'nuxt-auth-utils', 'shadcn-nuxt'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  routeRules: {
    // Pages publiques : ISR pour le SEO
    '/': { isr: ISR_TTL_SECONDS },
    '/a-propos': { isr: ISR_TTL_SECONDS },
    '/contact': { isr: ISR_TTL_SECONDS },
    ...Object.fromEntries(publicSections.map((s) => [`/${s}/**`, { isr: ISR_TTL_SECONDS }])),

    // Dashboards : SPA pure, pas de SSR
    '/admin/**': { ssr: false },
  },

  runtimeConfig: {
    // Surchargé au runtime par NUXT_UPLOADS_DIR (lu au démarrage, pas au build)
    uploadsDir: './storage/uploads',
    session: {
      // Le mot de passe de scellement est lu depuis NUXT_SESSION_PASSWORD
      maxAge: SESSION_MAX_AGE_SECONDS,
      cookie: {
        sameSite: 'lax',
      },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
    },
  },
})
