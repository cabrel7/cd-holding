// Service admin "comptable" (lot 5) : dossiers clients. Un dossier est l'extension filière
// d'un Client (relation 1-1) — la création crée les deux en transaction, la suppression ne
// détruit QUE le dossier (le Client survit dans le carnet CRM, écart assumé vs la spec).
// Scoping systématique sur `ctx.company.id` (filiale comptable épinglée par requireModule).
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import { formatDateISO } from '#shared/utils/dates'
import type { AdminDossierComptableDto, AdminDossiersPageDto, ForfaitComptableDto } from '#shared/types/admin'
import type { DossierCreateInput, DossierUpdateInput, DossiersQuery } from '#shared/validation/comptable'
import type { Prisma } from '../../generated/prisma/client'
import { buildPage, isUniqueViolation, pageArgs } from '../../lib/admin/pagination'
import type { ModuleAuthContext } from '../../utils/site-scope'

const CONFLIT_EMAIL = 'Ce courriel existe déjà pour cette filiale.'

// --- Select explicite (uuid seul exposé, jamais id/clientId) ----

export const DOSSIER_SELECT = {
  uuid: true,
  forfait: true,
  statut: true,
  echeance: true,
  notes: true,
  client: { select: { nom: true, entreprise: true, email: true } },
} as const

type DossierRow = Prisma.DossierComptableGetPayload<{ select: typeof DOSSIER_SELECT }>

// forfait/echeance sont nullables en base (héritage du schéma) mais le create zod les exige
// toujours : fallback défensif uniquement pour des données legacy corrompues.
const FORFAIT_DEFAUT: ForfaitComptableDto = 'MENSUEL'

export function toDossierDto(row: DossierRow): AdminDossierComptableDto {
  return {
    uuid: row.uuid,
    entreprise: row.client.entreprise ?? '',
    contact: row.client.nom,
    email: row.client.email ?? '',
    forfait: row.forfait ?? FORFAIT_DEFAUT,
    echeance: formatDateISO(row.echeance) ?? '',
    statut: row.statut,
    notes: row.notes,
  }
}

// --- Liste ----

export async function listDossiers(ctx: ModuleAuthContext, query: DossiersQuery): Promise<AdminDossiersPageDto> {
  const companyId = ctx.company.id
  const where: Prisma.DossierComptableWhereInput = {
    client: { companyId },
    ...(query.statut ? { statut: query.statut } : {}),
  }
  const [total, enRetard, rows] = await prisma.$transaction([
    prisma.dossierComptable.count({ where }),
    // Compteur global indépendant du filtre et de la page (bandeau du prototype).
    prisma.dossierComptable.count({ where: { client: { companyId }, statut: 'EN_RETARD' } }),
    prisma.dossierComptable.findMany({
      where,
      orderBy: [{ echeance: { sort: 'asc', nulls: 'last' } }, { id: 'desc' }],
      ...pageArgs(query.page, ADMIN_PAGE_SIZE),
      select: DOSSIER_SELECT,
    }),
  ])
  return { ...buildPage(rows.map(toDossierDto), total, query.page, ADMIN_PAGE_SIZE), enRetard }
}

// --- Écritures ----

async function assertEmailLibre(companyId: number, email: string, excludeClientId?: number): Promise<void> {
  const existant = await prisma.client.findFirst({
    where: {
      companyId,
      email: { equals: email, mode: 'insensitive' },
      ...(excludeClientId !== undefined ? { id: { not: excludeClientId } } : {}),
    },
    select: { id: true },
  })
  if (existant) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL })
}

function echeanceUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export async function createDossier(ctx: ModuleAuthContext, data: DossierCreateInput): Promise<AdminDossierComptableDto> {
  await assertEmailLibre(ctx.company.id, data.email)
  try {
    const row = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          companyId: ctx.company.id,
          nom: data.contact,
          entreprise: data.entreprise,
          email: data.email,
          telephone: null,
          statut: 'CLIENT_ACTIF',
          notes: null,
          derniereInteraction: new Date(),
        },
        select: { id: true },
      })
      return tx.dossierComptable.create({
        data: {
          clientId: client.id,
          forfait: data.forfait,
          statut: data.statut,
          echeance: echeanceUtc(data.echeance),
          notes: data.notes ?? null,
        },
        select: DOSSIER_SELECT,
      })
    })
    return toDossierDto(row)
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL })
    throw error
  }
}

async function findDossierOwnedOr404(ctx: ModuleAuthContext, uuid: string): Promise<{ id: number; clientId: number }> {
  const owner = await prisma.dossierComptable.findFirst({
    where: { uuid, client: { companyId: ctx.company.id } },
    select: { id: true, clientId: true },
  })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  return owner
}

export async function updateDossier(
  ctx: ModuleAuthContext,
  uuid: string,
  data: DossierUpdateInput,
): Promise<AdminDossierComptableDto> {
  const owner = await findDossierOwnedOr404(ctx, uuid)
  const patchDossier: Prisma.DossierComptableUpdateInput = {}
  const patchClient: Prisma.ClientUpdateInput = {}
  if (data.forfait !== undefined) patchDossier.forfait = data.forfait
  if (data.echeance !== undefined) patchDossier.echeance = echeanceUtc(data.echeance)
  if (data.statut !== undefined) patchDossier.statut = data.statut
  if (data.notes !== undefined) patchDossier.notes = data.notes
  if (data.contact !== undefined) patchClient.nom = data.contact
  if (data.entreprise !== undefined) patchClient.entreprise = data.entreprise
  if (data.email !== undefined) {
    await assertEmailLibre(ctx.company.id, data.email, owner.clientId)
    patchClient.email = data.email
  }
  try {
    const row = await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: owner.clientId },
        data: { ...patchClient, derniereInteraction: new Date() },
      })
      return tx.dossierComptable.update({ where: { id: owner.id }, data: patchDossier, select: DOSSIER_SELECT })
    })
    return toDossierDto(row)
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL })
    throw error
  }
}

/** Supprime le dossier seul — le Client survit dans le carnet CRM (cascade Prisma : client → dossier). */
export async function deleteDossier(ctx: ModuleAuthContext, uuid: string): Promise<void> {
  const owner = await findDossierOwnedOr404(ctx, uuid)
  await prisma.dossierComptable.delete({ where: { id: owner.id } })
}
