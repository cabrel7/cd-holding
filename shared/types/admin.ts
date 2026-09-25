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
