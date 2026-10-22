// Service admin "réservations" (lot 5) : réservations du restaurant CDPAA — liste paginée
// + changement de statut, rien de plus (spec docs/specs/lot5-reservations.md §3). Aucune
// référence à l'event H3 : les handlers (server/api/admin/reservations/**) font `requireModule`
// + validation zod, puis appellent ces fonctions. Scoping systématique sur `ctx.company.id`
// (la filiale restaurant — déjà épinglée par requireModule, SUPER_ADMIN compris).
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import type { AdminPage, AdminReservationDto, StatutReservationDto } from '#shared/types/admin'
import type { ReservationUpdateInput, ReservationsQuery } from '#shared/validation/reservation'
import type { Prisma } from '../../generated/prisma/client'
import { buildPage, isUniqueViolation, pageArgs } from '../../lib/admin/pagination'
import { toSiteSlug, type ModuleAuthContext } from '../../utils/site-scope'

// --- Select explicite (jamais id/FK numériques exposés) --------------------------------------

const COMPANY_REF_SELECT = { select: { uuid: true, slug: true, nom: true } } as const

export const RESERVATION_SELECT = {
  uuid: true,
  nom: true,
  email: true,
  telephone: true,
  nombrePersonnes: true,
  dateReservation: true,
  notes: true,
  statut: true,
  createdAt: true,
  company: COMPANY_REF_SELECT,
} as const

// --- Interfaçage de mapping (découplé du payload Prisma : testable sans DB) ------------------

export interface ReservationMapRow {
  readonly uuid: string
  readonly nom: string
  readonly email: string
  readonly telephone: string
  readonly nombrePersonnes: number
  readonly dateReservation: Date
  readonly notes: string | null
  readonly statut: StatutReservationDto
  readonly createdAt: Date
  readonly company: { readonly uuid: string; readonly slug: string; readonly nom: string }
}

// --- Mapper (export public : réutilisé par le dashboard + les tests) --------------------------

export function toReservationDto(row: ReservationMapRow): AdminReservationDto {
  return {
    uuid: row.uuid,
    nom: row.nom,
    email: row.email,
    telephone: row.telephone,
    nombrePersonnes: row.nombrePersonnes,
    dateReservation: row.dateReservation.toISOString(),
    notes: row.notes,
    statut: row.statut,
    site: { uuid: row.company.uuid, slug: toSiteSlug(row.company.slug), nom: row.company.nom },
    createdAt: row.createdAt.toISOString(),
  }
}

// --- GET /api/admin/reservations --------------------------------------------------------------

function whereRechercheReservation(q: string): Prisma.ReservationRestaurantWhereInput {
  return {
    OR: [
      { nom: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { telephone: { contains: q, mode: 'insensitive' } },
    ],
  }
}

export async function listReservations(
  ctx: ModuleAuthContext,
  query: ReservationsQuery,
): Promise<AdminPage<AdminReservationDto>> {
  const where: Prisma.ReservationRestaurantWhereInput = {
    companyId: ctx.company.id,
    ...(query.statut ? { statut: query.statut } : {}),
    ...(query.q ? whereRechercheReservation(query.q) : {}),
  }
  const [total, rows] = await prisma.$transaction([
    prisma.reservationRestaurant.count({ where }),
    prisma.reservationRestaurant.findMany({
      where,
      orderBy: [{ dateReservation: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.page, ADMIN_PAGE_SIZE),
      select: RESERVATION_SELECT,
    }),
  ])
  return buildPage(rows.map(toReservationDto), total, query.page, ADMIN_PAGE_SIZE)
}

// --- PATCH /api/admin/reservations/[uuid] -----------------------------------------------------

const CONFLIT_RESERVATION_ACTIVE = 'Une réservation active existe déjà pour ce créneau et ce courriel.'

export async function updateReservationStatut(
  ctx: ModuleAuthContext,
  uuid: string,
  statut: ReservationUpdateInput['statut'],
): Promise<AdminReservationDto> {
  const owner = await prisma.reservationRestaurant.findFirst({
    where: { uuid, companyId: ctx.company.id },
    select: { id: true },
  })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })

  try {
    const row = await prisma.reservationRestaurant.update({
      where: { id: owner.id },
      data: { statut },
      select: RESERVATION_SELECT,
    })
    return toReservationDto(row)
  } catch (error) {
    // Réactiver une ANNULEE alors qu'une ligne active occupe déjà (companyId, email,
    // dateReservation) viole l'index partiel `ReservationRestaurant_doublon_key` → 409
    // explicite (distinct du perdant de la course publique, silencieux lui).
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: CONFLIT_RESERVATION_ACTIVE })
    throw error
  }
}
