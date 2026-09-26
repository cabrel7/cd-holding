import type { SiteSlug } from '#shared/config/sites'

export type SiteCollectionResource = 'services' | 'realisations' | 'equipe' | 'partenaires'

/**
 * Query acceptée par ressource — miroir des schémas `.strict()` de server/services/public/sites.ts :
 * une clé non prévue (ex. `limit` sur `services`) y ferait un 400, que ce typage bloque dès la
 * compilation.
 */
export interface SiteCollectionQueries {
  readonly services: { readonly misEnAvant?: boolean }
  readonly realisations: { readonly limit?: number }
  readonly equipe: Record<string, never>
  readonly partenaires: Record<string, never>
}

/**
 * Collection publique d'une filiale (ou de la holding pour `realisations`, DEC-39) — GET
 * /api/public/sites/[slug]/{services|realisations|equipe|partenaires} (spec §4.2).
 * Générique sur le DTO pour rester réutilisable par les futures pages (services, réalisations).
 */
export function useSiteCollection<TItem, R extends SiteCollectionResource = SiteCollectionResource>(
  slug: MaybeRefOrGetter<SiteSlug>,
  resource: R,
  query: MaybeRefOrGetter<SiteCollectionQueries[R]> = {} as SiteCollectionQueries[R],
) {
  return useFetch<TItem[]>(() => `/api/public/sites/${toValue(slug)}/${resource}`, {
    // La query fait partie de la clé : sans elle, l'aperçu d'accueil (misEnAvant, limit) et la
    // page complète partageraient le même cache (liste tronquée après navigation client).
    key: () => `site-collection:${toValue(slug)}:${resource}:${JSON.stringify(toValue(query))}`,
    query: () => toValue(query),
  })
}
