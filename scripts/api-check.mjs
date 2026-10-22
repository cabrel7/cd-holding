#!/usr/bin/env node
// Vérification API runtime (correctif post-setup, POST_SETUP_PROMPT.md section 4).
// Ne modifie AUCUNE donnée de prod de façon permanente : les ressources créées
// (message de contact, fichier uploadé) sont retournées dans le résumé final
// pour être nettoyées ensuite par scripts/cleanup-test-data.mjs.
//
// Usage :
//   node scripts/api-check.mjs --base http://localhost:3100 [--skip-write] [--json-out <file>]
//
// Mots de passe lus depuis .env (jamais affichés). Aucun secret en dur.
import 'dotenv/config'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
function argValue(name, fallback) {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : fallback
}
const BASE = argValue('--base', 'http://localhost:3100')
const SKIP_WRITE = args.includes('--skip-write')
const JSON_OUT = argValue('--json-out', null)

const creds = {
  SUPER_ADMIN: { email: 'admin@groupecd.ca', password: process.env.SEED_SUPER_ADMIN_PASSWORD },
  ADMIN_FILIALE: { email: 'admin@entretien.groupecd.ca', password: process.env.SEED_ADMIN_FILIALE_PASSWORD },
  EMPLOYE: { email: 'employe@entretien.groupecd.ca', password: process.env.SEED_EMPLOYE_PASSWORD },
}
for (const [role, c] of Object.entries(creds)) {
  if (!c.password) throw new Error(`Mot de passe manquant en .env pour ${role}`)
}

const results = []
function check(name, pass, detail = '') {
  results.push({ name, pass, detail: String(detail).slice(0, 300) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${String(detail).slice(0, 200)}` : ''}`)
}

/** Scan récursif : signale toute clé d'objet égale à "id" ou finissant par "Id" (majuscule),
 * jamais "Uuid"/"uuid". Détecte id/companyId/clientId/employeId/demandeId/userId etc. */
function findForbiddenKeys(value, path = '$') {
  const found = []
  if (Array.isArray(value)) {
    value.forEach((v, i) => found.push(...findForbiddenKeys(v, `${path}[${i}]`)))
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key === 'id' || /Id$/.test(key)) found.push(`${path}.${key}`)
      found.push(...findForbiddenKeys(v, `${path}.${key}`))
    }
  }
  return found
}

function extractCookie(res) {
  const setCookies = res.headers.getSetCookie?.() ?? []
  return setCookies.map((c) => c.split(';')[0]).join('; ')
}

async function login(role) {
  const { email, password } = creds[role]
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const cookie = extractCookie(res)
  const body = await res.json().catch(() => null)
  return { res, cookie, body }
}

async function loginBad(role) {
  const { email } = creds[role]
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'mot-de-passe-incorrect' }),
  })
  const body = await res.json().catch(() => null)
  return { res, body }
}

function headerCounts(url) {
  // fetch/undici fusionne les en-têtes dupliqués avec une virgule — on utilise curl -D
  // pour voir le flux brut et compter les occurrences réelles de chaque en-tête.
  const raw = execSync(`curl -s -D - -o /dev/null "${url}"`, { encoding: 'utf8' })
  const lines = raw.split(/\r?\n/)
  const names = ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy']
  const counts = {}
  for (const name of names) {
    counts[name] = lines.filter((l) => l.toLowerCase().startsWith(`${name}:`)).length
  }
  const referrerLine = lines.find((l) => l.toLowerCase().startsWith('referrer-policy:'))
  return { counts, referrerValue: referrerLine?.split(':').slice(1).join(':').trim() }
}

const createdResources = { messageUuids: [], fileKeys: [] }

async function main() {
  console.log(`\n=== api-check.mjs — BASE=${BASE} SKIP_WRITE=${SKIP_WRITE} ===\n`)

  // --- A.1 : login OK pour les 3 comptes, mauvais mot de passe -> 401 générique ---
  const sessions = {}
  for (const role of Object.keys(creds)) {
    const { res, cookie, body } = await login(role)
    check(`A.1 login ${role} -> 200`, res.status === 200, JSON.stringify(body))
    sessions[role] = cookie
  }
  {
    const { res, body } = await loginBad('ADMIN_FILIALE')
    check(
      'A.1 login mauvais mot de passe -> 401 message générique',
      res.status === 401 && body?.statusMessage === 'Identifiants invalides',
      JSON.stringify(body),
    )
  }
  // Ré-authentifier pour repartir avec un cookie frais après le bad login (au cas où assertRateLimit
  // ou un autre mécanisme aurait invalidé quelque chose) et remettre à zéro le rate-limit.
  {
    const { cookie } = await login('ADMIN_FILIALE')
    sessions.ADMIN_FILIALE = cookie
  }

  // --- A.2 : /api/auth/me ne contient que uuid/nom/role/companyUuid ---
  for (const role of Object.keys(creds)) {
    const res = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: sessions[role] } })
    const body = await res.json().catch(() => null)
    const keys = body ? Object.keys(body).sort() : []
    const expected = ['companyUuid', 'nom', 'role', 'uuid']
    const exact = JSON.stringify(keys) === JSON.stringify(expected)
    const forbidden = findForbiddenKeys(body)
    check(
      `A.2 /api/auth/me ${role} — clés exactes ${expected.join(',')}`,
      exact && forbidden.length === 0,
      `keys=${JSON.stringify(keys)} forbidden=${JSON.stringify(forbidden)}`,
    )
  }

  // --- A.3 : /api/admin/messages — format paginé, scoping, pas de id/companyId/details brut ---
  // Réponse : { items, total, page, pageSize, pageCount } (lot 4) ; `details` n'est jamais renvoyé
  // brut (traduit en `champs`), la filiale est `site` (uuid/slug/nom).
  const isPage = (body) =>
    body && Array.isArray(body.items) && ['total', 'page', 'pageSize', 'pageCount'].every((k) => Number.isInteger(body[k]))
  const hasRawDetails = (body) => Array.isArray(body?.items) && body.items.some((m) => 'details' in m)
  {
    const res = await fetch(`${BASE}/api/admin/messages`, { headers: { cookie: sessions.ADMIN_FILIALE } })
    const body = await res.json().catch(() => null)
    const slugs = isPage(body) ? [...new Set(body.items.map((m) => m.site?.slug))] : null
    const forbidden = findForbiddenKeys(body)
    check(
      'A.3 messages ADMIN_FILIALE (entretien) -> 200 paginé, uniquement entretien, aucun id/companyId/details brut',
      res.status === 200 && isPage(body) && body.items.length > 0 && slugs?.length === 1 && slugs[0] === 'entretien' && forbidden.length === 0 && !hasRawDetails(body),
      `status=${res.status} slugs=${JSON.stringify(slugs)} count=${body?.items?.length} forbidden=${JSON.stringify(forbidden)}`,
    )
  }
  {
    const res = await fetch(`${BASE}/api/admin/messages?site=cdpaa`, { headers: { cookie: sessions.ADMIN_FILIALE } })
    check('A.3 messages ADMIN_FILIALE (entretien) ?site=cdpaa -> 403', res.status === 403, res.status)
  }
  {
    const res = await fetch(`${BASE}/api/admin/messages`, { headers: { cookie: sessions.SUPER_ADMIN } })
    const body = await res.json().catch(() => null)
    const slugs = isPage(body) ? [...new Set(body.items.map((m) => m.site?.slug))].sort() : null
    const forbidden = findForbiddenKeys(body)
    check(
      'A.3 messages SUPER_ADMIN -> 200 paginé, plusieurs sites, aucun id/companyId/details brut',
      res.status === 200 && isPage(body) && body.total >= body.items.length && slugs?.length > 0 && forbidden.length === 0 && !hasRawDetails(body),
      `status=${res.status} slugs=${JSON.stringify(slugs)} total=${body?.total} forbidden=${JSON.stringify(forbidden)}`,
    )
  }
  {
    const res = await fetch(`${BASE}/api/admin/messages?statut=INVALIDE`, { headers: { cookie: sessions.SUPER_ADMIN } })
    check('A.3 messages ?statut=INVALIDE -> 400', res.status === 400, res.status)
  }
  {
    const res = await fetch(`${BASE}/api/admin/messages`, { headers: { cookie: sessions.EMPLOYE } })
    check('A.3 messages EMPLOYE -> 403', res.status === 403, res.status)
  }
  {
    const res = await fetch(`${BASE}/api/admin/messages`)
    check('A.3 messages sans session -> 401', res.status === 401, res.status)
  }

  // --- A.4 : upload / lecture fichier ---
  if (!SKIP_WRITE) {
    const assetsDir = argValue('--assets-dir', null)
    if (!assetsDir) {
      check('A.4 upload — --assets-dir manquant', false, 'fournir --assets-dir <dossier avec valid.png et fake.png>')
    } else {
      const validPngPath = join(assetsDir, 'valid.png')
      const fakePngPath = join(assetsDir, 'fake.png')
      const validBytes = readFileSync(validPngPath)
      const fakeBytes = readFileSync(fakePngPath)

      // Upload valide en ADMIN_FILIALE
      {
        const form = new FormData()
        form.set('visibilite', 'PRIVE')
        form.set('file', new Blob([validBytes], { type: 'image/png' }), 'photo.png')
        const res = await fetch(`${BASE}/api/admin/files`, { method: 'POST', headers: { cookie: sessions.ADMIN_FILIALE }, body: form })
        const body = await res.json().catch(() => null)
        const forbidden = findForbiddenKeys(body)
        check(
          'A.4 upload PNG valide ADMIN_FILIALE -> 200/201 sans id interne',
          (res.status === 200 || res.status === 201) && body?.key && forbidden.length === 0,
          JSON.stringify(body),
        )
        if (body?.key) {
          createdResources.fileKeys.push(body.key)

          const noSession = await fetch(`${BASE}/api/files/${body.key}`)
          check('A.4 GET /api/files/<key> sans session -> 401', noSession.status === 401, noSession.status)

          const withSession = await fetch(`${BASE}/api/files/${body.key}`, { headers: { cookie: sessions.ADMIN_FILIALE } })
          const withSessionBytes = Buffer.from(await withSession.arrayBuffer())
          check(
            'A.4 GET /api/files/<key> avec session -> 200, contenu identique',
            withSession.status === 200 && withSessionBytes.equals(validBytes),
            `status=${withSession.status} bytesEqual=${withSessionBytes.equals(validBytes)}`,
          )
        }
      }

      // Faux PNG -> 415
      {
        const form = new FormData()
        form.set('visibilite', 'PRIVE')
        form.set('file', new Blob([fakeBytes], { type: 'image/png' }), 'fake.png')
        const res = await fetch(`${BASE}/api/admin/files`, { method: 'POST', headers: { cookie: sessions.ADMIN_FILIALE }, body: form })
        check('A.4 upload faux PNG -> 415', res.status === 415, res.status)
      }

      // Clé invalide -> 400
      {
        const res = await fetch(`${BASE}/api/files/not-a-valid-key`, { headers: { cookie: sessions.ADMIN_FILIALE } })
        check('A.4 GET /api/files/<clé invalide> -> 400', res.status === 400, res.status)
      }
    }
  } else {
    check('A.4 upload/fichiers — SKIP', true, 'skip-write actif')
  }

  // --- A.5 : contact public (spec docs/specs/phase3-holding-contact.md §3.2 — union
  // discriminée sur `formulaire`, cible = un SiteSlug réel) ---
  if (!SKIP_WRITE) {
    const res = await fetch(`${BASE}/api/public/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        formulaire: 'holding',
        cible: 'entretien',
        nom: 'Test Runtime Check',
        email: 'test-runtime-check@example.com',
        message: 'Message de test automatisé — à nettoyer après vérification runtime.',
      }),
    })
    const body = await res.json().catch(() => null)
    check('A.5 contact public payload valide -> 201', res.status === 201, JSON.stringify(body))

    const badRes = await fetch(`${BASE}/api/public/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ formulaire: 'holding', cible: 'entretien', nom: 'x' }),
    })
    check('A.5 contact public payload invalide -> 400', badRes.status === 400, badRes.status)

    // Ancien contrat (client-controlled `sujet`) : rejeté par `.strict()` (DEC-12/13/15).
    const legacyRes = await fetch(`${BASE}/api/public/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        formulaire: 'holding',
        cible: 'entretien',
        nom: 'Test Runtime Check',
        email: 'test-runtime-check@example.com',
        message: 'Message de test automatisé — à nettoyer après vérification runtime.',
        sujet: 'Sujet imposé par le client',
      }),
    })
    check('A.5 contact public clé "sujet" (contrat legacy) -> 400', legacyRes.status === 400, legacyRes.status)
  } else {
    check('A.5 contact public — SKIP', true, 'skip-write actif')
  }

  // --- A.6 : en-têtes de sécurité, une seule occurrence chacun ---
  {
    const { counts, referrerValue } = headerCounts(`${BASE}/`)
    for (const [name, count] of Object.entries(counts)) {
      check(`A.6 header ${name} présent une fois`, count === 1, `count=${count}`)
    }
    check(
      'A.6 referrer-policy = strict-origin-when-cross-origin',
      referrerValue === 'strict-origin-when-cross-origin',
      referrerValue,
    )
  }

  console.log('\n=== Résumé ===')
  const fails = results.filter((r) => !r.pass)
  console.log(`${results.length - fails.length}/${results.length} PASS`)
  if (fails.length) {
    console.log('FAILS:')
    fails.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`))
  }

  if (JSON_OUT) {
    const fs = await import('node:fs')
    fs.writeFileSync(JSON_OUT, JSON.stringify({ results, createdResources }, null, 2))
  }
  console.log('\nRessources créées (à nettoyer avec scripts/cleanup-test-data.mjs) :')
  console.log(JSON.stringify(createdResources, null, 2))

  process.exit(fails.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('ERREUR FATALE api-check.mjs:', err)
  process.exit(2)
})
