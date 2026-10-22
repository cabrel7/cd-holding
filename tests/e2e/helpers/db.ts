// Accès aux données de test via scripts/cleanup-test-data.ts (même client Prisma que le serveur).
// Le binaire tsx est appelé directement (pas `pnpm exec`) : un démarrage pnpm coûte ~6 s de plus
// sur la machine d'exécution. Ne lit ni n'écrit jamais .env (chargé par dotenv dans le script).
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const TSX_TIMEOUT_MS = 180_000

function runScript(args: readonly string[]): string {
  return execFileSync(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['scripts/cleanup-test-data.ts', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: TSX_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
}

function extraire(sortie: string, prefixe: string): string {
  const ligne = sortie.split('\n').find((l) => l.startsWith(prefixe))
  if (!ligne) throw new Error(`Sortie inattendue du script (préfixe ${prefixe} absent)`)
  return ligne.slice(prefixe.length).trim()
}

export interface CandidatureInspectee {
  readonly posteRecherche: string
  readonly posteAutrePrecision: string | null
  readonly categorie: string
  readonly consentementLe: string | null
  readonly statut: string
  readonly pays: string
  readonly cvKey: string
  readonly autresDocumentsKeys: string[]
  readonly demande: { readonly uuid: string } | null
  readonly cv: { readonly visibilite: string; readonly mimeType: string; readonly nomOriginal: string; readonly company: { readonly slug: string } | null }
}

export interface ReservationInspectee {
  readonly uuid: string
  readonly nombrePersonnes: number
  readonly dateReservation: string
  readonly statut: string
  readonly notes: string | null
}

export const creerOffreTest = (titre: string): string => extraire(runScript(['--creer-offre', titre]), 'OFFRE_UUID=')
export const retirerOffreTest = (uuid: string): void => void runScript(['--retirer-offre', uuid])
export const supprimerOffreTest = (titre: string): void => void runScript(['--offre-titre', titre])
export const compterFichiersPlacement = (): number => Number(extraire(runScript(['--count-fichiers-placement']), 'COUNT_FICHIERS='))
export const semerPlacement = (marker: string): void => void runScript(['--seed-placement', marker])
export const purgerPlacement = (marker: string): void => void runScript(['--purge-placement', marker])
export const semerReservations = (marker: string): void => void runScript(['--seed-reservations', marker])
export const purgerReservations = (marker: string): void => void runScript(['--purge-reservations', marker])
export const compterReservations = (suffixe: string): number =>
  Number(extraire(runScript(['--count-reservations', suffixe]), 'COUNT_RESERVATIONS='))
export const semerPlanning = (marker: string): void => void runScript(['--seed-planning', marker])
export const purgerPlanning = (marker: string): void => void runScript(['--purge-planning', marker])
export const compterPlanning = (marker: string): { readonly employes: number; readonly quarts: number } => {
  const brut = extraire(runScript(['--count-planning', marker]), 'COUNT_PLANNING=')
  const [employes, quarts] = brut.split(',').map((partie) => Number(partie.slice(partie.indexOf(':') + 1)))
  return { employes: employes!, quarts: quarts! }
}
export const inspecterCandidature = (email: string): CandidatureInspectee[] =>
  JSON.parse(extraire(runScript(['--inspect-candidature-email', email]), 'INSPECT_JSON=')) as CandidatureInspectee[]
export const inspecterReservations = (email: string): ReservationInspectee[] =>
  JSON.parse(extraire(runScript(['--inspect-reservation-email', email]), 'INSPECT_JSON=')) as ReservationInspectee[]
// Lot 5 paramètres : compte EMPLOYE dédié `parametres-<m>@example.test`, seul compte MUTÉ par
// la suite. Le mot de passe est GÉNÉRÉ côté script (jamais écrit en dur) et remonté ici via
// l'impression `MDP_E2E=` — à suivre dans la variable d'enchaînement du spec.
export const semerCompteMdp = (marker: string): string => extraire(runScript(['--seed-compte-mdp', marker]), 'MDP_E2E=')
export const purgerCompteMdp = (marker: string): void => void runScript(['--purge-compte-mdp', marker])
// Lot 6 utilisateurs : 3 comptes dédiés `comptes-{emp,af,sa}-<m>@example.test`, SEULS mutés
// par la suite (rôle, actif, mot de passe) — jamais `admin@groupecd.ca` ni les comptes seedés
// partagés. Mots de passe GÉNÉRÉS côté script, remontés en JSON via `COMPTES_MDP_JSON=`.
export interface CompteE2E {
  readonly email: string
  readonly motDePasse: string
}
export interface ComptesSemes {
  readonly emp: CompteE2E
  readonly af: CompteE2E
  readonly sa: CompteE2E
}
export const semerComptes = (marker: string): ComptesSemes =>
  JSON.parse(extraire(runScript(['--seed-comptes', marker]), 'COMPTES_MDP_JSON=')) as ComptesSemes
export const purgerComptes = (marker: string): void => void runScript(['--purge-comptes', marker])
export const purgerCompte = (email: string): void => void runScript(['--purge-compte', email])

export function nettoyer(options: {
  candidatureEmails?: readonly string[]
  reservationEmails?: readonly string[]
  contactEmails?: readonly string[]
  offreTitres?: readonly string[]
}): void {
  const args = [
    ...(options.candidatureEmails ?? []).flatMap((e) => ['--candidature-email', e]),
    ...(options.reservationEmails ?? []).flatMap((e) => ['--reservation-email', e]),
    ...(options.contactEmails ?? []).flatMap((e) => ['--contact-email', e]),
    ...(options.offreTitres ?? []).flatMap((t) => ['--offre-titre', t]),
  ]
  if (args.length === 0) return
  runScript(args)
}
