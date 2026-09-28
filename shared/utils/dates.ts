// Helpers de date purs, partagés client/serveur. Toujours en UTC explicite : une date stockée
// sans heure (ex. Realisation.dateRealisation @db.Date) ne doit jamais glisser d'un jour selon
// le fuseau du serveur qui la formate (piège classique : "juin 2022" qui devient "mai 2022").
const MOIS_ANNEE_FORMATTER = new Intl.DateTimeFormat('fr-CA', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const DATE_ISO_FORMATTER = new Intl.DateTimeFormat('fr-CA', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value
}

/** "2022-06-15" ou un Date UTC → "juin 2022". */
export function formatMoisAnnee(value: Date | string): string {
  return MOIS_ANNEE_FORMATTER.format(toDate(value))
}

/** "2022-06-15" ou un Date UTC → "15 juin 2022". */
export function formatDateLongue(value: Date | string): string {
  return DATE_ISO_FORMATTER.format(toDate(value))
}

/** Date/Date-string → "YYYY-MM-DD" (UTC), ou null si absente. Forme attendue par les DTO publics. */
export function formatDateISO(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return toDate(value).toISOString().slice(0, 10)
}

export function isDateISOValide(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
}

/** Fuseau de référence des formulaires publics (entreprises québécoises). */
export const FUSEAU_QUEBEC = 'America/Toronto'

const JOUR_QUEBEC_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: FUSEAU_QUEBEC,
})

/** Date du jour au Québec, "YYYY-MM-DD" (en-CA formate déjà en ISO). */
export function dateDuJourQuebec(maintenant: Date = new Date()): string {
  return JOUR_QUEBEC_FORMATTER.format(maintenant)
}

/** "YYYY-MM-DD" + n jours (calcul UTC, sans glissement de fuseau). */
export function ajouterJoursIso(dateIso: string, jours: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + jours)
  return date.toISOString().slice(0, 10)
}

/** Vrai seulement pour une date calendaire existante ("2026-02-30" → faux, là où Date la décale). */
export function isDateCalendaireValide(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
