// Règles pures de réservation du restaurant (DEC-27). Toutes les valeurs viennent de
// `ReglagesRestaurant` (aucun horaire en dur) — imports relatifs uniquement (seed/tsx).
import { ajouterJoursIso, dateDuJourQuebec, instantQuebec, isDateCalendaireValide, jourIsoSemaine } from './dates'

export const RESTAURANT_SLUG = 'cdpaa' as const

export interface ReglagesReservation {
  readonly joursOuverture: readonly number[] // ISO 1 = lundi … 7 = dimanche
  readonly heureOuverture: string
  readonly heureFermeture: string
  readonly dernierService: string // "HH:mm"
  readonly pasCreneauMinutes: number
  readonly capaciteMaxReservation: number
  readonly delaiMinimumHeures: number
  readonly horizonJours: number
}

export const HEURE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const MS_PAR_HEURE = 3_600_000
const MINUTES_PAR_JOUR = 1440

export const minutesDepuisMinuit = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5))
const heureDepuisMinutes = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Entiers ISO 1..7, uniques (les doublons ou 0/8/1.5 signaleraient des réglages corrompus). */
function joursOuvertureValides(jours: readonly number[]): boolean {
  return Array.isArray(jours) && jours.every((j) => Number.isInteger(j) && j >= 1 && j <= 7) && new Set(jours).size === jours.length
}

/** Garde-fou (boucle infinie, créneaux absurdes) — le zod admin (lot 5) impose les mêmes règles. */
export function reglagesValides(r: ReglagesReservation): boolean {
  return (
    joursOuvertureValides(r.joursOuverture) &&
    HEURE_PATTERN.test(r.heureOuverture) &&
    HEURE_PATTERN.test(r.dernierService) &&
    HEURE_PATTERN.test(r.heureFermeture) &&
    r.pasCreneauMinutes > 0 &&
    r.pasCreneauMinutes <= MINUTES_PAR_JOUR &&
    minutesDepuisMinuit(r.heureOuverture) <= minutesDepuisMinuit(r.dernierService) &&
    r.capaciteMaxReservation >= 1 &&
    r.horizonJours >= 0 &&
    r.delaiMinimumHeures >= 0
  )
}

export function bornesDates(r: ReglagesReservation, maintenant: Date = new Date()): { min: string; max: string } {
  const min = dateDuJourQuebec(maintenant)
  return { min, max: ajouterJoursIso(min, r.horizonJours) }
}

export type RaisonDateInvalide = 'format' | 'passee' | 'trop-loin' | 'fermee'

export function verifierDate(r: ReglagesReservation, dateIso: string, maintenant: Date = new Date()): RaisonDateInvalide | null {
  if (!isDateCalendaireValide(dateIso)) return 'format'
  const { min, max } = bornesDates(r, maintenant)
  if (dateIso < min) return 'passee'
  if (dateIso > max) return 'trop-loin'
  return r.joursOuverture.includes(jourIsoSemaine(dateIso)) ? null : 'fermee'
}

/** Créneaux "HH:mm" réservables ; si la date est aujourd'hui, instant ≥ maintenant + délai minimum. */
export function creneauxPourDate(r: ReglagesReservation, dateIso: string, maintenant: Date = new Date()): string[] {
  if (!reglagesValides(r) || verifierDate(r, dateIso, maintenant) !== null) return []
  const seuil = maintenant.getTime() + r.delaiMinimumHeures * MS_PAR_HEURE
  const creneaux: string[] = []
  for (let m = minutesDepuisMinuit(r.heureOuverture); m <= minutesDepuisMinuit(r.dernierService); m += r.pasCreneauMinutes) {
    const heure = heureDepuisMinutes(m)
    if (instantQuebec(dateIso, heure).getTime() >= seuil) creneaux.push(heure)
  }
  return creneaux
}

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const
const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** [2..7] → « Mardi — dimanche » ; [2,4,6] → « Mardi, jeudi, samedi ». */
export function libelleJoursOuverture(jours: readonly number[]): string {
  const tries = [...new Set(jours)].filter((j) => j >= 1 && j <= 7).sort((a, b) => a - b)
  if (tries.length === 0) return ''
  const noms = tries.map((j) => JOURS[j - 1] ?? '')
  const contigus = tries.every((j, i) => i === 0 || j === (tries[i - 1] ?? 0) + 1)
  return majuscule(contigus && noms.length > 2 ? `${noms[0]} — ${noms.at(-1)}` : noms.join(', '))
}

export const libelleHeure = (heure: string): string => heure.replace(':', 'h')
