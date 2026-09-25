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
    key: () => `site-collection:${toValue(slug)}:${resource}`,
    query: () => toValue(query),
  })
}
