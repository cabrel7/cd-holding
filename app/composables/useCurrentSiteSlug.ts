import { HOLDING_SLUG, isFilialeSlug, type SiteSlug } from '#shared/config/sites'

/**
 * Site courant pour le layout public (spec lot 8, D6) :
 * - mode sous-domaine → le slug résolu de l'hôte (la racine `/` est déjà sa page) ;
 * - mode chemin → premier segment de route s'il est un slug de filiale, sinon holding ;
 * - sur admin.chauvierdelor.com → holding par défaut (le layout public n'y est pas rendu).
 */
export function useCurrentSiteSlug(): ComputedRef<SiteSlug> {
  const route = useRoute()
  const host = useSiteHost()
  return computed<SiteSlug>(() => {
    if (host.value.mode === 'sous-domaine') {
      const slug = host.value.slug
      return slug && slug !== 'admin' && isFilialeSlug(slug) ? slug : HOLDING_SLUG
    }
    const first = route.path.split('/').filter(Boolean)[0]
    return first && isFilialeSlug(first) ? first : HOLDING_SLUG
  })
}
