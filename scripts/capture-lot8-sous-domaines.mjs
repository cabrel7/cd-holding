// Captures du lot 8 — sous-domaines : `entretien.localhost` (accueil + services, chemins nus)
// et `admin.localhost` nu (écran de connexion) aux 3 largeurs (375/768/1440).
// `*.localhost` résout vers 127.0.0.1 dans Chromium/Brave — aucun DNS ni hôte de prod requis.
// Pas de vidéo (aucune chorégraphie nouvelle — spec lot 8).
// Usage : node scripts/capture-lot8-sous-domaines.mjs   (build de production sur :3200)
import 'dotenv/config'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const BASE_PORT = 3200
const OUT = 'conversion-captures/lot8-nuxt'
const BINARY = process.env.PW_CHROMIUM_PATH || '/opt/brave.com/brave/brave'

const CIBLES = [
  { nom: 'entretien-accueil', url: `http://entretien.localhost:${BASE_PORT}/` },
  { nom: 'entretien-services', url: `http://entretien.localhost:${BASE_PORT}/services` },
  { nom: 'admin-login-nu', url: `http://admin.localhost:${BASE_PORT}/login` },
]

const VIEWPORTS = [
  { name: 375, width: 375, height: 812 },
  { name: 768, width: 768, height: 1024 },
  { name: 1440, width: 1440, height: 900 },
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: BINARY, args: ['--no-sandbox'] })

/** Défilement pas à pas sur toute la hauteur puis retour en haut (critère CLAUDE.md). */
async function derouler(page, hauteurVue) {
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < hauteur; y += Math.round(hauteurVue / 2)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
    await page.waitForTimeout(160)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
}

for (const cible of CIBLES) {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
    const page = await context.newPage()
    const reponse = await page.goto(cible.url, { waitUntil: 'networkidle' })
    if (!reponse || reponse.status() !== 200) {
      throw new Error(`HTTP ${reponse?.status()} sur ${cible.url}`)
    }
    await derouler(page, viewport.height)
    const fichier = join(OUT, `${cible.nom}-${viewport.name}.png`)
    await page.screenshot({ path: fichier, fullPage: true })
    console.log(`OK ${fichier}`)
    await context.close()
  }
}

await browser.close()
console.log('Captures lot 8 terminées')
