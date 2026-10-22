// Helpers purs du planning (lot 5) : semaines Québec, durées avec quarts de nuit.
// Imports relatifs uniquement (seed/tsx).
import { ajouterJoursIso, dateDuJourQuebec, jourIsoSemaine } from './dates'

export interface QuartBornes {
  readonly dateDebut: Date
  readonly dateFin: Date
}

/** Lundi (YYYY-MM-DD) de la semaine contenant `dateIso` (elle-même si déjà un lundi). */
export function lundiDeSemaineQuebec(dateIso: string = dateDuJourQuebec()): string {
  return ajouterJoursIso(dateIso, 1 - jourIsoSemaine(dateIso))
}

/**
 * Durée en minutes entre deux instants. Quart de nuit géré comme le prototype :
 * fin <= début → +24 h. AUCUNE vérification fin > début, AUCUN contrôle de chevauchement.
 */
export function dureeMinutes(debut: Date, fin: Date): number {
  let ms = fin.getTime() - debut.getTime()
  if (ms <= 0) ms += 24 * 60 * 60 * 1000
  return Math.round(ms / 60000)
}

/** Total d'heures d'une semaine, arrondi à 0.1 (prototype mon-planning). */
export function totalHeures(quarts: ReadonlyArray<QuartBornes>): number {
  const minutes = quarts.reduce((total, quart) => total + dureeMinutes(quart.dateDebut, quart.dateFin), 0)
  return Math.round((minutes / 60) * 10) / 10
}
