import type { SiteSlug } from '#shared/config/sites'

export type SiteCollectionResource = 'services' | 'realisations' | 'equipe' | 'partenaires'

export interface UseSiteCollectionQuery {
  readonly misEnAvant?: boolean
  readonly limit?: number
}

/**
 * Collection publique d'une filiale (ou de la holding pour `realisations`, DEC-39) — GET
 * /api/public/sites/[slug]/{services|realisations|equipe|partenaires} (spec §4.2).
 * Générique sur le DTO pour rester réutilisable par les futures pages (services, réalisations).
 */
export function useSiteCollection<TItem>(
  slug: MaybeRefOrGetter<SiteSlug>,
  resource: SiteCollectionResource,
  query: MaybeRefOrGetter<UseSiteCollectionQuery> = {},
) {
  return useFetch<TItem[]>(() => `/api/public/sites/${toValue(slug)}/${resource}`, {
    // La query fait partie de la clé : sans elle, l'aperçu d'accueil (misEnAvant, limit) et la
    // page complète partageraient le même cache (liste tronquée après navigation client).
    key: () => `site-collection:${toValue(slug)}:${resource}:${JSON.stringify(toValue(query))}`,
    query: () => toValue(query),
  })
}
