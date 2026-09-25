import type { SiteSlug } from '#shared/config/sites'
import type { PublicSite } from '#shared/types/public'

/**
 * Identité + réglages publics d'un site (holding ou filiale) — GET /api/public/sites/[slug]
 * (spec §4.2). Partagé par le layout public et les pages (même clé de cache `useFetch`,
 * dédupliqué : une seule requête réseau même si plusieurs composants l'appellent).
 */
export function useSite(slug: MaybeRefOrGetter<SiteSlug>) {
  return useFetch<PublicSite>(() => `/api/public/sites/${toValue(slug)}`, {
    key: () => `site:${toValue(slug)}`,
  })
}
