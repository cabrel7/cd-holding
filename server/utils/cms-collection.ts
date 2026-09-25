// Factory tranchée pour les 4 collections CMS (services, réalisations, équipe, partenaires,
// spec §4.2/§4.5) : `defineCmsCollectionHandlers(service, { allowHolding })` produit les 5
// handlers (list/create/update/remove/reorder) qui appliquent, EN UN SEUL ENDROIT, le flux de
// sécurité commun : rôle → zod → portée filiale → images → service → invalidation ISR. Chaque
// fichier de route sous server/api/admin/contenu/{res}/** tient en une ligne
// (`export default xCms.list`), voir server/services/cms/*.ts.
import type { H3Event } from 'h3'
import { z, type ZodType } from 'zod'
import { MAX_REORDER_ITEMS } from '#shared/config/cms'
import { HOLDING_SLUG, siteSlugSchema, type SiteSlug } from '#shared/config/sites'
import { assertPublicImages } from './public-images'
import { invalidatePublicPages } from './isr'
import { resolveReadScope, resolveWriteCompany } from './site-scope'

const CMS_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export interface CmsCollectionItem {
  readonly uuid: string
}

export interface CmsOwnerRef {
  readonly id: number
  readonly companyId: number
}

/**
 * Contrat qu'un service de collection CMS (server/services/cms/*.ts) doit fournir — des
 * closures typées plutôt qu'un délégué Prisma exposé tel quel : les délégués Prisma ne sont
 * pas structurellement compatibles entre eux (Service ≠ Realisation ≠ MembreEquipe ≠
 * Partenaire), les exposer directement à la factory aurait exigé un cast `any`.
 */
export interface CmsCollectionService<
  TDto extends CmsCollectionItem,
  TCreate extends { site?: SiteSlug },
  TUpdate extends { site?: SiteSlug },
> {
  readonly createSchema: ZodType<TCreate>
  readonly updateSchema: ZodType<TUpdate>
  list(companyId: number | undefined): Promise<TDto[]>
  findOwner(uuid: string): Promise<CmsOwnerRef | null>
  maxOrdre(companyId: number): Promise<number>
  create(companyId: number, data: Omit<TCreate, 'site'>, ordre: number): Promise<TDto>
  update(id: number, data: Omit<TUpdate, 'site'>): Promise<TDto>
  remove(id: number): Promise<void>
  /** Doit lever 400 (ensemble incomplet) si `uuids` ne couvre pas exactement la filiale. */
  reorder(companyId: number, uuids: readonly string[]): Promise<void>
  imageKeys(data: Omit<TCreate, 'site'> | Omit<TUpdate, 'site'>): readonly string[]
  /** Ex. plafond `misEnAvant` (services) — lève une erreur métier (409) si dépassé. */
  beforeWrite?(companyId: number, data: Omit<TCreate, 'site'> | Omit<TUpdate, 'site'>, currentId?: number): Promise<void>
}

export interface CmsCollectionOptions {
  /** false : refuse toute écriture visant la holding (ex. services, spec §4.2). */
  readonly allowHolding: boolean
}

export interface CmsCollectionHandlers {
  readonly list: ReturnType<typeof defineEventHandler>
  readonly create: ReturnType<typeof defineEventHandler>
  readonly update: ReturnType<typeof defineEventHandler>
  readonly remove: ReturnType<typeof defineEventHandler>
  readonly reorder: ReturnType<typeof defineEventHandler>
}

const uuidParamSchema = z.object({ uuid: z.string().uuid() })
const listQuerySchema = z.object({ site: siteSlugSchema.optional() }).strict()
const reorderBodySchema = z
  .object({ site: siteSlugSchema.optional(), uuids: z.array(z.string().uuid()).min(1).max(MAX_REORDER_ITEMS) })
  .strict()
  .refine((obj) => new Set(obj.uuids).size === obj.uuids.length, { message: 'uuids en double' })

function assertNotHolding(slug: SiteSlug, allowHolding: boolean): void {
  if (!allowHolding && slug === HOLDING_SLUG) {
    throw createError({ statusCode: 400, statusMessage: 'Ressource non disponible pour la holding' })
  }
}

function stripSite<T extends { site?: SiteSlug }>(data: T): Omit<T, 'site'> {
  const { site: _site, ...rest } = data
  return rest
}

export function defineCmsCollectionHandlers<
  TDto extends CmsCollectionItem,
  TCreate extends { site?: SiteSlug },
  TUpdate extends { site?: SiteSlug },
>(service: CmsCollectionService<TDto, TCreate, TUpdate>, options: CmsCollectionOptions): CmsCollectionHandlers {
  async function requireOwnedItem(event: H3Event) {
    const { uuid } = await getValidatedRouterParams(event, uuidParamSchema.parse)
    const owner = await service.findOwner(uuid)
    if (!owner) {
      throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
    }
    return owner
  }

  const list = defineEventHandler(async (event) => {
    const ctx = await requireRole(event, CMS_ROLES)
    const query = await getValidatedQuery(event, listQuerySchema.parse)
    const scope = await resolveReadScope(ctx, query.site)
    if (scope.scope === 'all') return service.list(undefined)
    if (scope.companyId === null) {
      // Défensif : `resolveReadScope` renvoie 'company' uniquement avec un companyId résolu ;
      // un compte non rattaché n'a pas droit à une liste globale par défaut.
      throw createError({ statusCode: 403, statusMessage: 'Compte non rattaché à une filiale' })
    }
    return service.list(scope.companyId)
  })

  const create = defineEventHandler(async (event) => {
    const ctx = await requireRole(event, CMS_ROLES)
    const data = await readValidatedBody(event, service.createSchema.parse)
    const { companyId, slug } = await resolveWriteCompany(ctx, data.site)
    assertNotHolding(slug, options.allowHolding)

    const payload = stripSite(data)
    const imageKeys = service.imageKeys(payload)
    if (imageKeys.length > 0) await assertPublicImages(imageKeys, companyId)
    if (service.beforeWrite) await service.beforeWrite(companyId, payload)

    const ordre = (await service.maxOrdre(companyId)) + 1
    const created = await service.create(companyId, payload, ordre)
    await invalidatePublicPages()
    setResponseStatus(event, 201)
    return created
  })

  const update = defineEventHandler(async (event) => {
    const ctx = await requireRole(event, CMS_ROLES)
    const owner = await requireOwnedItem(event)
    assertCompanyAccess(ctx.user, ctx.secure, owner.companyId)

    const data = await readValidatedBody(event, service.updateSchema.parse)
    if (data.site !== undefined) {
      throw createError({ statusCode: 400, statusMessage: "Le site d'une fiche existante n'est pas modifiable" })
    }

    const payload = stripSite(data)
    const imageKeys = service.imageKeys(payload)
    if (imageKeys.length > 0) await assertPublicImages(imageKeys, owner.companyId)
    if (service.beforeWrite) await service.beforeWrite(owner.companyId, payload, owner.id)

    const updated = await service.update(owner.id, payload)
    await invalidatePublicPages()
    return updated
  })

  const remove = defineEventHandler(async (event) => {
    const ctx = await requireRole(event, CMS_ROLES)
    const owner = await requireOwnedItem(event)
    assertCompanyAccess(ctx.user, ctx.secure, owner.companyId)

    await service.remove(owner.id)
    await invalidatePublicPages()
    setResponseStatus(event, 204)
    return null
  })

  const reorder = defineEventHandler(async (event) => {
    const ctx = await requireRole(event, CMS_ROLES)
    const data = await readValidatedBody(event, reorderBodySchema.parse)
    const { companyId, slug } = await resolveWriteCompany(ctx, data.site)
    assertNotHolding(slug, options.allowHolding)

    await service.reorder(companyId, data.uuids)
    await invalidatePublicPages()
    setResponseStatus(event, 204)
    return null
  })

  return { list, create, update, remove, reorder }
}
