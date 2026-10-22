import type { H3Event } from 'h3'

// Limiteur en mémoire — suffisant pour un VPS mono-process (PM2 fork).
// Si passage en cluster PM2 : déplacer vers un storage partagé (Redis via unstorage).
export interface Bucket {
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
  /**
   * Composant optionnel de la clé (ex. `String(secure.userId)`) : borne chaque session sans
   * punir un NAT partagé (D15). Absent ⇒ `${scope}:${ip}`, comportement historique inchangé.
   */
  cle?: string
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

export interface HitBucketOptions {
  readonly max: number
  readonly windowMs: number
}

export interface HitBucketResult {
  /** `false` si `max` est dépassé pour cette fenêtre : l'appelant doit refuser la requête. */
  readonly allowed: boolean
  /** Millisecondes avant réinitialisation de la fenêtre — 0 si `allowed`. */
  readonly retryAfterMs: number
}

/**
 * Fenêtre glissante par clé, fonction pure (aucune dépendance à `H3Event`/l'horloge système) —
 * testable directement (tests/unit/rate-limit.test.ts). Partagée par `assertRateLimit` (clé
 * = IP) et `consumeRateLimit` (clé arbitraire, ex. accusé de réception par destinataire).
 */
export function hitBucket(buckets: Map<string, Bucket>, key: string, { max, windowMs }: HitBucketOptions, now: number): HitBucketResult {
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  bucket.count += 1
  if (bucket.count > max) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now }
  }
  return { allowed: true, retryAfterMs: 0 }
}

/**
 * Clé de bucket, fonction pure : `${scope}:${ip}` sans `cle` (régression de tous les
 * appelants historiques), `${scope}:${ip}:${cle}` avec — testée en unit.
 */
export function rateLimitKey(scope: string, ip: string, cle?: string): string {
  return cle === undefined ? `${scope}:${ip}` : `${scope}:${ip}:${cle}`
}

export function assertRateLimit(event: H3Event, { scope, max, windowMs, cle }: RateLimitOptions): void {
  const ip = getClientIp(event)
  const key = rateLimitKey(scope, ip, cle)
  const result = hitBucket(buckets, key, { max, windowMs }, Date.now())

  if (!result.allowed) {
    setResponseHeader(event, 'Retry-After', Math.ceil(result.retryAfterMs / 1000))
    throw createError({ statusCode: 429, statusMessage: 'Trop de tentatives, réessayez plus tard' })
  }
}

/**
 * Limite non levante, par clé arbitraire (PAS l'IP) — ex. accusé de réception par destinataire
 * (`cleAccuseReception`, server/lib/contact.ts). Même `Map`, même purge que `assertRateLimit` :
 * un seul mécanisme de fenêtre glissante pour tout le process.
 */
export function consumeRateLimit(key: string, options: HitBucketOptions): boolean {
  return hitBucket(buckets, key, options, Date.now()).allowed
}

export function resetRateLimit(event: H3Event, scope: string, cle?: string): void {
  const ip = getClientIp(event)
  buckets.delete(rateLimitKey(scope, ip, cle))
}
