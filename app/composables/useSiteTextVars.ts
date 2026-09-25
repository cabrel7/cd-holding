import type { ComputedRef } from 'vue'
import type { TexteVars } from '#shared/utils/texte'

/**
 * Variables d'interpolation par défaut du site public courant ({groupe}/{nomCourt}/{nom},
 * shared/utils/texte.ts). Dérivées de `useSite` sur la même clé de cache que le layout/la page
 * (`site:<slug>`) : aucune requête réseau supplémentaire, la valeur est déjà en mémoire une fois
 * le site chargé. Consommé par défaut par `TexteAccentue` (T3) pour que tout texte public
 * édité depuis le CMS s'interpole sans que chaque appelant ait à repasser `vars`.
 */
export function useSiteTextVars(): ComputedRef<TexteVars> {
  const slug = useCurrentSiteSlug()
  const { data: site } = useSite(slug)

  return computed<TexteVars>(() => ({
    groupe: site.value?.groupe.nom,
    nomCourt: site.value?.nomCourt ?? site.value?.nom,
    nom: site.value?.nom,
  }))
}
