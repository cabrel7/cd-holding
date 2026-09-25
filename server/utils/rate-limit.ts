import type { H3Event } from 'h3'

// Limiteur en mémoire — suffisant pour un VPS mono-process (PM2 fork).
// Si passage en cluster PM2 : déplacer vers un storage partagé (Redis via unstorage).
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Purge périodique des buckets expirés : sans ça, chaque IP (ou valeur de X-Forwarded-For)
// vue une seule fois reste en mémoire indéfiniment (fuite mémoire sur un process long-lived).
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}, CLEANUP_INTERVAL_MS).unref() // n'empêche pas l'arrêt propre du process

export interface RateLimitOptions {
  /** Identifiant logique de la limite, ex. 'login' */
  scope: string
  max: number
  windowMs: number
}

// Reverse proxy de confiance = nginx/Caddy sur le même VPS (connexion via loopback).
const TRUSTED_PROXY_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * IP cliente pour le rate-limit. `x-forwarded-for` est écrit par le client : il n'est lu QUE si
 * la connexion TCP vient d'un proxy de confiance, sinon n'importe qui pourrait le faire varier
 * pour contourner le rate-limit. Dans ce cas on retient la DERNIÈRE valeur, celle ajoutée par
 * le proxy (`proxy_add_x_forwarded_for`) — les valeurs en tête restent contrôlées par le client.
 */
function getClientIp(event: H3Event): string {
  const socketIp = getRequestIP(event) ?? 'unknown'
  if (!TRUSTED_PROXY_IPS.has(socketIp)) return socketIp

  const forwardedFor = getRequestHeader(event, 'x-forwarded-for')
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map((hop) => hop.trim()).filter(Boolean)
    const nearest = hops.at(-1)
    if (nearest) return nearest
  }
  return socketIp
}

export function assertRateLimit(event: H3Event, { scope, max, windowMs }: RateLimitOptions): void {
  const ip = getClientIp(event)
  const key = `${scope}:${ip}`
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  bucket.count += 1
  if (bucket.count > max) {
    setResponseHeader(event, 'Retry-After', Math.ceil((bucket.resetAt - now) / 1000))
    throw createError({ statusCode: 429, statusMessage: 'Trop de tentatives, réessayez plus tard' })
  }
}

export function resetRateLimit(event: H3Event, scope: string): void {
  const ip = getClientIp(event)
  buckets.delete(`${scope}:${ip}`)
}
