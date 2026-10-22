// Service admin "planning" (lot 5, sous-lot planning) : grille hebdomadaire des quarts
// (entretien/transport/ccdpaa) + lecture employé. Aucune référence à l'event H3 : les handlers
// (server/api/admin/planning/**, server/api/admin/mon-planning.get.ts) font la validation zod +
// `requireModule`/`requireRole`, puis appellent ces fonctions. Scoping systématique sur
// `ctx.company.id` (la filiale du `site` — déjà épinglée par requireModule, SUPER_ADMIN compris).
// Aucun contrôle de chevauchement, aucune vérification fin > début (nuit = +24 h, prototype),
// aucun 409 (pas de contrainte d'unicité) — spec docs/specs/lot5-planning.md §§1-2.
import type { PlanningSite } from '#shared/config/planning'
import type { AdminQuartDto, MonPlanningDto, PlanningSemaineDto } from '#shared/types/admin'
import { ajouterJoursIso, instantQuebec } from '#shared/utils/dates'
import { lundiDeSemaineQuebec, totalHeures } from '#shared/utils/planning'
import type {
  PlanningSemaineQuery,
  QuartCreateInput,
  QuartUpdateInput,
} from '#shared/validation/planning'
import type { Prisma } from '../../generated/prisma/client'
import type { AuthContext } from '../../utils/auth'
import type { ModuleAuthContext } from '../../utils/site-scope'

// --- Select explicite (jamais id/FK numériques exposés ; pas de ref company : aucun DTO
// planning n'expose de site) -------------------------------------------------------------------

export const PLANNING_SELECT = {
  uuid: true,
  titre: true,
  lieu: true,
  dateDebut: true,
  dateFin: true,
  notes: true,
  employe: { select: { uuid: true } },
} as const

// --- Interfaçage de mapping (découplé du payload Prisma : testable sans DB) -------------------

export interface PlanningMapRow {
  readonly uuid: string
  readonly titre: string | null
  readonly lieu: string
  readonly dateDebut: Date
  readonly dateFin: Date
  readonly notes: string | null
  readonly employe: { readonly uuid: string }
}

// --- Mapper (export public : réutilisé par les tests) -----------------------------------------

export function toQuartDto(row: PlanningMapRow): AdminQuartDto {
  return {
    uuid: row.uuid,
    employeUuid: row.employe.uuid,
    titre: row.titre,
    lieu: row.lieu,
    dateDebut: row.dateDebut.toISOString(),
    dateFin: row.dateFin.toISOString(),
    notes: row.notes,
  }
}

// --- Fenêtre de semaine (murale Québec : bornes via instantQuebec pour la DST) ----------------

const HEURE_DEBUT_JOUR = '00:00'
const JOURS_PAR_SEMAINE = 7

function fenetreSemaine(semaineOptionnelle: string | undefined): {
  semaine: string
  debut: Date
  fin: Date
} {
  const semaine = semaineOptionnelle ?? lundiDeSemaineQuebec()
  return {
    semaine,
    debut: instantQuebec(semaine, HEURE_DEBUT_JOUR),
    fin: instantQuebec(ajouterJoursIso(semaine, JOURS_PAR_SEMAINE), HEURE_DEBUT_JOUR),
  }
}

// --- GET /api/admin/planning/[site] -----------------------------------------------------------

export async function listSemaine(
  ctx: ModuleAuthContext,
  _site: PlanningSite,
  query: PlanningSemaineQuery,
): Promise<PlanningSemaineDto> {
  // `_site` n'est pas relu ici : requireModule l'a déjà converti en `ctx.company`
  // (filiale + module vérifiés), seule source de scoping.
  const { semaine, debut, fin } = fenetreSemaine(query.semaine)
  const [employes, quarts] = await Promise.all([
    prisma.employe.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { nom: 'asc' },
      select: { uuid: true, nom: true, poste: true, actif: true },
    }),
    prisma.planningEntry.findMany({
      where: { companyId: ctx.company.id, dateDebut: { gte: debut, lt: fin } },
      orderBy: [{ dateDebut: 'asc' }, { id: 'asc' }],
      select: PLANNING_SELECT,
    }),
  ])
  return { semaine, employes, quarts: quarts.map(toQuartDto) }
}

// --- POST /api/admin/planning/[site] + PATCH /api/admin/planning/[site]/[uuid] ----------------

const EMPLOYE_INACTIF = "Cet employé n'est plus actif."

async function findEmployeOwnedOr404(
  ctx: ModuleAuthContext,
  employeUuid: string,
): Promise<{ id: number; actif: boolean }> {
  const employe = await prisma.employe.findFirst({
    where: { uuid: employeUuid, companyId: ctx.company.id },
    select: { id: true, actif: true },
  })
  if (!employe) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  return employe
}

function assertEmployeActif(employe: { actif: boolean }): void {
  if (!employe.actif) throw createError({ statusCode: 400, statusMessage: EMPLOYE_INACTIF })
}

export async function createQuart(
  ctx: ModuleAuthContext,
  _site: PlanningSite,
  data: QuartCreateInput,
): Promise<AdminQuartDto> {
  const employe = await findEmployeOwnedOr404(ctx, data.employeUuid)
  assertEmployeActif(employe)
  const row = await prisma.planningEntry.create({
    data: {
      companyId: ctx.company.id,
      employeId: employe.id,
      titre: data.titre ?? null,
      lieu: data.lieu,
      dateDebut: new Date(data.dateDebut),
      dateFin: new Date(data.dateFin),
      notes: data.notes ?? null,
    },
    select: PLANNING_SELECT,
  })
  return toQuartDto(row)
}

export async function updateQuart(
  ctx: ModuleAuthContext,
  _site: PlanningSite,
  uuid: string,
  data: QuartUpdateInput,
): Promise<AdminQuartDto> {
  const owner = await prisma.planningEntry.findFirst({
    where: { uuid, companyId: ctx.company.id },
    select: { id: true },
  })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })

  // `texteOptionnel` convertit déjà '' → undefined : `!== undefined` suffit, pas de cas vide.
  const patch: Prisma.PlanningEntryUpdateInput = {}
  if (data.employeUuid !== undefined) {
    const employe = await findEmployeOwnedOr404(ctx, data.employeUuid)
    assertEmployeActif(employe)
    patch.employe = { connect: { id: employe.id } }
  }
  if (data.titre !== undefined) patch.titre = data.titre
  if (data.lieu !== undefined) patch.lieu = data.lieu
  if (data.dateDebut !== undefined) patch.dateDebut = new Date(data.dateDebut)
  if (data.dateFin !== undefined) patch.dateFin = new Date(data.dateFin)
  if (data.notes !== undefined) patch.notes = data.notes

  const row = await prisma.planningEntry.update({
    where: { id: owner.id },
    data: patch,
    select: PLANNING_SELECT,
  })
  return toQuartDto(row)
}

// --- DELETE /api/admin/planning/[site]/[uuid] --------------------------------------------------

export async function deleteQuart(
  ctx: ModuleAuthContext,
  _site: PlanningSite,
  uuid: string,
): Promise<void> {
  const owner = await prisma.planningEntry.findFirst({
    where: { uuid, companyId: ctx.company.id },
    select: { id: true },
  })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  await prisma.planningEntry.deleteMany({ where: { id: owner.id } })
}

// --- GET /api/admin/mon-planning ---------------------------------------------------------------

const SANS_DOSSIER_EMPLOYE = 'Aucun dossier employé associé à votre compte.'

export async function getMonPlanning(
  ctx: AuthContext,
  query: PlanningSemaineQuery,
): Promise<MonPlanningDto> {
  // Employé résolu par `secure.userId` (lien User↔Employé DEC-29), jamais par un param client.
  // Pas de scoping company : le dossier trouvé porte déjà sa filiale via `employeId`.
  const employe = await prisma.employe.findFirst({
    where: { userId: ctx.secure.userId },
    select: { id: true, nom: true, poste: true },
  })
  if (!employe) throw createError({ statusCode: 404, statusMessage: SANS_DOSSIER_EMPLOYE })

  const { semaine, debut, fin } = fenetreSemaine(query.semaine)
  const quarts = await prisma.planningEntry.findMany({
    where: { employeId: employe.id, dateDebut: { gte: debut, lt: fin } },
    orderBy: [{ dateDebut: 'asc' }, { id: 'asc' }],
    select: PLANNING_SELECT,
  })
  return {
    employe: { nom: employe.nom, poste: employe.poste },
    semaine,
    quarts: quarts.map(toQuartDto),
    totalHeures: totalHeures(quarts),
  }
}
