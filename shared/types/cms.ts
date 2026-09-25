// DTO admin CMS (server/resources ou mappers de server/services/cms/**, T1) et contrats
// consommés par app/composables/useAdminResource.ts (T4).
import type { SiteSlug } from '../config/sites'
import type { PageSiteKey } from '../content/sections/catalog'

export interface CmsSiteRef {
  readonly uuid: string
  readonly slug: SiteSlug
  readonly nom: string
}

export interface CmsItemBase {
  readonly uuid: string
  readonly ordre: number
  readonly updatedAt: string
  readonly site: CmsSiteRef
}

export interface CmsServiceDto extends CmsItemBase {
  readonly titre: string
  readonly description: string
  readonly imageKey: string | null
  readonly misEnAvant: boolean
}

export interface CmsRealisationDto extends CmsItemBase {
  readonly titre: string
  readonly description: string
  readonly imageKey: string | null
  readonly dateRealisation: string | null
}

export interface CmsMembreEquipeDto extends CmsItemBase {
  readonly nom: string
  readonly poste: string
  readonly bio: string | null
  readonly photoKey: string | null
}

export interface CmsPartenaireDto extends CmsItemBase {
  readonly nom: string
  readonly typeRelation: string | null
  readonly siteUrl: string | null
  readonly logoKey: string | null
}

export type CmsCollectionDto = CmsServiceDto | CmsRealisationDto | CmsMembreEquipeDto | CmsPartenaireDto

export interface CmsSectionDto {
  readonly uuid: string
  readonly page: PageSiteKey
  readonly cle: string
  readonly donnees: Record<string, unknown>
  readonly updatedAt: string
}
