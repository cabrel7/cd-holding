// Service admin "clients" (lot 4). Aucune référence à l'event H3 : voir server/api/admin/clients/**.
// Filiale d'un client immuable (lien DossierComptable). Courriel toujours en minuscules.
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import type { AdminClientDto, AdminPage } from '#shared/types/admin'
import type { ClientCreateInput, ClientUpdateInput, ClientsQuery } from '#shared/validation/admin'
import type { Prisma } from '../../generated/prisma/client'
import type { AuthContext } from '../../utils/auth'
import { resolveReadScope, resolveWriteCompany, toSiteSlug } from '../../utils/site-scope'
import { buildPage, isUniqueViolation, pageArgs } from '../../lib/admin/pagination'

export const CLIENT_SELECT = {
  uuid: true,
  nom: true,
  email: true,
  telephone: true,
  entreprise: true,
  statut: true,
  notes: true,
  dateAjout: true,
  derniereInteraction: true,
  company: { select: { uuid: true, slug: true, nom: true } },
  // uuid du dossier seulement pour en déduire `aDossier` — jamais renvoyé.
  dossierComptable: { select: { uuid: true } },
} as const

type ClientRow = Prisma.ClientGetPayload<{ select: typeof CLIENT_SELECT }>

export function toClientDto(row: ClientRow): AdminClientDto {
  return {
    uuid: row.uuid,
    nom: row.nom,
    email: row.email,
    telephone: row.telephone,
    entreprise: row.entreprise,
    statut: row.statut,
    notes: row.notes,
    site: { uuid: row.company.uuid, slug: toSiteSlug(row.company.slug), nom: row.company.nom },
    aDossier: row.dossierComptable !== null,
    derniereInteraction: row.derniereInteraction?.toISOString() ?? null,
    dateAjout: row.dateAjout.toISOString(),
  }
}

const CONFLIT_EMAIL = 'Ce courriel existe déjà pour cette filiale.'

function whereRecherche(q: string): Prisma.ClientWhereInput {
  const contient = (champ: 'nom' | 'entreprise' | 'email' | 'telephone') => ({
    [champ]: { contains: q, mode: 'insensitive' as const },
  })
  return { OR: [contient('nom'), contient('entreprise'), contient('email'), contient('telephone')] }
}

export async function listClients(ctx: AuthContext, query: ClientsQuery): Promise<AdminPage<AdminClientDto>> {
  const scope = await resolveReadScope(ctx, query.site)
  const where: Prisma.ClientWhereInput = {
    ...(scope.companyId !== null ? { companyId: scope.companyId } : {}),
    ...(query.statut ? { statut: query.statut } : {}),
    ...(query.q ? whereRecherche(query.q) : {}),
  }
  const [total, rows] = await prisma.$transaction([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy: [{ dateAjout: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.page, ADMIN_PAGE_SIZE),
      select: CLIENT_SELECT,
    }),
  ])
  return buildPage(rows.map(toClientDto), total, query.page, ADMIN_PAGE_SIZE)
}

async function assertEmailLibre(companyId: number, email: string, excludeId?: number): Promise<void> {
  const existant = await prisma.client.findFirst({
    where: {
      companyId,
      email: { equals: email, mode: 'insensitive' },
      ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })
  if (existant) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL })
}

export async function createClient(ctx: AuthContext, data: ClientCreateInput): Promise<AdminClientDto> {
  const { companyId } = await resolveWriteCompany(ctx, data.site)
  await assertEmailLibre(companyId, data.email)
  try {
    const row = await prisma.client.create({
      data: {
        companyId,
        nom: data.nom,
        email: data.email,
        entreprise: data.entreprise ?? null,
        telephone: data.telephone ?? null,
        statut: data.statut,
        notes: data.notes ?? null,
      },
      select: CLIENT_SELECT,
    })
    return toClientDto(row)
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL })
    throw error
  }
}

async function findOwnedOr404(ctx: AuthContext, uuid: string): Promise<{ id: number; companyId: number }> {
  const owner = await prisma.client.findUnique({ where: { uuid }, select: { id: true, companyId: true } })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  assertCompanyAccess(ctx.user, ctx.secure, owner.companyId)
  return owner
}

export async function updateClient(ctx: AuthContext, uuid: string, data: ClientUpdateInput): Promise<AdminClientDto> {
  const owner = await findOwnedOr404(ctx, uuid)
  const patch: Prisma.ClientUpdateInput = {}
  if (data.nom !== undefined) patch.nom = data.nom
  if (data.entreprise !== undefined) patch.entreprise = data.entreprise
  if (data.telephone !== undefined) patch.telephone = data.telephone
  if (data.statut !== undefined) patch.statut = data.statut
  if (data.notes !== undefined) patch.notes = data.notes
  if (data.email !== undefined) {
    await assertEmailLibre(owner.companyId, data.email, owner.id)
    patch.email = data.email
  }
  try {
    const row = await prisma.client.update({ where: { id: owner.id }, data: patch, select: CLIENT_SELECT })
    return toClientDto(row)
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL })
    throw error
  }
}

/** Supprime aussi le DossierComptable lié (cascade Prisma). */
export async function deleteClient(ctx: AuthContext, uuid: string): Promise<void> {
  const owner = await findOwnedOr404(ctx, uuid)
  await prisma.client.deleteMany({ where: { id: owner.id } })
}
