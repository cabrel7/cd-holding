// Service CMS "partenaires" (spec §4.2) — holding incluse.
import {
  createPartenaireSchema,
  updatePartenaireSchema,
  type CreatePartenaireInput,
  type UpdatePartenaireInput,
} from '#shared/validation/cms'
import type { CmsPartenaireDto } from '#shared/types/cms'
import { defineCmsCollectionHandlers, type CmsCollectionService } from '../../utils/cms-collection'
import { planReorder, toCmsSiteRef, SITE_REF_SELECT, type CompanyRefRow } from './shared'

const SELECT = {
  uuid: true,
  nom: true,
  typeRelation: true,
  siteUrl: true,
  logoKey: true,
  ordre: true,
  updatedAt: true,
  company: { select: SITE_REF_SELECT },
} as const

interface PartenaireRow {
  readonly uuid: string
  readonly nom: string
  readonly typeRelation: string | null
  readonly siteUrl: string | null
  readonly logoKey: string | null
  readonly ordre: number
  readonly updatedAt: Date
  readonly company: CompanyRefRow
}

function toDto(row: PartenaireRow): CmsPartenaireDto {
  return {
    uuid: row.uuid,
    nom: row.nom,
    typeRelation: row.typeRelation,
    siteUrl: row.siteUrl,
    logoKey: row.logoKey,
    ordre: row.ordre,
    updatedAt: row.updatedAt.toISOString(),
    site: toCmsSiteRef(row.company),
  }
}

const service: CmsCollectionService<CmsPartenaireDto, CreatePartenaireInput, UpdatePartenaireInput> = {
  createSchema: createPartenaireSchema,
  updateSchema: updatePartenaireSchema,

  async list(companyId) {
    const rows = await prisma.partenaire.findMany({
      where: companyId === undefined ? {} : { companyId },
      orderBy: [{ company: { ordre: 'asc' } }, { ordre: 'asc' }],
      select: SELECT,
    })
    return rows.map(toDto)
  },

  findOwner(uuid) {
    return prisma.partenaire.findUnique({ where: { uuid }, select: { id: true, companyId: true } })
  },

  async maxOrdre(companyId) {
    const aggregate = await prisma.partenaire.aggregate({ where: { companyId }, _max: { ordre: true } })
    return aggregate._max.ordre ?? 0
  },

  async create(companyId, data, ordre) {
    const row = await prisma.partenaire.create({
      data: {
        companyId,
        nom: data.nom,
        typeRelation: data.typeRelation ?? null,
        siteUrl: data.siteUrl ?? null,
        logoKey: data.logoKey ?? null,
        ordre,
      },
      select: SELECT,
    })
    return toDto(row)
  },

  async update(id, data) {
    const row = await prisma.partenaire.update({
      where: { id },
      data: {
        ...(data.nom !== undefined ? { nom: data.nom } : {}),
        ...(data.typeRelation !== undefined ? { typeRelation: data.typeRelation } : {}),
        ...(data.siteUrl !== undefined ? { siteUrl: data.siteUrl } : {}),
        ...(data.logoKey !== undefined ? { logoKey: data.logoKey } : {}),
      },
      select: SELECT,
    })
    return toDto(row)
  },

  async remove(id) {
    await prisma.partenaire.delete({ where: { id } })
  },

  async reorder(companyId, uuids) {
    const rows = await prisma.partenaire.findMany({ where: { companyId }, select: { id: true, uuid: true } })
    const plan = planReorder(rows, uuids)
    await prisma.$transaction(
      [...plan.entries()].map(([id, ordre]) => prisma.partenaire.update({ where: { id }, data: { ordre } })),
    )
  },

  imageKeys(data) {
    return data.logoKey ? [data.logoKey] : []
  },
}

export const partenairesCms = defineCmsCollectionHandlers(service, { allowHolding: true })
