import tailwindcss from '@tailwindcss/vite'
// Chemins relatifs (pas l'alias `#shared`) : nuxt.config.ts est évalué avant que Nuxt
// n'enregistre ses alias, l'alias `#shared/...` n'y est donc pas résolu.
import { MAX_UPLOAD_BYTES, MULTIPART_OVERHEAD_BYTES } from './shared/config/upload'
import { FILIALE_SLUGS } from './shared/config/sites'
import { fileURLToPath } from 'node:url'

const customErrorHandler = fileURLToPath(new URL('./server/error.ts', import.meta.url))

const ISR_TTL_SECONDS = 3600
// Une offre retirée disparaît en <= 1 min (le POST candidature revérifie de toute façon que
// l'offre est publiée et ouverte) : TTL bien plus court que le reste du site public (DEC-25).
const OFFRES_ISR_TTL_SECONDS = 60
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8 // 8 h
const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES
const FONT_CACHE_CONTROL = 'public, max-age=31536000, immutable'
// Favicons/logos : noms de fichiers NON hashés (ils changent à chaque update client) →
// 7 j, pas `immutable` (sinon un logo mis à jour reste en cache navigateur jusqu'à 1 an).
const STATIC_ASSET_CACHE_CONTROL = 'public, max-age=604800'

// Polices auto-hébergées (spec phase 2 §4.4). "v1" est notre propre révision d'asset (bump si
// les fichiers dans public/fonts/ sont remplacés), pas le numéro de version fontsource — évite
// un couplage fragile à un tag amont précis. Fichiers livrés par T3 (public/fonts/**).
const FONT_POPPINS_700_LATIN = '/fonts/poppins-v1-700-normal-latin.woff2'
const FONT_INTER_LATIN = '/fonts/inter-v1-variable-latin.woff2'

export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  devtools: { enabled: true },

  // `bare-routes` (lot 8, D4) : duplique les pages en chemins nus + arborescence admin sans
  // préfixe — chemin relatif, un module local n'est pas résolu comme une dépendance npm.
  modules: [
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@vueuse/motion/nuxt',
    'nuxt-auth-utils',
    'shadcn-nuxt',
    'nuxt-security',
    './modules/bare-routes.ts',
  ],

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
    // Pages publiques : ISR pour le SEO. Invalidation explicite à chaque écriture de contenu
    // public (server/utils/isr.ts, T1) — ce TTL n'est qu'un filet de sécurité.
    '/': { isr: ISR_TTL_SECONDS },
    '/a-propos': { isr: ISR_TTL_SECONDS },
    '/contact': { isr: ISR_TTL_SECONDS },
    '/realisations': { isr: ISR_TTL_SECONDS },
    '/confidentialite': { isr: ISR_TTL_SECONDS },
    // `/${s}/**` ne couvre pas l'accueil `/${s}` lui-même : règle explicite.
    ...Object.fromEntries(FILIALE_SLUGS.map((s) => [`/${s}`, { isr: ISR_TTL_SECONDS }])),
    ...Object.fromEntries(FILIALE_SLUGS.map((s) => [`/${s}/**`, { isr: ISR_TTL_SECONDS }])),

    // Offres de placement : la règle la plus spécifique l'emporte sur `/placement/**` ci-dessus.
    '/placement/offres': { isr: OFFRES_ISR_TTL_SECONDS },
    '/placement/offres/**': { isr: OFFRES_ISR_TTL_SECONDS },

    // Polices auto-hébergées : jamais invalidées (nom de fichier versionné, voir FONT_*).
    '/fonts/**': { headers: { 'cache-control': FONT_CACHE_CONTROL } },

    // Logos + favicons servis en statique (lot logos 2026-10-22) — voir STATIC_ASSET_CACHE_CONTROL.
    '/logos/**': { headers: { 'cache-control': STATIC_ASSET_CACHE_CONTROL } },
    '/favicons/**': { headers: { 'cache-control': STATIC_ASSET_CACHE_CONTROL } },

    // Dashboards : SPA pure, pas de SSR
    '/admin/**': { ssr: false },
  },

  runtimeConfig: {
    // Surchargé au runtime par NUXT_UPLOADS_DIR (lu au démarrage, pas au build)
    uploadsDir: './storage/uploads',
    // Mailer (spec §4.7) : transport 'log' par défaut (aucune dépendance externe requise en
    // dev). Surchargé par NUXT_MAIL_* ; validé par zod au démarrage (server/plugins/mailer.ts, T1).
    mail: {
      transport: 'log',
      from: '',
      smtp: {
        host: '',
        port: 587,
        secure: false,
        user: '',
        password: '',
      },
    },
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

  // Tâches planifiées (lot 5, Loi 25). `experimental.tasks` est requis pour que Nitro scanne
  // `server/tasks/**` (sans lui, `scheduledTasks` référence une tâche inexistante et Nitro avertit
  // sans jamais l'exécuter). Le nom vient du fichier : `server/tasks/anonymisation-loi25.ts`.
  // Le garde-fou cluster (TaskExecution, server/services/tasks.ts) empêche une double exécution
  // en PM2 `-i max` — le cron, lui, se déclenche sur chaque worker.
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: {
      '0 2 * * *': ['anonymisation-loi25'],
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      link: [
        { rel: 'preload', href: FONT_POPPINS_700_LATIN, as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
        { rel: 'preload', href: FONT_INTER_LATIN, as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
      ],
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
