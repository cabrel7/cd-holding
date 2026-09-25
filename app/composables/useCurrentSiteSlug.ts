import { HOLDING_SLUG, isFilialeSlug, type SiteSlug } from '#shared/config/sites'

/**
 * Site courant déduit du premier segment de route (spec §4.3) : un slug de filiale connu,
 * sinon la holding. Utilisé par le layout public pour savoir quel `PublicSite` charger.
 */
export function useCurrentSiteSlug(): ComputedRef<SiteSlug> {
  const route = useRoute()
  return computed<SiteSlug>(() => {
    const first = route.path.split('/').filter(Boolean)[0]
    return first && isFilialeSlug(first) ? first : HOLDING_SLUG
  })
}
