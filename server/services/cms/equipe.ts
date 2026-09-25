// Service CMS "équipe" (spec §4.2) — membres de l'équipe, holding incluse.
import {
  createMembreEquipeSchema,
  updateMembreEquipeSchema,
  type CreateMembreEquipeInput,
  type UpdateMembreEquipeInput,
} from '#shared/validation/cms'
import type { CmsMembreEquipeDto } from '#shared/types/cms'
import { defineCmsCollectionHandlers, type CmsCollectionService } from '../../utils/cms-collection'
import { planReorder, toCmsSiteRef, SITE_REF_SELECT, type CompanyRefRow } from './shared'

const SELECT = {
  uuid: true,
  nom: true,
  poste: true,
  bio: true,
  photoKey: true,
  ordre: true,
  updatedAt: true,
  company: { select: SITE_REF_SELECT },
} as const

interface MembreEquipeRow {
  readonly uuid: string
  readonly nom: string
  readonly poste: string
  readonly bio: string | null
  readonly photoKey: string | null
  readonly ordre: number
  readonly updatedAt: Date
  readonly company: CompanyRefRow
}

function toDto(row: MembreEquipeRow): CmsMembreEquipeDto {
  return {
    uuid: row.uuid,
    nom: row.nom,
    poste: row.poste,
    bio: row.bio,
    photoKey: row.photoKey,
    ordre: row.ordre,
    updatedAt: row.updatedAt.toISOString(),
    site: toCmsSiteRef(row.company),
  }
}

const service: CmsCollectionService<CmsMembreEquipeDto, CreateMembreEquipeInput, UpdateMembreEquipeInput> = {
  createSchema: createMembreEquipeSchema,
  updateSchema: updateMembreEquipeSchema,

  async list(companyId) {
    const rows = await prisma.membreEquipe.findMany({
      where: companyId === undefined ? {} : { companyId },
      orderBy: [{ company: { ordre: 'asc' } }, { ordre: 'asc' }],
      select: SELECT,
    })
    return rows.map(toDto)
  },

  findOwner(uuid) {
    return prisma.membreEquipe.findUnique({ where: { uuid }, select: { id: true, companyId: true } })
  },

  async maxOrdre(companyId) {
    const aggregate = await prisma.membreEquipe.aggregate({ where: { companyId }, _max: { ordre: true } })
    return aggregate._max.ordre ?? 0
  },

  async create(companyId, data, ordre) {
    const row = await prisma.membreEquipe.create({
      data: {
        companyId,
        nom: data.nom,
        poste: data.poste,
        bio: data.bio ?? null,
        photoKey: data.photoKey ?? null,
        ordre,
      },
      select: SELECT,
    })
    return toDto(row)
  },

  async update(id, data) {
    const row = await prisma.membreEquipe.update({
      where: { id },
      data: {
        ...(data.nom !== undefined ? { nom: data.nom } : {}),
        ...(data.poste !== undefined ? { poste: data.poste } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.photoKey !== undefined ? { photoKey: data.photoKey } : {}),
      },
      select: SELECT,
    })
    return toDto(row)
  },

  async remove(id) {
    await prisma.membreEquipe.delete({ where: { id } })
  },

  async reorder(companyId, uuids) {
    const rows = await prisma.membreEquipe.findMany({ where: { companyId }, select: { id: true, uuid: true } })
    const plan = planReorder(rows, uuids)
    await prisma.$transaction(
      [...plan.entries()].map(([id, ordre]) => prisma.membreEquipe.update({ where: { id }, data: { ordre } })),
    )
  },

  imageKeys(data) {
    return data.photoKey ? [data.photoKey] : []
  },
}

export const equipeCms = defineCmsCollectionHandlers(service, { allowHolding: true })
