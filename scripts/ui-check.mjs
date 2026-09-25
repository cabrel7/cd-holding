// Vérif UI du scaffold (checklist étape 16) : garde /admin, login, Button stylé.
// Usage : node scripts/ui-check.mjs  (serveur dev lancé, .env chargé)
import 'dotenv/config'
import { chromium } from '@playwright/test'

const BASE = process.env.UI_CHECK_BASE_URL ?? 'http://localhost:3100'
const OUT = process.env.UI_CHECK_OUT_DIR ?? '.'
const NAV_TIMEOUT_MS = 120_000

const password = process.env.SEED_ADMIN_FILIALE_PASSWORD
if (!password) throw new Error('SEED_ADMIN_FILIALE_PASSWORD manquant')

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(NAV_TIMEOUT_MS)
const results = []
const check = (name, pass, detail = '') => results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)

// Diagnostic runtime (utile en prod : CSP `upgrade-insecure-requests` + cookie `Secure`
// peuvent casser silencieusement le login/les assets sur http://localhost) — n'échoue
// aucun check à lui seul, mais est reporté dans la sortie pour investigation.
const consoleEvents = []
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') consoleEvents.push(`console.${msg.type()}: ${msg.text()}`)
})
page.on('pageerror', (err) => consoleEvents.push(`pageerror: ${err.message}`))
page.on('requestfailed', (req) => consoleEvents.push(`requestfailed: ${req.method()} ${req.url()} — ${req.failure()?.errorText}`))

try {
  await page.goto(`${BASE}/admin`)
  await page.waitForURL(/\/admin\/login/)
  check('/admin sans session -> /admin/login', page.url().includes('/admin/login'), page.url())

  const submit = page.getByRole('button', { name: 'Se connecter' })
  const styles = await submit.evaluate((el) => {
    const s = getComputedStyle(el)
    return { bg: s.backgroundColor, radius: s.borderRadius, height: s.height }
  })
  const styled = styles.bg !== 'rgba(0, 0, 0, 0)' && styles.radius !== '0px'
  check('Button shadcn stylé', styled, JSON.stringify(styles))

  await submit.click()
  const errVisible = await page.getByText('Email requis').waitFor({ timeout: 10_000 }).then(() => true, () => false)
  check('validation client VeeValidate+zod', errVisible)

  await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe')
  await page.getByLabel('Email').fill('admin@entretien.groupecd.ca')
  await submit.click()
  const toastErr = await page.getByText('Identifiants invalides.').waitFor({ timeout: 15_000 }).then(() => true, () => false)
  check('toast erreur login', toastErr)

  await page.getByLabel('Mot de passe').fill(password)
  await submit.click()
  await page.waitForURL(`${BASE}/admin`)
  await page.getByRole('heading', { name: 'Tableau de bord' }).waitFor()
  check('login -> /admin', true)
  await page.screenshot({ path: `${OUT}/admin-dashboard.png` })

  await page.getByRole('button', { name: 'Déconnexion' }).click()
  await page.waitForURL(/\/admin\/login/)
  check('logout -> /admin/login', true)
  await page.screenshot({ path: `${OUT}/admin-login.png` })
} catch (error) {
  check('parcours', false, error instanceof Error ? error.message.split('\n')[0] : String(error))
} finally {
  await browser.close()
  console.info(results.join('\n'))
  if (consoleEvents.length) {
    console.info('\n--- Diagnostic navigateur (console/pageerror/requestfailed) ---')
    console.info(consoleEvents.join('\n'))
  }
}
