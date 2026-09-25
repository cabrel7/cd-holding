// Handlers admin "sections" (spec §4.2) — pas de create/delete/reorder : le catalogue
// (shared/content/sections/) est défini par le code, l'admin n'édite que les valeurs
// (`SectionContenu.donnees`), toujours validées par le schéma zod du TYPE déclaré au
// catalogue pour la ligne visée (jamais celui fourni par le client).
import { z } from 'zod'
import { sectionsQuerySchema, sectionUpdateSchema } from '#shared/validation/cms'
import { catalogPourSite, PAGE_SITE, sectionTypeDefinition, trouverEntreeCatalogue, type PageSiteKey } from '#shared/content/sections'
import type { CmsSectionDto } from '#shared/types/cms'
import type { Prisma } from '../../generated/prisma/client'
import { assertPublicImages, collectImageKeys } from '../../utils/public-images'
import { invalidatePublicPages } from '../../utils/isr'
import { resolveWriteCompany } from '../../utils/site-scope'

const CMS_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const uuidParamSchema = z.object({ uuid: z.string().uuid() })

/** Caste un `SectionContenu.page` (enum Prisma) vers le miroir shared `PageSiteKey` — frontière Prisma. */
function toPageSiteKey(page: string): PageSiteKey {
  if (!(page in PAGE_SITE)) {
    throw createError({ statusCode: 500, statusMessage: 'Page de section invalide' })
  }
  return page as PageSiteKey
}

const list = defineEventHandler(async (event): Promise<CmsSectionDto[]> => {
  const ctx = await requireRole(event, CMS_ROLES)
  const query = await getValidatedQuery(event, sectionsQuerySchema.parse)
  const { companyId } = await resolveWriteCompany(ctx, query.site)

  const catalog = catalogPourSite(query.site)
  const rows = await prisma.sectionContenu.findMany({
    where: { companyId },
    select: { uuid: true, page: true, cle: true, donnees: true, updatedAt: true },
  })
  const byKey = new Map(rows.map((row) => [`${row.page}:${row.cle}`, row]))

  const result: CmsSectionDto[] = []
  for (const entry of catalog) {
    const row = byKey.get(`${entry.page}:${entry.cle}`)
    if (!row) continue // pas encore semé (T2) — l'admin ne crée jamais de clé (spec §1.2)
    result.push({
      uuid: row.uuid,
      page: toPageSiteKey(row.page),
      cle: row.cle,
      donnees: row.donnees as Record<string, unknown>,
      updatedAt: row.updatedAt.toISOString(),
    })
  }
  return result
})

const update = defineEventHandler(async (event): Promise<CmsSectionDto> => {
  const ctx = await requireRole(event, CMS_ROLES)
  const { uuid } = await getValidatedRouterParams(event, uuidParamSchema.parse)

  const existing = await prisma.sectionContenu.findUnique({
    where: { uuid },
    select: { id: true, companyId: true, page: true, cle: true },
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }
  assertCompanyAccess(ctx.user, ctx.secure, existing.companyId)

  const entry = trouverEntreeCatalogue(toPageSiteKey(existing.page), existing.cle)
  if (!entry) {
    // Ligne orpheline (clé retirée du catalogue depuis le seed) : ne devrait pas exister.
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }

  const body = await readValidatedBody(event, sectionUpdateSchema.parse)
  const definition = sectionTypeDefinition(entry.type)
  const donneesResult = definition.schema.safeParse(body.donnees)
  if (!donneesResult.success) {
    throw createError({ statusCode: 400, statusMessage: 'Contenu invalide pour ce type de section' })
  }

  const imageKeys = collectImageKeys(entry.type, donneesResult.data)
  if (imageKeys.length > 0) await assertPublicImages(imageKeys, existing.companyId)

  const row = await prisma.sectionContenu.update({
    where: { id: existing.id },
    data: { donnees: donneesResult.data as Prisma.InputJsonValue },
    select: { uuid: true, page: true, cle: true, donnees: true, updatedAt: true },
  })
  await invalidatePublicPages()

  return {
    uuid: row.uuid,
    page: toPageSiteKey(row.page),
    cle: row.cle,
    donnees: row.donnees as Record<string, unknown>,
    updatedAt: row.updatedAt.toISOString(),
  }
})

export const sectionsCms = { list, update }
