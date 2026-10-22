// Captures du sous-lot 5 — `/admin/parametres` : page + dialog aux 3 largeurs (375/768/1440),
// puis vidéo courte de la chorégraphie du dialog (erreur sous le champ → succès → fermeture).
// Usage : node scripts/capture-lot5-parametres.mjs   (build de production sur :3200)
// Sortie : conversion-captures/lot5-nuxt/  (+ /tmp/opencode/lot5-video/ pour l'enregistrement brut)
import 'dotenv/config'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3200'
const OUT = 'conversion-captures/lot5-nuxt'
const BINARY = process.env.PW_CHROMIUM_PATH || '/opt/brave.com/brave/brave'
const VIDEO_DIR = process.env.CAPTURE_VIDEO_DIR || '/tmp/opencode/lot5-video'

const EMAIL = 'admin@groupecd.ca'
const PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD
// Compte dédié du lot 5 (scripts/cleanup-test-data.ts --seed-compte-mdp) : seul compte dont le
// changement de mot de passe est sans effet sur le reste du dépôt. `MDP_E2E` remonté en stdout.
const EMAIL_MDP = process.env.CAPTURE_MDP_EMAIL
const PASSWORD_MDP = process.env.CAPTURE_MDP_PASSWORD

if (!PASSWORD) throw new Error('SEED_SUPER_ADMIN_PASSWORD manquant')

const VIEWPORTS = [
  { name: 375, width: 375, height: 812 },
  { name: 768, width: 768, height: 1024 },
  { name: 1440, width: 1440, height: 900 },
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: BINARY, args: ['--no-sandbox'] })

async function nouvelleSession(viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  return context
}

async function connexionApi(context, email, password) {
  const reponse = await context.request.post(`${BASE}/api/auth/login`, { data: { email, password } })
  if (!reponse.ok()) throw new Error(`login impossible (${reponse.status()})`)
}

/** Défilement pas à poser sur toute la hauteur puis retour en haut (critère CLAUDE.md). */
async function derouler(page, hauteurVue) {
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < hauteur; y += Math.round(hauteurVue / 2)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
    await page.waitForTimeout(180)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
}

for (const viewport of VIEWPORTS) {
  const context = await nouvelleSession(viewport)
  await connexionApi(context, EMAIL, PASSWORD)
  const page = await context.newPage()
  await page.goto(`${BASE}/admin/parametres`)
  await page.getByText('Filiale rattachée', { exact: true }).waitFor({ timeout: 30_000 })
  await derouler(page, viewport.height)
  await page.screenshot({ path: `${OUT}/parametres-${viewport.name}-liste.png`, fullPage: true })

  await page.getByRole('button', { name: 'Changer le mot de passe' }).click()
  await page.getByLabel('Mot de passe actuel', { exact: true }).waitFor({ timeout: 15_000 })
  await page.waitForTimeout(500)
  // Dialog fixe : capture en fenêtre, `fullPage` décalerait l'overlay.
  await page.screenshot({ path: `${OUT}/parametres-${viewport.name}-dialog.png` })
  await context.close()
  console.log(`captures ${viewport.name}px : OK`)
}

// --- Vidéo courte : dialog du lot (erreur champ → succès → fermeture) sur compte dédié ---
if (EMAIL_MDP && PASSWORD_MDP) {
  await mkdir(VIDEO_DIR, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  })
  await connexionApi(context, EMAIL_MDP, PASSWORD_MDP)
  const page = await context.newPage()
  await page.goto(`${BASE}/admin/parametres`)
  await page.getByText('Filiale rattachée', { exact: true }).waitFor({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Changer le mot de passe' }).click()
  await page.getByLabel('Mot de passe actuel', { exact: true }).waitFor({ timeout: 15_000 })
  // 1. erreur sous le champ (mot de passe actuel faux) — la fermeture est refusée.
  await page.getByLabel('Mot de passe actuel', { exact: true }).fill('MauvaisMotDePasse123')
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('NouveauMotDePasse456')
  await page.getByLabel('Confirmer le nouveau mot de passe', { exact: true }).fill('NouveauMotDePasse456')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByText('Mot de passe actuel incorrect', { exact: true }).waitFor({ timeout: 15_000 })
  await page.waitForTimeout(700)
  // 2. succès : toast exact + fermeture du dialog, session conservée.
  await page.getByLabel('Mot de passe actuel', { exact: true }).fill(PASSWORD_MDP)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByText('Mot de passe modifié.', { exact: true }).waitFor({ timeout: 15_000 })
  await page.waitForTimeout(1200)

  const video = await page.video()?.path()
  await context.close()
  console.log(`VIDEO_BRUTE=${video ?? ''}`)
} else {
  console.log('CAPTURE_MDP_EMAIL/CAPTURE_MDP_PASSWORD absents : vidéo non filmée')
}

await browser.close()
