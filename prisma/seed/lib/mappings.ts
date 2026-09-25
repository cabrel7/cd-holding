// Fonctions de correspondance PURES (statuts, dates) entre les données du prototype
// (prisma/seed-data/*) et les enums/colonnes Prisma (spec phase 2 §3.4). Exportées et testées
// unitairement (tests/unit/seed-mapping.test.ts) — aucun accès Prisma ni horloge implicite ici :
// tout "maintenant" est un paramètre explicite pour rester déterministe en test.
import {
  CategoriePoste,
  ForfaitComptable,
  NiveauExperience,
  OrigineCandidat,
  StatutCandidat,
  StatutCandidature,
  StatutClient,
  StatutDemande,
  StatutDossier,
  StatutMessage,
  StatutReservation,
  TypeContrat,
} from '../../../server/generated/prisma/client'
import type {
  CategoriePosteLabel,
  ForfaitComptablePrototype,
  JourSemaine,
  OrigineCandidatPrototype,
  StatutCandidaturePrototype,
  StatutCandidatPrototype,
  StatutClientPrototype,
  StatutDemandePrototype,
  StatutDossierPrototype,
  StatutEmployePrototype,
  StatutMessagePrototype,
  StatutReservationPrototype,
  TypeContratPrototype,
} from '../../seed-data/types'

export function mapStatutMessage(value: StatutMessagePrototype): StatutMessage {
  const table: Record<StatutMessagePrototype, StatutMessage> = {
    nouveau: StatutMessage.NOUVEAU,
    en_cours: StatutMessage.EN_COURS,
    traite: StatutMessage.TRAITE,
  }
  return table[value]
}

export function mapStatutReservation(value: StatutReservationPrototype): StatutReservation {
  const table: Record<StatutReservationPrototype, StatutReservation> = {
    en_attente: StatutReservation.EN_ATTENTE,
    confirmee: StatutReservation.CONFIRMEE,
    annulee: StatutReservation.ANNULEE,
  }
  return table[value]
}

export function mapActifEmploye(statut: StatutEmployePrototype): boolean {
  // DEC-30 : `Employe.actif` est un booléen simple — "en_conge" reste un employé actif au
  // sens du planning (il réapparaîtra), seul "inactif" bascule le drapeau à false.
  return statut !== 'inactif'
}

export function mapCategoriePoste(value: CategoriePosteLabel): CategoriePoste {
  const table: Record<CategoriePosteLabel, CategoriePoste> = {
    Manutention: CategoriePoste.MANUTENTION,
    'Chauffeur classe 1': CategoriePoste.CHAUFFEUR_CLASSE_1,
    'Chauffeur classe 3': CategoriePoste.CHAUFFEUR_CLASSE_3,
    'Chauffeur classe 5': CategoriePoste.CHAUFFEUR_CLASSE_5,
    Entretien: CategoriePoste.ENTRETIEN,
    Autre: CategoriePoste.AUTRE,
  }
  return table[value]
}

export function mapStatutCandidat(value: StatutCandidatPrototype): StatutCandidat {
  const table: Record<StatutCandidatPrototype, StatutCandidat> = {
    disponible: StatutCandidat.DISPONIBLE,
    en_process: StatutCandidat.EN_PROCESSUS,
    place: StatutCandidat.PLACE,
  }
  return table[value]
}

export function mapOrigineCandidat(value: OrigineCandidatPrototype): OrigineCandidat {
  const table: Record<OrigineCandidatPrototype, OrigineCandidat> = {
    local: OrigineCandidat.LOCAL,
    international: OrigineCandidat.INTERNATIONAL,
  }
  return table[value]
}

export function mapStatutDemande(value: StatutDemandePrototype): StatutDemande {
  const table: Record<StatutDemandePrototype, StatutDemande> = {
    ouverte: StatutDemande.OUVERTE,
    pourvue: StatutDemande.POURVUE,
    annulee: StatutDemande.ANNULEE,
  }
  return table[value]
}

export function mapTypeContrat(value: TypeContratPrototype): TypeContrat {
  const table: Record<TypeContratPrototype, TypeContrat> = {
    'Temps plein': TypeContrat.TEMPS_PLEIN,
    'Temps partiel': TypeContrat.TEMPS_PARTIEL,
    Temporaire: TypeContrat.TEMPORAIRE,
  }
  return table[value]
}

export function mapForfaitComptable(value: ForfaitComptablePrototype): ForfaitComptable {
  const table: Record<ForfaitComptablePrototype, ForfaitComptable> = {
    Mensuel: ForfaitComptable.MENSUEL,
    Trimestriel: ForfaitComptable.TRIMESTRIEL,
    Annuel: ForfaitComptable.ANNUEL,
  }
  return table[value]
}

export function mapStatutDossier(value: StatutDossierPrototype): StatutDossier {
  const table: Record<StatutDossierPrototype, StatutDossier> = {
    a_jour: StatutDossier.A_JOUR,
    en_retard: StatutDossier.EN_RETARD,
    en_traitement: StatutDossier.EN_TRAITEMENT,
  }
  return table[value]
}

export function mapStatutClient(value: StatutClientPrototype): StatutClient {
  const table: Record<StatutClientPrototype, StatutClient> = {
    prospect: StatutClient.PROSPECT,
    actif: StatutClient.CLIENT_ACTIF,
    inactif: StatutClient.INACTIF,
  }
  return table[value]
}

// Le prototype n'a que 3 statuts de candidature côté démo ("recue", "en_revue", "entrevue") —
// "refusee"/"embauchee" n'existent pas dans StatutCandidature (NOUVELLE/EN_REVISION/RETENUE/REJETEE,
// DEC-18). Mapping complet pour rester correct si le mock évolue.
export function mapStatutCandidature(value: StatutCandidaturePrototype): StatutCandidature {
  const table: Record<StatutCandidaturePrototype, StatutCandidature> = {
    recue: StatutCandidature.NOUVELLE,
    en_revue: StatutCandidature.EN_REVISION,
    entrevue: StatutCandidature.EN_REVISION,
    refusee: StatutCandidature.REJETEE,
    embauchee: StatutCandidature.RETENUE,
  }
  return table[value]
}

const JOURS_ISO: Record<JourSemaine, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 7,
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Combine une date "YYYY-MM-DD" et une heure "HH:mm" interprétées en America/Montreal, retourne
 * l'instant UTC équivalent. Pas de dépendance à une lib de fuseaux : on déduit le décalage
 * Montréal (EST -05:00 / EDT -04:00) via `Intl.DateTimeFormat` sur l'instant candidat, ce qui
 * gère le changement d'heure sans base de données de fuseaux embarquée.
 */
export function montrealDateHeureToUtc(dateISO: string, heureHHmm: string): Date {
  const [year, month, day] = dateISO.split('-').map(Number)
  const [hour, minute] = heureHHmm.split(':').map(Number)
  // Première approximation : traiter les composants comme UTC, puis mesurer le décalage réel
  // de Montréal à cet instant pour corriger.
  const approxUtc = Date.UTC(year, month - 1, day, hour, minute)
  const offsetMinutes = montrealOffsetMinutesAt(approxUtc)
  return new Date(approxUtc - offsetMinutes * 60_000)
}

/** Décalage (en minutes, négatif) de America/Montreal par rapport à UTC à un instant donné. */
function montrealOffsetMinutesAt(utcMillis: number): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Montreal',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(new Date(utcMillis)).map((p) => [p.type, p.value]))
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return Math.round((asUtc - utcMillis) / 60_000)
}

/** Date/heure de référence (UTC) + décalage en jours → nouvelle Date UTC (heure conservée). */
export function decalerJours(reference: Date, jours: number): Date {
  return new Date(reference.getTime() + jours * 86_400_000)
}

/**
 * Calcule la prochaine occurrence (ou celle de la semaine ISO courante) d'un jour de la semaine
 * à partir d'une date de référence, en America/Montreal, combinée à une heure "HH:mm" — retourne
 * l'instant UTC. Si `finHHmm < debutHHmm`, le service se termine le lendemain (quart de nuit).
 */
export function jourSemaineVersDates(
  reference: Date,
  jour: JourSemaine,
  debutHHmm: string,
  finHHmm: string,
): { dateDebut: Date; dateFin: Date } {
  const referenceParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Montreal',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference)
  const refYear = Number(referenceParts.find((p) => p.type === 'year')?.value)
  const refMonth = Number(referenceParts.find((p) => p.type === 'month')?.value)
  const refDay = Number(referenceParts.find((p) => p.type === 'day')?.value)
  const refDateUtcMidday = Date.UTC(refYear, refMonth - 1, refDay, 12)
  const refWeekday = isoWeekdayFromUtcMidday(refDateUtcMidday)

  const deltaJours = JOURS_ISO[jour] - refWeekday
  const cibleUtcMidday = refDateUtcMidday + deltaJours * 86_400_000
  const cibleParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(cibleUtcMidday))
  const cy = Number(cibleParts.find((p) => p.type === 'year')?.value)
  const cm = Number(cibleParts.find((p) => p.type === 'month')?.value)
  const cd = Number(cibleParts.find((p) => p.type === 'day')?.value)
  const cibleISO = `${cy}-${pad2(cm)}-${pad2(cd)}`

  const dateDebut = montrealDateHeureToUtc(cibleISO, debutHHmm)
  const finDepasseMinuit = finHHmm < debutHHmm
  const dateFin = finDepasseMinuit ? decalerJours(montrealDateHeureToUtc(cibleISO, finHHmm), 1) : montrealDateHeureToUtc(cibleISO, finHHmm)
  return { dateDebut, dateFin }
}

function isoWeekdayFromUtcMidday(utcMillis: number): number {
  const day = new Date(utcMillis).getUTCDay()
  return day === 0 ? 7 : day
}

/** Date calendaire "YYYY-MM-DD" d'un instant UTC, vue depuis America/Montreal. */
export function dateISOEnMontreal(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montreal',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

/** Déduit une CategoriePoste depuis un intitulé de poste libre (données de démo du prototype,
 * qui ne portent pas de catégorie typée sur `Candidature`). Best-effort, jamais bloquant. */
export function inferCategoriePoste(posteLibre: string): CategoriePoste {
  const texte = posteLibre.toLowerCase()
  if (texte.includes('chauffeur') && texte.includes('classe 1')) return CategoriePoste.CHAUFFEUR_CLASSE_1
  if (texte.includes('chauffeur') && texte.includes('classe 3')) return CategoriePoste.CHAUFFEUR_CLASSE_3
  if (texte.includes('chauffeur') && texte.includes('classe 5')) return CategoriePoste.CHAUFFEUR_CLASSE_5
  if (texte.includes('manutention')) return CategoriePoste.MANUTENTION
  if (texte.includes('entretien')) return CategoriePoste.ENTRETIEN
  return CategoriePoste.AUTRE
}

/** Déduit un `NiveauExperience` depuis un texte libre du type "4 ans en entrepôt…". Retourne
 * `undefined` (champ optionnel) si aucun nombre d'années n'est détecté. */
export function inferNiveauExperience(texteLibre: string): NiveauExperience | undefined {
  const match = texteLibre.match(/(\d+)\s*an/i)
  if (!match) return undefined
  const annees = Number(match[1])
  if (annees < 1) return NiveauExperience.MOINS_1_AN
  if (annees < 3) return NiveauExperience.UN_A_TROIS_ANS
  if (annees < 5) return NiveauExperience.TROIS_A_CINQ_ANS
  return NiveauExperience.PLUS_5_ANS
}
