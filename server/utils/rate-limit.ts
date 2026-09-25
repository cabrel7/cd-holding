import type { H3Event } from 'h3'

// Limiteur en mémoire — suffisant pour un VPS mono-process (PM2 fork).
// Si passage en cluster PM2 : déplacer vers un storage partagé (Redis via unstorage).
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitOptions {
  /** Identifiant logique de la limite, ex. 'login' */
  scope: string
  max: number
  windowMs: number
}

export function assertRateLimit(event: H3Event, { scope, max, windowMs }: RateLimitOptions): void {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
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
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  buckets.delete(`${scope}:${ip}`)
}
