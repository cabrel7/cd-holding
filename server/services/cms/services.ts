// Service CMS "services" (spec §4.2) — closures Prisma consommées par
// server/utils/cms-collection.ts. Holding exclue (`allowHolding: false`).
import { createServiceSchema, updateServiceSchema, type CreateServiceInput, type UpdateServiceInput } from '#shared/validation/cms'
import { MAX_SERVICES_MIS_EN_AVANT } from '#shared/config/cms'
import type { CmsServiceDto } from '#shared/types/cms'
import { defineCmsCollectionHandlers, type CmsCollectionService } from '../../utils/cms-collection'
import { planReorder, toCmsSiteRef, SITE_REF_SELECT, type CompanyRefRow } from './shared'

const SELECT = {
  uuid: true,
  titre: true,
  description: true,
  imageKey: true,
  misEnAvant: true,
  ordre: true,
  updatedAt: true,
  company: { select: SITE_REF_SELECT },
} as const

interface ServiceRow {
  readonly uuid: string
  readonly titre: string
  readonly description: string
  readonly imageKey: string | null
  readonly misEnAvant: boolean
  readonly ordre: number
  readonly updatedAt: Date
  readonly company: CompanyRefRow
}

function toDto(row: ServiceRow): CmsServiceDto {
  return {
    uuid: row.uuid,
    titre: row.titre,
    description: row.description,
    imageKey: row.imageKey,
    misEnAvant: row.misEnAvant,
    ordre: row.ordre,
    updatedAt: row.updatedAt.toISOString(),
    site: toCmsSiteRef(row.company),
  }
}

const service: CmsCollectionService<CmsServiceDto, CreateServiceInput, UpdateServiceInput> = {
  createSchema: createServiceSchema,
  updateSchema: updateServiceSchema,

  async list(companyId) {
    const rows = await prisma.service.findMany({
      where: companyId === undefined ? {} : { companyId },
      orderBy: [{ company: { ordre: 'asc' } }, { ordre: 'asc' }],
      select: SELECT,
    })
    return rows.map(toDto)
  },

  findOwner(uuid) {
    return prisma.service.findUnique({ where: { uuid }, select: { id: true, companyId: true } })
  },

  async maxOrdre(companyId) {
    const aggregate = await prisma.service.aggregate({ where: { companyId }, _max: { ordre: true } })
    return aggregate._max.ordre ?? 0
  },

  async create(companyId, data, ordre) {
    const row = await prisma.service.create({
      data: {
        companyId,
        titre: data.titre,
        description: data.description,
        imageKey: data.imageKey ?? null,
        misEnAvant: data.misEnAvant ?? false,
        ordre,
      },
      select: SELECT,
    })
    return toDto(row)
  },

  async update(id, data) {
    const row = await prisma.service.update({
      where: { id },
      data: {
        ...(data.titre !== undefined ? { titre: data.titre } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.imageKey !== undefined ? { imageKey: data.imageKey } : {}),
        ...(data.misEnAvant !== undefined ? { misEnAvant: data.misEnAvant } : {}),
      },
      select: SELECT,
    })
    return toDto(row)
  },

  async remove(id) {
    await prisma.service.delete({ where: { id } })
  },

  async reorder(companyId, uuids) {
    const rows = await prisma.service.findMany({ where: { companyId }, select: { id: true, uuid: true } })
    const plan = planReorder(rows, uuids)
    await prisma.$transaction(
      [...plan.entries()].map(([id, ordre]) => prisma.service.update({ where: { id }, data: { ordre } })),
    )
  },

  imageKeys(data) {
    return data.imageKey ? [data.imageKey] : []
  },

  async beforeWrite(companyId, data, currentId) {
    if (data.misEnAvant !== true) return
    const count = await prisma.service.count({
      where: { companyId, misEnAvant: true, ...(currentId !== undefined ? { id: { not: currentId } } : {}) },
    })
    if (count >= MAX_SERVICES_MIS_EN_AVANT) {
      throw createError({ statusCode: 409, statusMessage: 'Nombre maximal de services mis en avant atteint' })
    }
  },
}

export const servicesCms = defineCmsCollectionHandlers(service, { allowHolding: false })
