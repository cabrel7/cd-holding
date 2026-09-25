// Aide d'authentification e2e (spec phase 2 §4.8) : connexion par l'API (`POST /api/auth/login`)
// plutôt que par le formulaire, pour ne pas coupler chaque test au détail du composant de
// connexion. Les mots de passe viennent de `.env` (lus par `dotenv/config` dans
// playwright.config.ts) — JAMAIS écrits en dur ni journalisés ici.
import type { BrowserContext } from '@playwright/test'

export interface AdminAccount {
  readonly email: string
  readonly password: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Variable d'environnement ${name} manquante — voir .env.example (chargée via dotenv dans playwright.config.ts).`)
  }
  return value
}

// SUPER_ADMIN : toujours seedé. ADMIN_FILIALE (entretien) et EMPLOYE (entretien, Awa Diallo) :
// seedés uniquement si SEED_DEMO_DATA=true (prisma/seed/accounts.ts) — l'exécution e2e du §4.9
// exige `SEED_DEMO_DATA=true pnpm db:seed`, donc les trois comptes sont supposés présents.
export const SUPER_ADMIN: AdminAccount = {
  email: 'admin@groupecd.ca',
  get password() {
    return requireEnv('SEED_SUPER_ADMIN_PASSWORD')
  },
}

export const ADMIN_FILIALE_ENTRETIEN: AdminAccount = {
  email: 'admin@entretien.groupecd.ca',
  get password() {
    return requireEnv('SEED_ADMIN_FILIALE_PASSWORD')
  },
}

export const EMPLOYE_ENTRETIEN: AdminAccount = {
  email: 'employe@entretien.groupecd.ca',
  get password() {
    return requireEnv('SEED_EMPLOYE_PASSWORD')
  },
}

/**
 * Connecte un contexte de navigateur donné (pose le cookie de session, partagé ensuite par
 * `context.request` ET par toute page créée depuis ce contexte). Ne journalise jamais le mot
 * de passe : seul le statut HTTP apparaît en cas d'échec.
 */
export async function loginAs(context: BrowserContext, account: AdminAccount): Promise<void> {
  const response = await context.request.post('/api/auth/login', {
    data: { email: account.email, password: account.password },
  })
  if (!response.ok()) {
    throw new Error(`Connexion admin échouée (${response.status()}) pour ${account.email}`)
  }
}
