// DTO publics (server/services/public/**, T1) — jamais un objet Prisma brut. `couleurAccent`
// est revalidée côté serveur (`^#[0-9A-F]{6}$`, repli navy) avant d'être injectée en style
// inline : ce type suppose déjà une valeur sûre.
import type { SiteSlug } from '../config/sites'
import type { TypeContratKey } from '../config/candidature'
import type { ReglagesReservation } from '../utils/restaurant'

export type StatutSitePublic = 'ACTIF' | 'EN_MAINTENANCE' | 'EN_CONSTRUCTION'

export interface PublicSiteSummary {
  readonly uuid: string
  readonly slug: SiteSlug
  readonly nom: string
  readonly secteur: string | null
  readonly description: string | null
  readonly couleurAccent: string
  readonly heroImageKey: string | null
  readonly statutSite: StatutSitePublic
}

export interface PublicSiteReseaux {
  readonly linkedinUrl: string | null
  readonly facebookUrl: string | null
  readonly instagramUrl: string | null
}

/** Valeur résolue d'une entrée du catalogue de sections — voir shared/content/sections. */
export type PublicSectionDonnees = Record<string, unknown>

export interface PublicSiteCommun {
  readonly piedDePage: PublicSectionDonnees | null
  readonly maintenance: PublicSectionDonnees | null
  readonly mentionAlcool: PublicSectionDonnees | null
}

export interface PublicSite {
  readonly uuid: string
  readonly slug: SiteSlug
  readonly nom: string
  readonly nomCourt: string | null
  readonly secteur: string | null
  readonly description: string | null
  readonly couleurAccent: string
  readonly heroImageKey: string | null
  readonly email: string | null
  readonly telephone: string | null
  readonly adresse: string | null
  readonly reseaux: PublicSiteReseaux
  readonly statutSite: StatutSitePublic
  readonly groupe: { readonly nom: string; readonly mentionFormulaires: string | null }
  readonly commun: PublicSiteCommun
}

export interface PublicServiceDto {
  readonly uuid: string
  readonly titre: string
  readonly description: string
  readonly imageKey: string | null
  readonly ordre: number
}

export interface PublicRealisationDto {
  readonly uuid: string
  readonly titre: string
  readonly description: string
  readonly imageKey: string | null
  readonly dateRealisation: string | null
}

export interface PublicMembreEquipeDto {
  readonly uuid: string
  readonly nom: string
  readonly poste: string
  readonly bio: string | null
  readonly photoKey: string | null
}

export interface PublicPartenaireDto {
  readonly uuid: string
  readonly nom: string
  readonly typeRelation: string | null
  readonly siteUrl: string | null
  readonly logoKey: string | null
}

/** Clé du catalogue → données résolues (chiffres calculés, `donnees` sinon telle quelle). */
export type PublicSectionsDto = Record<string, PublicSectionDonnees>

export interface PublicOffreDto {
  readonly uuid: string
  readonly titre: string
  readonly lieu: string
  readonly typeContrat: TypeContratKey
  readonly salaire: string | null
  readonly description: string
  readonly publieeLe: string /* ISO */
}

export interface PublicRestaurantDto extends ReglagesReservation {
  readonly nom: string
  readonly adresse: string | null
  readonly quartier: string | null
}
