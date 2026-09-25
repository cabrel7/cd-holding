// Service CMS "réalisations" (spec §4.2) — holding incluse (DEC-39, `allowHolding: true`).
import {
  createRealisationSchema,
  updateRealisationSchema,
  type CreateRealisationInput,
  type UpdateRealisationInput,
} from '#shared/validation/cms'
import type { CmsRealisationDto } from '#shared/types/cms'
import { defineCmsCollectionHandlers, type CmsCollectionService } from '../../utils/cms-collection'
import { dateFromDateOnly, dateOnlyFromDate, planReorder, toCmsSiteRef, SITE_REF_SELECT, type CompanyRefRow } from './shared'

const SELECT = {
  uuid: true,
  titre: true,
  description: true,
  imageKey: true,
  dateRealisation: true,
  ordre: true,
  updatedAt: true,
  company: { select: SITE_REF_SELECT },
} as const

interface RealisationRow {
  readonly uuid: string
  readonly titre: string
  readonly description: string
  readonly imageKey: string | null
  readonly dateRealisation: Date | null
  readonly ordre: number
  readonly updatedAt: Date
  readonly company: CompanyRefRow
}

function toDto(row: RealisationRow): CmsRealisationDto {
  return {
    uuid: row.uuid,
    titre: row.titre,
    description: row.description,
    imageKey: row.imageKey,
    dateRealisation: dateOnlyFromDate(row.dateRealisation),
    ordre: row.ordre,
    updatedAt: row.updatedAt.toISOString(),
    site: toCmsSiteRef(row.company),
  }
}

const service: CmsCollectionService<CmsRealisationDto, CreateRealisationInput, UpdateRealisationInput> = {
  createSchema: createRealisationSchema,
  updateSchema: updateRealisationSchema,

  async list(companyId) {
    const rows = await prisma.realisation.findMany({
      where: companyId === undefined ? {} : { companyId },
      orderBy: [{ company: { ordre: 'asc' } }, { ordre: 'asc' }],
      select: SELECT,
    })
    return rows.map(toDto)
  },

  findOwner(uuid) {
    return prisma.realisation.findUnique({ where: { uuid }, select: { id: true, companyId: true } })
  },

  async maxOrdre(companyId) {
    const aggregate = await prisma.realisation.aggregate({ where: { companyId }, _max: { ordre: true } })
    return aggregate._max.ordre ?? 0
  },

  async create(companyId, data, ordre) {
    const row = await prisma.realisation.create({
      data: {
        companyId,
        titre: data.titre,
        description: data.description,
        imageKey: data.imageKey ?? null,
        dateRealisation: dateFromDateOnly(data.dateRealisation ?? null),
        ordre,
      },
      select: SELECT,
    })
    return toDto(row)
  },

  async update(id, data) {
    const row = await prisma.realisation.update({
      where: { id },
      data: {
        ...(data.titre !== undefined ? { titre: data.titre } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.imageKey !== undefined ? { imageKey: data.imageKey } : {}),
        ...(data.dateRealisation !== undefined ? { dateRealisation: dateFromDateOnly(data.dateRealisation) } : {}),
      },
      select: SELECT,
    })
    return toDto(row)
  },

  async remove(id) {
    await prisma.realisation.delete({ where: { id } })
  },

  async reorder(companyId, uuids) {
    const rows = await prisma.realisation.findMany({ where: { companyId }, select: { id: true, uuid: true } })
    const plan = planReorder(rows, uuids)
    await prisma.$transaction(
      [...plan.entries()].map(([id, ordre]) => prisma.realisation.update({ where: { id }, data: { ordre } })),
    )
  },

  imageKeys(data) {
    return data.imageKey ? [data.imageKey] : []
  },
}

export const realisationsCms = defineCmsCollectionHandlers(service, { allowHolding: true })
