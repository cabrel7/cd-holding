// Données de test du lot 4 (admin messages / clients), créées et purgées via
// scripts/cleanup-test-data.ts (même client Prisma que le serveur ; pattern de helpers/db.ts).
// Toute ligne créée porte un e-mail `…-<marqueur>@example.test` : la purge par marqueur supprime
// messages ET clients (dossiers comptables en cascade), y compris ceux créés par les tests.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const TSX_TIMEOUT_MS = 180_000
const MARQUEUR_BASE = 36

export const NOMBRE_MESSAGES_PAGINATION = 25
export const TAILLE_PAGE = 20

function runScript(args: readonly string[]): void {
  execFileSync(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['scripts/cleanup-test-data.ts', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: TSX_TIMEOUT_MS,
    stdio: ['ignore', 'ignore', 'inherit'],
  })
}

/** Marqueur unique, minuscule, sans caractère spécial (les e-mails de conversion sont en minuscules). */
export function nouveauMarqueur(prefixe: string): string {
  return `${prefixe}${Date.now().toString(MARQUEUR_BASE)}${Math.random().toString(MARQUEUR_BASE).slice(2, 6)}`
}

export function emailTest(label: string, marqueur: string): string {
  return `${label}-${marqueur}@example.test`
}

export const semerMessagesAdmin = (marqueur: string): void => runScript(['--seed-admin-messages', marqueur])
export const semerDossier = (email: string): void => runScript(['--seed-dossier', email])
export const purgerDonneesAdmin = (marqueur: string): void => runScript(['--purge-admin-data', marqueur])
