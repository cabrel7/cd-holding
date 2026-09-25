// Invalidation du cache ISR Nitro (spec §4.2 "Stratégie ISR") : purge totale des clés
// `cache:nitro:routes` à chaque écriture de contenu public (CMS, sections, réglages de site).
// Le TTL de 3600 s posé dans nuxt.config.ts (routeRules) n'est qu'un filet de sécurité — c'est
// cette invalidation explicite qui rend une édition visible immédiatement (voir spec §4.9,
// point 3). Point ouvert #15 : le format de clé `cache:nitro:routes` est une dépendance interne
// à Nitro, isolée ici — un test e2e échoue s'il change lors d'une mise à jour de Nitro.
import type { Storage } from 'unstorage'
import { consola } from 'consola'

const ROUTE_CACHE_BASE = 'cache:nitro:routes'

/**
 * Fonction pure : supprime toutes les clés sous `cache:nitro:routes` d'un storage donné.
 * Ne connaît ni H3 ni le storage global Nitro — testable sur un driver mémoire
 * (tests/unit/isr.test.ts), consommée en prod par `invalidatePublicPages()`.
 */
export async function purgeRouteCache(storage: Storage): Promise<number> {
  const keys = await storage.getKeys(ROUTE_CACHE_BASE)
  await Promise.all(keys.map((key) => storage.removeItem(key)))
  return keys.length
}

/**
 * Purge complète du cache de routes ISR — à appeler après toute mutation de contenu public
 * (CMS, sections, réglages de site). N'échoue JAMAIS l'appelant : un échec de purge est journalisé
 * (consola.warn, sans donnée personnelle) et laisse simplement le TTL de 3600 s reprendre le relais.
 */
export async function invalidatePublicPages(): Promise<void> {
  try {
    await purgeRouteCache(useStorage())
  } catch (error) {
    consola.warn('[isr] échec de la purge du cache de routes', { message: (error as Error).message })
  }
}
