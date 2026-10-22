import { HOLDING_SLUG, isFilialeSlug, type FilialeSlug } from '#shared/config/sites'

/**
 * Slug de la filiale servie par la page courante (spec lot 8, T2) :
 * - le paramètre `filiale` de la route fait foi (mode chemin, tests) ;
 * - sinon, le slug résolu de l'hôte (mode sous-domaine, `entretien.localhost`) ;
 * - sinon null (holding, admin, hôte inconnu).
 * Utilisé par les pages génériques `[filiale]/*` (validates inter-sites, filtre dynamique).
 */
export function useFilialeSlug(): ComputedRef<FilialeSlug | null> {
  const route = useRoute()
  const host = useSiteHost()
  return computed<FilialeSlug | null>(() => {
    const param = route.params.filiale
    if (typeof param === 'string' && isFilialeSlug(param)) return param
    const slug = host.value.slug
    if (slug && slug !== 'admin' && slug !== HOLDING_SLUG && isFilialeSlug(slug)) return slug
    return null
  })
}
