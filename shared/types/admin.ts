// DTO admin "réglages de site" (server/api/admin/sites/**, T1) et forme normalisée d'erreur
// consommée par app/utils/admin-error.ts (T4).
import type { ModuleKey } from '../config/modules'
import type { SiteSlug } from '../config/sites'

export type CompanyTypeDto = 'HOLDING' | 'FILIALE'
export type StatutSiteDto = 'ACTIF' | 'EN_MAINTENANCE' | 'EN_CONSTRUCTION'

export interface AdminSiteSummary {
  readonly uuid: string
  readonly slug: SiteSlug
  readonly nom: string
  readonly nomCourt: string | null
  readonly type: CompanyTypeDto
  readonly couleurAccent: string
  readonly statutSite: StatutSiteDto
  readonly modules: readonly ModuleKey[]
}

export interface AdminSiteReglages extends AdminSiteSummary {
  readonly ordre: number
  readonly secteur: string | null
  readonly description: string | null
  readonly effectif: number | null
  readonly email: string | null
  readonly telephone: string | null
  readonly adresse: string | null
  readonly linkedinUrl: string | null
  readonly facebookUrl: string | null
  readonly instagramUrl: string | null
  readonly heroImageKey: string | null
}

/** Forme normalisée d'erreur — `app/utils/admin-error.ts` (T4) `toAdminError(e)`. */
export interface AdminError {
  readonly message: string
  readonly status: number
}

// --- Lot 4 : messages, clients, tableau de bord ---------------------------------------------
import type { ContactFormulaire } from '../validation/contact'

/** Page d'une liste paginée (offset). `items` est vide si `page` dépasse le total. */
export interface AdminPage<T> {
  readonly items: readonly T[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly pageCount: number
}

/** Référence à un site (jamais d'id interne). */
export interface AdminSiteRef {
  readonly uuid: string
  readonly slug: SiteSlug
  readonly nom: string
}

export type StatutMessageDto = 'NOUVEAU' | 'EN_COURS' | 'TRAITE'
export type TypeMessageDto = 'CONTACT' | 'SUGGESTION_PRODUIT' | 'ASSISTANT_IMPORT_EXPORT'
export type StatutClientDto = 'PROSPECT' | 'CLIENT_ACTIF' | 'INACTIF'

/** Champ de `details` traduit côté serveur (libellé + valeur affichables). */
export interface ChampAffiche {
  readonly libelle: string
  readonly valeur: string
}

export interface AdminMessageDto {
  readonly uuid: string
  readonly nom: string
  readonly email: string
  readonly telephone: string | null
  readonly entreprise: string | null
  readonly sujet: string | null
  readonly message: string
  readonly type: TypeMessageDto
  readonly statut: StatutMessageDto
  readonly site: AdminSiteRef
  /** Formulaire d'origine déduit de `details`/`type` ; null si indéterminable. */
  readonly formulaire: ContactFormulaire | null
  readonly champs: readonly ChampAffiche[]
  /** ISO 8601 UTC. */
  readonly createdAt: string
}

export interface AdminClientDto {
  readonly uuid: string
  readonly nom: string
  readonly email: string | null
  readonly telephone: string | null
  readonly entreprise: string | null
  readonly statut: StatutClientDto
  readonly notes: string | null
  readonly site: AdminSiteRef
  /** Vrai si un dossier comptable est lié (supprimé en cascade avec le client). */
  readonly aDossier: boolean
  /** ISO 8601 UTC. */
  readonly derniereInteraction: string | null
  /** ISO 8601 UTC. */
  readonly dateAjout: string
}

export interface AdminDashboardSiteRow {
  readonly site: AdminSiteRef
  readonly couleurAccent: string
  readonly statutSite: StatutSiteDto
  readonly messagesNouveaux: number
  readonly clients: number
}

export interface AdminDashboardDto {
  readonly sites: readonly AdminDashboardSiteRow[]
  readonly derniersMessages: readonly AdminMessageDto[]
}
