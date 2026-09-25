import tailwindcss from '@tailwindcss/vite'
// Chemin relatif (pas l'alias `#shared`) : nuxt.config.ts est évalué avant que Nuxt
// n'enregistre ses alias, l'alias `#shared/...` n'y est donc pas résolu.
import { MAX_UPLOAD_BYTES, MULTIPART_OVERHEAD_BYTES } from './shared/config/upload'
import { fileURLToPath } from 'node:url'

const customErrorHandler = fileURLToPath(new URL('./server/error.ts', import.meta.url))

const ISR_TTL_SECONDS = 3600
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8 // 8 h
const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES

const publicSections = ['entretien', 'transport', 'comptable', 'placement', 'ccdpaa', 'boissons'] as const

export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@vueuse/motion/nuxt', 'nuxt-auth-utils', 'shadcn-nuxt', 'nuxt-security'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  // Headers de sécurité (nosniff, frame-options, HSTS, CSP, permissions-policy...) posés
  // globalement par le module `nuxt-security` ci-dessous — jamais dupliqués ici via
  // `routeRules['/**'].headers` : les deux mécanismes écrivent sur la même route `/**`,
  // et le module a priorité sur une éventuelle règle manuelle (silencieusement écrasée).
  security: {
    headers: {
      // Seul écart au défaut du module (qui est 'no-referrer') : on garde un peu plus
      // d'info de provenance pour les liens internes, sans envoyer de referrer cross-origin.
      referrerPolicy: 'strict-origin-when-cross-origin',
    },
    // Limiteur de débit intégré désactivé : il lit l'IP via X-Forwarded-For sans vérifier
    // que la requête vient bien de notre reverse proxy (contrairement à getClientIp dans
    // server/utils/rate-limit.ts) — spoofable, donc redondant au mieux, trompeur au pire
    // sur les routes qui n'ont pas leur propre assertRateLimit. On garde un seul mécanisme,
    // déjà audité, appliqué explicitement route par route (login, contact, ...).
    rateLimiter: false,
    // App monolithique same-origin (Nuxt sert le front ET l'API) : aucun consommateur
    // cross-origin à autoriser. L'origin par défaut du module (l'URL du devServer) serait
    // de toute façon incorrecte une fois buildé pour la prod.
    corsHandler: false,
    // Lit tout le corps de la requête (JSON.stringify, y compris les octets d'un fichier
    // multipart) et le filtre par regex AVANT le handler : sur /api/admin/files, ça revient
    // à stringifier un upload de plusieurs Mo à chaque requête (CPU/mémoire) et ça double la
    // lecture du multipart. La défense XSS repose déjà sur zod + l'échappement Vue + la CSP.
    xssValidator: false,
    requestSizeLimiter: {
      // Défaut du module (8 Mo) < notre limite d'upload documentée (10 Mo, voir
      // shared/config/upload.ts) : sans cet ajustement, ce middleware globalerait un 413
      // sur des fichiers pourtant valides avant même d'atteindre server/utils/storage.ts.
      maxUploadFileRequestInBytes: MAX_UPLOAD_REQUEST_BYTES,
    },
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
        // Strict : le cookie de session n'est jamais envoyé sur une requête cross-site,
        // ce qui couvre le CSRF sans dépendre d'un token (voir skill nitro).
        sameSite: 'strict',
      },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
    },
  },

  hooks: {
    // Pourquoi un hook `nitro:config` et pas la clé `nitro.errorHandler` directement :
    // `@nuxt/nitro-server` ne pose SON PROPRE handler d'erreur (celui qui rend la page
    // `error-500.vue`, voir `runtime/handlers/error.mjs`) que `if (!nitroConfig.errorHandler)`.
    // Si on avait écrit `nitro: { errorHandler: customErrorHandler }` ici, cette condition
    // serait déjà fausse au moment où Nuxt la teste (car `nitroConfig` part de la config
    // utilisateur), et Nuxt n'ajouterait PLUS jamais son propre handler — plus aucune page
    // d'erreur HTML rendue, seulement le handler générique de Nitro. Le hook `nitro:config`
    // s'exécute, lui, APRÈS que Nuxt ait posé son handler par défaut (`nuxt.callHook('nitro:config', ...)`
    // est appelé après cette affectation) : à cet instant, `nitroConfig.errorHandler` contient
    // déjà le handler de Nuxt, et on peut le préserver en le mettant simplement après le nôtre.
    // Ordre final du tableau (vérifié dans le bundle buildé, voir rapport) :
    // [notre handler, handler d'erreur de Nuxt, handler par défaut de Nitro (ajouté par Nitro
    // lui-même, inconditionnellement, en tout dernier)].
    'nitro:config'(nitroConfig) {
      const existing = nitroConfig.errorHandler
        ? Array.isArray(nitroConfig.errorHandler)
          ? nitroConfig.errorHandler
          : [nitroConfig.errorHandler]
        : []
      nitroConfig.errorHandler = [customErrorHandler, ...existing]
    },
  },
})
