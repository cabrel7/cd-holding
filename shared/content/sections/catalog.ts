// Catalogue des sections éditables : quelle clé, de quel type, sur quelle page, pour quel(s)
// site(s) (spec phase 2 §1.4). Source de vérité versionnée — l'admin ne crée ni ne supprime
// de clé, seules les valeurs (SectionContenu.donnees) vivent en base.
import { HOLDING_SLUG, isFilialeSlug, SITE_SLUGS, type SiteSlug } from '../../config/sites'
import type { SectionTypeKey } from './types'

// Miroir volontairement local de l'enum Prisma `PageSite` (shared/ ne doit pas dépendre du
// client Prisma généré, importé par le seed en dehors de tout contexte Nitro — voir §2).
export const PAGE_SITE = {
  COMMUN: 'COMMUN',
  ACCUEIL: 'ACCUEIL',
  SERVICES: 'SERVICES',
  REALISATIONS: 'REALISATIONS',
  A_PROPOS: 'A_PROPOS',
  CONTACT: 'CONTACT',
  RESTAURANT: 'RESTAURANT',
  OFFRES: 'OFFRES',
  CONFIDENTIALITE: 'CONFIDENTIALITE',
  MENTIONS_LEGALES: 'MENTIONS_LEGALES',
} as const

export type PageSiteKey = (typeof PAGE_SITE)[keyof typeof PAGE_SITE]

/** 'holding' | 'filiales' | liste explicite de sites — voir spec §1.4. */
export type CatalogPortee = 'holding' | 'filiales' | readonly SiteSlug[]

export interface CatalogEntry {
  readonly page: PageSiteKey
  readonly cle: string
  readonly type: SectionTypeKey
  readonly portee: CatalogPortee
}

const TOUS: readonly SiteSlug[] = SITE_SLUGS
const AUTRES_FILIALES = ['entretien', 'transport', 'comptable', 'boissons'] as const

export const CATALOG: readonly CatalogEntry[] = [
  // COMMUN
  { page: PAGE_SITE.COMMUN, cle: 'piedDePage', type: 'texte', portee: TOUS },
  { page: PAGE_SITE.COMMUN, cle: 'maintenance', type: 'section', portee: TOUS },
  { page: PAGE_SITE.COMMUN, cle: 'mentionAlcool', type: 'texte', portee: ['boissons'] },
  // Mention Loi 25 unique pour le groupe (spec contact §2.1) : la politique /confidentialite
  // est celle de la holding, exposée à tous les sites via `PublicSite.groupe.mentionFormulaires`.
  { page: PAGE_SITE.COMMUN, cle: 'mentionFormulaires', type: 'texte', portee: 'holding' },

  // ACCUEIL — holding
  { page: PAGE_SITE.ACCUEIL, cle: 'seo', type: 'seo', portee: 'holding' },
  { page: PAGE_SITE.ACCUEIL, cle: 'hero', type: 'hero', portee: 'holding' },
  { page: PAGE_SITE.ACCUEIL, cle: 'filiales', type: 'section', portee: 'holding' },
  { page: PAGE_SITE.ACCUEIL, cle: 'chiffres', type: 'chiffres', portee: 'holding' },
  { page: PAGE_SITE.ACCUEIL, cle: 'cta', type: 'cta', portee: 'holding' },

  // ACCUEIL — entretien, transport, comptable, boissons
  { page: PAGE_SITE.ACCUEIL, cle: 'seo', type: 'seo', portee: AUTRES_FILIALES },
  { page: PAGE_SITE.ACCUEIL, cle: 'hero', type: 'hero', portee: AUTRES_FILIALES },
  { page: PAGE_SITE.ACCUEIL, cle: 'services', type: 'section', portee: AUTRES_FILIALES },
  { page: PAGE_SITE.ACCUEIL, cle: 'realisations', type: 'section', portee: AUTRES_FILIALES },
  { page: PAGE_SITE.ACCUEIL, cle: 'cta', type: 'cta', portee: AUTRES_FILIALES },

  // ACCUEIL — placement
  { page: PAGE_SITE.ACCUEIL, cle: 'seo', type: 'seo', portee: ['placement'] },
  { page: PAGE_SITE.ACCUEIL, cle: 'hero', type: 'hero', portee: ['placement'] },
  { page: PAGE_SITE.ACCUEIL, cle: 'audiences', type: 'duo', portee: ['placement'] },
  { page: PAGE_SITE.ACCUEIL, cle: 'services', type: 'section', portee: ['placement'] },
  { page: PAGE_SITE.ACCUEIL, cle: 'realisations', type: 'section', portee: ['placement'] },

  // ACCUEIL — cdpaa
  { page: PAGE_SITE.ACCUEIL, cle: 'seo', type: 'seo', portee: ['cdpaa'] },
  { page: PAGE_SITE.ACCUEIL, cle: 'hero', type: 'hero', portee: ['cdpaa'] },
  { page: PAGE_SITE.ACCUEIL, cle: 'metiers', type: 'duo', portee: ['cdpaa'] },
  { page: PAGE_SITE.ACCUEIL, cle: 'services', type: 'section', portee: ['cdpaa'] },
  { page: PAGE_SITE.ACCUEIL, cle: 'realisations', type: 'section', portee: ['cdpaa'] },

  // SERVICES — filiales (+ assistant pour cdpaa)
  { page: PAGE_SITE.SERVICES, cle: 'seo', type: 'seo', portee: 'filiales' },
  { page: PAGE_SITE.SERVICES, cle: 'entete', type: 'section', portee: 'filiales' },
  { page: PAGE_SITE.SERVICES, cle: 'cta', type: 'cta', portee: 'filiales' },
  { page: PAGE_SITE.SERVICES, cle: 'assistant', type: 'assistant', portee: ['cdpaa'] },

  // REALISATIONS — tous (holding compris, DEC-39)
  { page: PAGE_SITE.REALISATIONS, cle: 'seo', type: 'seo', portee: TOUS },
  { page: PAGE_SITE.REALISATIONS, cle: 'entete', type: 'section', portee: TOUS },

  // A_PROPOS — holding
  { page: PAGE_SITE.A_PROPOS, cle: 'seo', type: 'seo', portee: 'holding' },
  { page: PAGE_SITE.A_PROPOS, cle: 'histoire', type: 'histoire', portee: 'holding' },
  { page: PAGE_SITE.A_PROPOS, cle: 'reperes', type: 'chiffres', portee: 'holding' },
  { page: PAGE_SITE.A_PROPOS, cle: 'equipe', type: 'section', portee: 'holding' },
  { page: PAGE_SITE.A_PROPOS, cle: 'partenaires', type: 'section', portee: 'holding' },

  // A_PROPOS — filiales
  { page: PAGE_SITE.A_PROPOS, cle: 'seo', type: 'seo', portee: 'filiales' },
  { page: PAGE_SITE.A_PROPOS, cle: 'histoire', type: 'histoire', portee: 'filiales' },
  { page: PAGE_SITE.A_PROPOS, cle: 'equipe', type: 'section', portee: 'filiales' },
  { page: PAGE_SITE.A_PROPOS, cle: 'partenaires', type: 'section', portee: 'filiales' },

  // CONTACT — tous (+ suggestion pour cdpaa, boissons)
  { page: PAGE_SITE.CONTACT, cle: 'seo', type: 'seo', portee: TOUS },
  { page: PAGE_SITE.CONTACT, cle: 'contact', type: 'formulaire', portee: TOUS },
  { page: PAGE_SITE.CONTACT, cle: 'suggestion', type: 'formulaire', portee: ['cdpaa', 'boissons'] },

  // RESTAURANT — cdpaa
  { page: PAGE_SITE.RESTAURANT, cle: 'seo', type: 'seo', portee: ['cdpaa'] },
  { page: PAGE_SITE.RESTAURANT, cle: 'hero', type: 'hero', portee: ['cdpaa'] },
  { page: PAGE_SITE.RESTAURANT, cle: 'menu', type: 'galerie', portee: ['cdpaa'] },
  { page: PAGE_SITE.RESTAURANT, cle: 'reservation', type: 'formulaire', portee: ['cdpaa'] },

  // OFFRES — placement
  { page: PAGE_SITE.OFFRES, cle: 'seo', type: 'seo', portee: ['placement'] },
  { page: PAGE_SITE.OFFRES, cle: 'entete', type: 'section', portee: ['placement'] },
  { page: PAGE_SITE.OFFRES, cle: 'cta', type: 'cta', portee: ['placement'] },
  { page: PAGE_SITE.OFFRES, cle: 'candidature', type: 'formulaire', portee: ['placement'] },
  { page: PAGE_SITE.OFFRES, cle: 'spontanee', type: 'formulaire', portee: ['placement'] },

  // CONFIDENTIALITE — holding
  { page: PAGE_SITE.CONFIDENTIALITE, cle: 'seo', type: 'seo', portee: 'holding' },
  { page: PAGE_SITE.CONFIDENTIALITE, cle: 'politique', type: 'legal', portee: 'holding' },

  // MENTIONS_LEGALES — boissons
  { page: PAGE_SITE.MENTIONS_LEGALES, cle: 'seo', type: 'seo', portee: ['boissons'] },
  { page: PAGE_SITE.MENTIONS_LEGALES, cle: 'mentions', type: 'legal', portee: ['boissons'] },
] as const

export function entreeConcerneSite(entry: CatalogEntry, slug: SiteSlug): boolean {
  if (entry.portee === 'holding') return slug === HOLDING_SLUG
  if (entry.portee === 'filiales') return isFilialeSlug(slug)
  return entry.portee.includes(slug)
}

/** Entrées du catalogue concernant un site donné, dans l'ordre déclaré. */
export function catalogPourSite(slug: SiteSlug): readonly CatalogEntry[] {
  return CATALOG.filter((entry) => entreeConcerneSite(entry, slug))
}

export function trouverEntreeCatalogue(page: PageSiteKey, cle: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.page === page && entry.cle === cle)
}
