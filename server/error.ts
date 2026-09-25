import type { H3Error, H3Event } from 'h3'

/**
 * Réponse renvoyée par le `defaultHandler` interne de Nitro (voir nitropack
 * `dist/runtime/internal/error/{prod,dev}.mjs`, export nommé `defaultHandler`, injecté par
 * Nitro comme 3e argument de chaque error handler custom). On ne peut pas importer ce type
 * depuis `nitropack` (pas une dépendance directe de ce projet, seulement transitive via Nuxt) :
 * on le retype localement, à l'identique de la signature réelle.
 */
interface NitroDefaultHandlerResult {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string | Record<string, unknown>
}

type NitroDefaultHandler = (
  error: H3Error,
  event: H3Event,
  opts?: { silent?: boolean; json?: boolean }
) => NitroDefaultHandlerResult | Promise<NitroDefaultHandlerResult>

interface JsonRequestSignals {
  accept: string | undefined
  userAgent: string | undefined
  secFetchMode: string | undefined
  path: string
}

/**
 * Même heuristique "requête JSON/API" que celle utilisée par Nitro et par le handler d'erreur
 * de Nuxt (`@nuxt/nitro-server/dist/runtime/utils/error.mjs` → `isJsonRequest`) : on la
 * réimplémente ici (pas de dépendance directe vers `nitropack`/`@nuxt/nitro-server` depuis le
 * code applicatif) pour prendre exactement la même décision qu'eux sur la même requête.
 *
 * Fonction pure (pas de dépendance à `H3Event`/aux imports auto-injectés par Nitro) : voir
 * `tests/unit/error-handler.test.ts` — testable sans booter Nuxt.
 */
export function decideIsJsonRequest(signals: JsonRequestSignals): boolean {
  if (includesIgnoreCase(signals.accept, 'text/html')) return false

  return (
    includesIgnoreCase(signals.accept, 'application/json') ||
    includesIgnoreCase(signals.userAgent, 'curl/') ||
    includesIgnoreCase(signals.userAgent, 'httpie/') ||
    includesIgnoreCase(signals.secFetchMode, 'cors') ||
    signals.path.startsWith('/api/') ||
    signals.path.endsWith('.json')
  )
}

function includesIgnoreCase(value: string | undefined, needle: string): boolean {
  return typeof value === 'string' && value.toLowerCase().includes(needle)
}

function isJsonRequest(event: H3Event): boolean {
  return decideIsJsonRequest({
    accept: getRequestHeader(event, 'accept'),
    userAgent: getRequestHeader(event, 'user-agent'),
    secFetchMode: getRequestHeader(event, 'sec-fetch-mode'),
    path: event.path,
  })
}

/**
 * Error handler Nitro custom (branché via `hooks['nitro:config']` dans nuxt.config.ts, qui le
 * place en tête du tableau `errorHandler`, avant le handler d'erreur de Nuxt et le handler par
 * défaut de Nitro — voir commentaire dans nuxt.config.ts pour le "pourquoi" de cette mécanique).
 *
 * Objectif : pour une requête JSON/API, couper le dump brut que fait le `defaultHandler` interne
 * de Nitro pour toute exception non-H3 (`error.unhandled`, ex. erreur Prisma) —
 * `console.error('[request error] [unhandled] [POST] url', error)`, avec stack complète et
 * détails de la cause, même en production — SANS perdre le masquage du message qu'il applique
 * aussi (`statusMessage: "Server Error"`, pas de détail technique). On obtient ça en rappelant
 * nous-mêmes ce même `defaultHandler` avec `{ json: true, silent: true }` : `silent` coupe son
 * log, le reste de son comportement (masquage, headers, statut) est inchangé. Le vrai logging
 * détaillé (avec route/méthode/statut, sans PII) reste fait ailleurs, une seule fois, dans
 * `server/plugins/error-handler.ts` (hook `error` de Nitro) — jamais dans ce fichier.
 *
 * Pour une requête page (HTML), on ne fait rien : `return` sans avoir appelé `send`, ce qui
 * laisse `event.handled` à `false` et laisse la chaîne continuer vers le handler d'erreur de
 * Nuxt (rendu de `error-500.vue`).
 * LIMITE CONNUE, documentée plutôt que corrigée ici (hors périmètre de ce fichier) : ce chemin
 * HTML appelle lui aussi le `defaultHandler` de Nitro, mais SANS `silent` (voir
 * `@nuxt/nitro-server/dist/runtime/handlers/error.mjs`) — un `[request error]` est donc toujours
 * loggué en brut pour un 500 rendu en page. Dans ce projet, les erreurs Prisma proviennent des
 * routes `/api/**` (donc du chemin JSON couvert ci-dessus) ; le rendu SSR classique ne voit lui
 * qu'un `FetchError` générique produit par l'appel interne à `/__nuxt_error`, jamais le détail
 * Prisma d'origine.
 */
export default async function handleNitroError(
  error: H3Error,
  event: H3Event,
  { defaultHandler }: { defaultHandler: NitroDefaultHandler }
) {
  if (event.handled || !isJsonRequest(event)) return

  const response = await defaultHandler(error, event, { json: true, silent: true })

  setResponseHeaders(event, response.headers)
  setResponseStatus(event, response.status, response.statusText)
  return send(event, typeof response.body === 'string' ? response.body : JSON.stringify(response.body))
}
