// Logique pure du pipeline de réservation (restaurant ccdpaa, spec
// docs/specs/lot3-pages-specifiques.md §3). AUCUN accès à H3 ni à Prisma ici (skill nitro) :
// directement testable (tests/unit/reservation-mapping.test.ts) sans booter Nitro.
// `server/api/public/restaurant/{index.get,reservations.post}.ts` orchestrent (rate-limit,
// lecture/écriture Prisma, courriels) et n'y ajoutent aucune règle métier.
import { FUSEAU_QUEBEC } from '#shared/utils/dates'
import { libelleHeure, type ReglagesReservation } from '#shared/utils/restaurant'
import type { ReservationBody } from '#shared/validation/reservation'
import type { PublicRestaurantDto } from '#shared/types/public'

// --- GET /api/public/restaurant -------------------------------------------------------------

/** `select` explicite : jamais `id` ni `companyId`. */
export const RESTAURANT_SELECT = {
  nom: true,
  adresse: true,
  quartier: true,
  joursOuverture: true,
  heureOuverture: true,
  heureFermeture: true,
  dernierService: true,
  pasCreneauMinutes: true,
  capaciteMaxReservation: true,
  delaiMinimumHeures: true,
  horizonJours: true,
} as const

export interface ReglagesRow extends ReglagesReservation {
  readonly nom: string
  readonly adresse: string | null
  readonly quartier: string | null
}

export function toRestaurantDto(row: ReglagesRow): PublicRestaurantDto {
  return {
    nom: row.nom,
    adresse: row.adresse,
    quartier: row.quartier,
    joursOuverture: row.joursOuverture,
    heureOuverture: row.heureOuverture,
    heureFermeture: row.heureFermeture,
    dernierService: row.dernierService,
    pasCreneauMinutes: row.pasCreneauMinutes,
    capaciteMaxReservation: row.capaciteMaxReservation,
    delaiMinimumHeures: row.delaiMinimumHeures,
    horizonJours: row.horizonJours,
  }
}

// --- POST /api/public/restaurant/reservations -----------------------------------------------

export interface ReservationData {
  readonly companyId: number
  readonly nom: string
  readonly email: string
  readonly telephone: string
  readonly nombrePersonnes: number
  readonly dateReservation: Date
  readonly notes: string | null
}

/** Prépare les données Prisma — `dateReservation` déjà résolue en UTC par l'appelant (`instantQuebec`). */
export function construireReservation(body: ReservationBody, companyId: number, dateReservation: Date): ReservationData {
  return {
    companyId,
    nom: body.nom,
    email: body.email,
    telephone: body.telephone,
    nombrePersonnes: body.nombrePersonnes,
    dateReservation,
    notes: body.notes ?? null,
  }
}

const JOUR_DATE_FORMATTER = new Intl.DateTimeFormat('fr-CA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: FUSEAU_QUEBEC,
})

/** « 4 personnes, mercredi 14 octobre 2026 à 19h30 » — généré côté serveur (spec §3, jamais promis « dans l'heure »). */
export function recapitulatifReservation(body: ReservationBody, dateReservation: Date): string {
  const personnes = body.nombrePersonnes === 1 ? '1 personne' : `${body.nombrePersonnes} personnes`
  return `${personnes}, ${JOUR_DATE_FORMATTER.format(dateReservation)} à ${libelleHeure(body.heure)}`
}

// --- Idempotence sous concurrence ------------------------------------------------------------

export type IssueReservation = 'creee' | 'existante'

/** P2034 = conflit d'écriture / échec de sérialisation (Prisma) ; 40001 = serialization_failure Postgres. */
export function estConflitSerialisation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const { code, meta } = err as { code?: unknown; meta?: { code?: unknown } }
  return code === 'P2034' || meta?.code === '40001'
}

/** P2002 = violation de contrainte unique (Prisma) — ici l'index partiel `ReservationRestaurant_doublon_key`. */
export function estViolationUnique(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  return (err as { code?: unknown }).code === 'P2002'
}

/**
 * Décision pure : `tenter` = findFirst+create en transaction Serializable. Sur violation de
 * la contrainte unique (P2002 — lot 5, index partiel), la ligne active identique existe
 * nécessairement : 'existante' immédiatement, sans relecture ni second essai (pas de second
 * accusé). Sur conflit de sérialisation (P2034/40001), on relit ; ligne identique présente →
 * 'existante' (envoi idempotent) ; sinon un unique nouvel essai. Toute autre erreur (ou second
 * conflit) remonte.
 */
export async function ecrireIdempotent(
  tenter: () => Promise<IssueReservation>,
  relireExiste: () => Promise<boolean>,
): Promise<IssueReservation> {
  try {
    return await tenter()
  } catch (err) {
    if (estViolationUnique(err)) return 'existante'
    if (!estConflitSerialisation(err)) throw err
    if (await relireExiste()) return 'existante'
    return tenter()
  }
}
