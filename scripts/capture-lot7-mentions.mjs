// Captures du lot 7 — `/boissons/mentions-legales` (page + mention alcool au pied de page)
// aux 3 largeurs (375/768/1440). Page publique : ni login ni données de test à purger.
// Pas de vidéo (aucune chorégraphie — spec lot 7).
// Usage : node scripts/capture-lot7-mentions.mjs   (build de production sur :3200)
import 'dotenv/config'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3200'
const OUT = 'conversion-captures/lot7-nuxt'
const BINARY = process.env.PW_CHROMIUM_PATH || '/opt/brave.com/brave/brave'

const VIEWPORTS = [
  { name: 375, width: 375, height: 812 },
  { name: 768, width: 768, height: 1024 },
  { name: 1440, width: 1440, height: 900 },
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: BINARY, args: ['--no-sandbox'] })

/** Défilement pas à poser sur toute la hauteur puis retour en haut (critère CLAUDE.md). */
async function derouler(page, hauteurVue) {
  const hauteur = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < hauteur; y += Math.round(hauteurVue / 2)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
    await page.waitForTimeout(160)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
}

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  const page = await context.newPage()
  const reponse = await page.goto(`${BASE}/boissons/mentions-legales`, { waitUntil: 'networkidle' })
  if (!reponse || reponse.status() !== 200) throw new Error(`HTTP ${reponse?.status()} sur /boissons/mentions-legales`)
  await derouler(page, viewport.height)
  const fichier = join(OUT, `mentions-legales-${viewport.name}.png`)
  await page.screenshot({ path: fichier, fullPage: true })
  console.log(`OK ${fichier}`)
  await context.close()
}

await browser.close()
console.log('Captures lot 7 terminées')
