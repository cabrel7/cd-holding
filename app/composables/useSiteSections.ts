import type { SiteSlug } from '#shared/config/sites'
import type { PageSiteKey } from '#shared/content/sections/catalog'
import type { PublicSectionsDto } from '#shared/types/public'

/**
 * Formes de contenu consommées côté public pour les types du catalogue utilisés en phase 2
 * (spec §1.4). `donnees` du DTO public est un `Record<string, unknown>` générique (validé
 * côté serveur) ; ces interfaces documentent la forme attendue une fois castée ici.
 */

/** Type catalogue `seo`. */
export interface SeoData {
  readonly title: string
  readonly description: string
}

/** Type catalogue `section` — surtitre/titre/texte court, consommé par `SectionHeading`. */
export interface SectionData {
  readonly surtitre?: string
  readonly titre: string
  readonly texte?: string
}

/** Type catalogue `histoire`. */
export interface HistoireData {
  readonly surtitre: string
  readonly titre: string
  readonly paragraphes: readonly string[]
}

/** Un item de `chiffres`, résolu côté serveur (`resolveChiffres`, T1) : toujours `{valeur, libelle}`. */
export interface ChiffreResoluData {
  readonly valeur: string
  readonly libelle: string
}

/** Type catalogue `chiffres`, une fois les items `effectif`/`filiales` résolus par l'API publique. */
export interface ChiffresData {
  readonly surtitre?: string
  readonly titre?: string
  readonly texte?: string
  readonly items: readonly ChiffreResoluData[]
}

/**
 * Contenu éditable d'une page publique, par clé du catalogue — GET
 * /api/public/sites/[slug]/sections?page=... (spec §4.2). Générique : chaque appelant caste
 * `donnees[cle]` vers la forme attendue (Seo/Section/Histoire/Chiffres...) selon le catalogue.
 */
export function useSiteSections(slug: MaybeRefOrGetter<SiteSlug>, page: PageSiteKey) {
  return useFetch<PublicSectionsDto>(() => `/api/public/sites/${toValue(slug)}/sections`, {
    key: () => `site-sections:${toValue(slug)}:${page}`,
    query: { page },
  })
}
