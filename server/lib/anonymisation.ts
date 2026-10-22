// Loi 25 (lot 5) — règles d'échéance et opérations d'anonymisation (aucune référence à H3).
// Fonctions pures (`ajouterMois`, `echanceAnonymisation`, `echeanceVivier`) : source unique des
// trois horloges de conservation (LOI25_DUREES, shared/config/candidature.ts), testées sans Nitro
// (tests/unit/anonymisation.test.ts). Opérations DB (`anonymiserCandidatureParId`,
// `anonymiserCandidatParId`, `rechercherAnonymisables`) : appelées par la route admin
// « Supprimer maintenant » (via le service placement) et par la tâche planifiée, jamais avec un
// `event` de session.
//
// Ordre imposé par la contrainte FK `Candidature.cv -> Fichier` (onDelete: Restrict) : on détache
// d'abord `cvKey` (update), puis on supprime les Fichiers — l'inverse ferait échouer en silence la
// suppression des lignes `Fichier` (voir `supprimerFichiers`, qui journalise sans relancer).
import type { StatutCandidature } from '../generated/prisma/client'
import { LOI25_DUREES } from '#shared/config/candidature'
import { supprimerFichiers } from '../utils/storage'

export interface CandidatureHorloges {
  readonly anonymiseLe: Date | null
  readonly statut: StatutCandidature
  readonly rejeteLe: Date | null
  readonly dateEnvoi: Date
}

export interface CandidatHorloges {
  readonly anonymiseLe: Date | null
  readonly consentementRenouveleLe: Date | null
  readonly createdAt: Date
}

export interface Anonymisables {
  readonly candidatureIds: readonly number[]
  readonly candidatIds: readonly number[]
}

/**
 * Ajoute `mois` mois (positif ou négatif) sans glisser de mois pour les 30/31 : si le jour
 * n'existe pas au mois cible, on prend le dernier jour de ce mois. Heure murale UTC conservée
 * (les bornes de comparaison restent exactes au fil du temps).
 */
export function ajouterMois(date: Date, mois: number): Date {
  const jour = date.getUTCDate()
  const cible = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + mois, 1))
  const dernierJourDuMois = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate()
  cible.setUTCDate(Math.min(jour, dernierJourDuMois))
  cible.setUTCHours(date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds())
  return cible
}

/**
 * Échéance d'anonymisation d'une candidature (null = jamais anonymisée par la tâche) :
 * déjà anonymisée → null ; RETENUE → null (bascule en vivier = décision humaine) ;
 * REJETEE avec `rejeteLe` → rejet + 6 mois ; sinon (NOUVELLE/EN_REVISION, ou REJETEE sans
 * `rejeteLe`) → date d'envoi + 6 mois.
 */
export function echanceAnonymisation(c: CandidatureHorloges): Date | null {
  if (c.anonymiseLe !== null) return null
  if (c.statut === 'RETENUE') return null
  if (c.statut === 'REJETEE' && c.rejeteLe !== null) return ajouterMois(c.rejeteLe, LOI25_DUREES.rejetMois)
  return ajouterMois(c.dateEnvoi, LOI25_DUREES.nonTraiteeMois)
}

/**
 * Échéance du vivier (null = déjà anonymisé) : base = COALESCE(consentementRenouveleLe, createdAt)
 * + 12 mois. Le renouvellement de consentement repousse l'échéance d'un cycle complet.
 */
export function echeanceVivier(c: CandidatHorloges): Date | null {
  if (c.anonymiseLe !== null) return null
  return ajouterMois(c.consentementRenouveleLe ?? c.createdAt, LOI25_DUREES.vivierMois)
}

/** Anonymise une candidature par son id interne (déjà résolu et scopé par l'appelant). */
export async function anonymiserCandidatureParId(candidatureId: number): Promise<void> {
  const row = await prisma.candidature.findUnique({
    where: { id: candidatureId },
    select: { id: true, cvKey: true, autresDocumentsKeys: true, anonymiseLe: true },
  })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  if (row.anonymiseLe !== null) throw createError({ statusCode: 409, statusMessage: 'Déjà anonymisée' })

  const keys = [row.cvKey, ...row.autresDocumentsKeys].filter((cle): cle is string => cle !== null)

  await prisma.candidature.update({
    where: { id: row.id },
    data: {
      nomComplet: null,
      email: null,
      telephone: null,
      adresseComplete: null,
      posteAutrePrecision: null,
      message: null,
      cvKey: null,
      autresDocumentsKeys: [],
      anonymiseLe: new Date(),
    },
  })
  await supprimerFichiers(keys)
}

/** Anonymise un candidat du vivier par son id interne (déjà résolu et scopé par l'appelant). */
export async function anonymiserCandidatParId(candidatId: number): Promise<void> {
  const row = await prisma.candidat.findUnique({
    where: { id: candidatId },
    select: { id: true, cvKey: true, anonymiseLe: true },
  })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  if (row.anonymiseLe !== null) throw createError({ statusCode: 409, statusMessage: 'Déjà anonymisé' })

  await prisma.candidat.update({
    where: { id: row.id },
    data: {
      nomComplet: null,
      email: null,
      telephone: null,
      posteRecherche: null,
      disponibilite: null,
      notes: null,
      cvKey: null,
      anonymiseLe: new Date(),
    },
  })
  if (row.cvKey !== null) await supprimerFichiers([row.cvKey])
}

/**
 * Sélectionne les lignes échues (toutes filiales confondues : la tâche est globale, le scoping
 * `companyId` n'a de sens que côté admin). Trois horloges Loi 25 en une passe. Les bornes sont
 * calculées avec `ajouterMois` (même règle que les fonctions pures, testées).
 */
export async function rechercherAnonymisables(maintenant: Date = new Date()): Promise<Anonymisables> {
  const borneRejet = ajouterMois(maintenant, -LOI25_DUREES.rejetMois)
  const borneNonTraitee = ajouterMois(maintenant, -LOI25_DUREES.nonTraiteeMois)
  const borneVivier = ajouterMois(maintenant, -LOI25_DUREES.vivierMois)

  const [rejetees, nonTraitees, vivier] = await Promise.all([
    prisma.candidature.findMany({
      where: { statut: 'REJETEE', anonymiseLe: null, rejeteLe: { not: null, lte: borneRejet } },
      select: { id: true },
    }),
    prisma.candidature.findMany({
      where: { statut: { in: ['NOUVELLE', 'EN_REVISION'] }, anonymiseLe: null, dateEnvoi: { lte: borneNonTraitee } },
      select: { id: true },
    }),
    prisma.candidat.findMany({
      where: {
        anonymiseLe: null,
        OR: [
          { consentementRenouveleLe: { lte: borneVivier } },
          { consentementRenouveleLe: null, createdAt: { lte: borneVivier } },
        ],
      },
      select: { id: true },
    }),
  ])

  const candidatureIds = new Set<number>()
  for (const row of rejetees) candidatureIds.add(row.id)
  for (const row of nonTraitees) candidatureIds.add(row.id)
  return { candidatureIds: [...candidatureIds], candidatIds: vivier.map((row) => row.id) }
}
