// Captures du lot 6 — `/admin/utilisateurs` : liste aux 3 largeurs (375/768/1440, défilement
// pas à poser) + dialog « Nouveau compte » (formulaire rempli, soumis une fois) + dialog
// « Mot de passe temporaire » (il n'existe qu'après un 201, D14). Pas de vidéo (spec lot 6
// §9 : aucun enchaînement chorégraphié nouveau au-delà des dialogs/toasts déjà filmés lot 5).
// Chaque viewport crée un compte de capture `comptes-capture-*`, purgé en fin de script via
// `cleanup-test-data.ts --purge-compte` — aucun compte seed n'est touché.
// Usage : node scripts/capture-lot6-utilisateurs.mjs   (build de production sur :3200)
import 'dotenv/config'
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3200'
const OUT = 'conversion-captures/lot6-nuxt'
const BINARY = process.env.PW_CHROMIUM_PATH || '/opt/brave.com/brave/brave'
const EMAIL = 'admin@groupecd.ca'
const PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD

if (!PASSWORD) throw new Error('SEED_SUPER_ADMIN_PASSWORD manquant')

const VIEWPORTS = [
  { name: 375, width: 375, height: 812 },
  { name: 768, width: 768, height: 1024 },
  { name: 1440, width: 1440, height: 900 },
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: BINARY, args: ['--no-sandbox'] })
const emailsCrees = []

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
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  // IP TEST-NET fraîche par viewport : la création porte le scope `admin-comptes`
  // (10 / 15 min / IP + utilisateur) — ne jamais reposer la quota sur la loopback partagée.
  const ip = `203.0.113.${1 + Math.floor(Math.random() * 253)}`
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': ip })
  const connexion = await context.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } })
  if (!connexion.ok()) throw new Error(`login impossible (${connexion.status()})`)

  const page = await context.newPage()
  await page.goto(`${BASE}/admin/utilisateurs`)
  await page.getByRole('heading', { level: 1, name: 'Utilisateurs' }).waitFor({ timeout: 30_000 })
  await derouler(page, viewport.height)
  await page.screenshot({ path: `${OUT}/utilisateurs-${viewport.name}-liste.png`, fullPage: true })

  // Dialog « Nouveau compte » rempli (non soumis à ce stade : zéro écriture).
  const sites = await (await context.request.get(`${BASE}/api/admin/sites`)).json()
  const transport = sites.find((s) => s.slug === 'transport')
  if (!transport) throw new Error('filiale transport introuvable')
  const libelleTransport = transport.nomCourt ?? transport.nom
  const emailCapture = `comptes-capture-${viewport.name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`

  await page.getByRole('button', { name: 'Nouveau compte', exact: true }).click()
  const creation = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: 'Nouveau compte', exact: true }) })
  await creation.waitFor({ timeout: 15_000 })
  await page.getByLabel(/^Nom/).fill(`Compte Capture ${viewport.name}`)
  await page.getByLabel(/^Courriel/).fill(emailCapture)
  await creation.getByRole('combobox', { name: 'Filiale' }).click()
  await page.getByRole('option', { name: libelleTransport, exact: true }).click()
  await page.waitForTimeout(400)
  // Dialog fixe : capture en fenêtre, `fullPage` décalerait l'overlay.
  await page.screenshot({ path: `${OUT}/utilisateurs-${viewport.name}-creation.png` })

  // 201 → le dialog mdp temporaire s'ouvre (affiché une seule fois, D14).
  await creation.getByRole('button', { name: 'Enregistrer' }).click()
  const temp = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: 'Mot de passe temporaire', exact: true }) })
  await temp.waitFor({ timeout: 15_000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/utilisateurs-${viewport.name}-mot-de-passe-temporaire.png` })
  emailsCrees.push(emailCapture)

  await context.close()
  console.log(`captures ${viewport.name}px : OK`)
}

await browser.close()

// Purge des comptes de capture (deleteMany idempotent, aucun seed touché).
for (const email of emailsCrees) {
  execFileSync(join(process.cwd(), 'node_modules', '.bin', 'tsx'), ['scripts/cleanup-test-data.ts', '--purge-compte', email], {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'inherit'],
    timeout: 120_000,
  })
}
console.log(`purge comptes de capture : ${emailsCrees.length}`)
