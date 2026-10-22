#!/usr/bin/env tsx
// Générateur ponctuel, supprimable (spec phase 2 §3). Produit des fichiers VERSIONNÉS :
//   - prisma/seed-data/prototype.generated.ts (données typées, idempotent)
//   - prisma/seed-assets/images/<photo-id>.jpg (images Unsplash, jamais pravatar/dicebear)
// Import DIRECT de mockdata.ts et subConfig.ts (aucun parseur) : mockdata.ts n'a aucun import,
// subConfig.ts n'a qu'un `import type` (effacé par esbuild/tsx, l'alias `@/` n'est donc jamais
// résolu). Les routes/composants JSX ne sont JAMAIS importés (framer-motion, tanstack absents).
//
// Usage : pnpm tsx scripts/migrate-mockdata-to-seed.ts [--dry-run] [--skip-images]
//
// Hors du périmètre de `nuxt typecheck` (qui n'inclut pas scripts/) : TypeScript strict à la
// main, zéro `any`.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

import {
  companies as mockCompanies,
  equipe as mockEquipe,
  partenaires as mockPartenaires,
  realisations as mockRealisations,
  services as mockServices,
  messagesContact as mockMessages,
  suggestionsProduits as mockSuggestions,
  reservationsRestaurant as mockReservations,
  employes as mockEmployes,
  planningEntries as mockPlanningEntries,
  clients as mockClients,
  clientsComptables as mockClientsComptables,
  candidats as mockCandidats,
  demandesClients as mockDemandesClients,
  offresEmploi as mockOffresEmploi,
  candidatures as mockCandidatures,
} from '../prototype_react/cd-holding-nexus/src/data/mockdata'
import { SUB_CONFIG } from '../prototype_react/cd-holding-nexus/src/components/subsidiary/subConfig'
import type {
  GeneratedCandidat,
  GeneratedCandidature,
  GeneratedClient,
  GeneratedClientComptable,
  GeneratedCompany,
  GeneratedDemandeClient,
  GeneratedDemo,
  GeneratedEmploye,
  GeneratedEquipeMembre,
  GeneratedImage,
  GeneratedMessage,
  GeneratedOffreEmploi,
  GeneratedPartenaire,
  GeneratedPlanningEntry,
  GeneratedPrototype,
  GeneratedRealisation,
  GeneratedReservation,
  GeneratedService,
  GeneratedSubConfig,
  GeneratedSuggestion,
} from '../prisma/seed-data/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUTPUT_FILE = path.join(ROOT, 'prisma/seed-data/prototype.generated.ts')
const IMAGES_DIR = path.join(ROOT, 'prisma/seed-assets/images')

const DRY_RUN = process.argv.includes('--dry-run')
const SKIP_IMAGES = process.argv.includes('--skip-images')

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 60_000
const FETCH_RETRIES = 3
const UNSPLASH_HOST = 'images.unsplash.com'

// --- Schémas zod locaux de garde-fou (spec §3.1) ----------------------------------------
const FILIALE_SLUGS_PROTO = ['entretien', 'transport', 'comptable', 'placement', 'cdpaa', 'boissons'] as const
const SITE_SLUGS_PROTO = ['holding', ...FILIALE_SLUGS_PROTO] as const

const mockCompanySchema = z.object({
  id: z.number(),
  slug: z.enum(FILIALE_SLUGS_PROTO),
  nom: z.string().min(1),
  secteur: z.string().min(1),
  description: z.string().min(1),
  couleurAccent: z.string().min(1),
  imagePlaceholder: z.string().url(),
  employesCount: z.number().int().positive(),
  statutSite: z.enum(['actif', 'en_maintenance', 'en_construction']),
})

const mockServiceSchema = z.object({
  id: z.number(),
  filialeId: z.enum(FILIALE_SLUGS_PROTO),
  titre: z.string().min(1),
  description: z.string().min(1),
})

const mockEquipeSchema = z.object({
  id: z.number(),
  filialeId: z.enum(SITE_SLUGS_PROTO),
  nom: z.string().min(1),
  poste: z.string().min(1),
  photoPlaceholder: z.string().min(1),
  bio: z.string().min(1),
})

const mockRealisationSchema = z.object({
  id: z.number(),
  filialeId: z.enum(SITE_SLUGS_PROTO),
  titre: z.string().min(1),
  description: z.string().min(1),
  imagePlaceholder: z.string().url(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const mockPartenaireSchema = z.object({
  id: z.number(),
  filialeId: z.enum(SITE_SLUGS_PROTO),
  nom: z.string().min(1),
  logoPlaceholder: z.string().min(1),
  typeRelation: z.string().min(1),
})

function validateCollection<T>(name: string, items: readonly unknown[], schema: z.ZodType<T>): T[] {
  const result = z.array(schema).safeParse(items)
  if (!result.success) {
    console.error(`[migrate-mockdata-to-seed] Collection invalide : ${name}`)
    console.error(result.error.issues)
    throw new Error(`Forme inattendue pour la collection "${name}" — voir prototype_react/.../mockdata.ts`)
  }
  return result.data
}

// --- Images : extraction + normalisation -------------------------------------------------

// Le prototype référence quelques photos Unsplash depuis retirées par leur auteur (404).
// Remplacées par une photo de même thème déjà présente ailleurs dans le corpus (vérifiée
// disponible), plutôt que de deviner un identifiant inconnu à l'aveugle.
const DEAD_PHOTO_SUBSTITUTIONS: Readonly<Record<string, string>> = {
  // companies.transport.imagePlaceholder / SUB_CONFIG.transport.heroImage (mockdata.ts) :
  // photo retirée d'Unsplash → remplacée par la photo de la réalisation transport #7 (même thème).
  '1601584115197-04ecc0da31e5': '1519003722824-194d4455a60c',
}

const warnedSubstitutions = new Set<string>()

/** Extrait l'identifiant stable d'une URL Unsplash (`photo-<id>?...` → `<id>`). Rejette tout host ≠ images.unsplash.com. */
function extractPhotoId(url: string): string {
  const parsed = new URL(url)
  if (parsed.hostname !== UNSPLASH_HOST) {
    throw new Error(`Hôte d'image refusé (attendu ${UNSPLASH_HOST}) : ${url}`)
  }
  const match = parsed.pathname.match(/\/photo-([a-z0-9-]+)$/i)
  if (!match) {
    throw new Error(`Impossible d'extraire l'identifiant de photo depuis : ${url}`)
  }
  const id = match[1]
  const substitute = DEAD_PHOTO_SUBSTITUTIONS[id]
  if (substitute) {
    if (!warnedSubstitutions.has(id)) {
      console.warn(`[migrate-mockdata-to-seed] Photo Unsplash retirée (${id}) → substituée par ${substitute}`)
      warnedSubstitutions.add(id)
    }
    return substitute
  }
  return id
}

function normalizedSourceUrl(photoId: string): string {
  return `https://${UNSPLASH_HOST}/photo-${photoId}?fm=jpg&fit=crop&w=1600&q=75`
}

/** Sources d'images hors mockdata : textes JSX des routes spécifiques (spec §3.2). */
const EXTRA_IMAGE_SOURCES: readonly { readonly url: string; readonly ref: string }[] = [
  { url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390', ref: 'components/holding/Hero.tsx:93' },
  { url: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9', ref: 'routes/cdpaa.index.tsx:30' },
  { url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1', ref: 'routes/cdpaa.index.tsx:41' },
  { url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445', ref: 'routes/cdpaa.restaurant.tsx:38' },
  { url: 'https://images.unsplash.com/photo-1550547660-d9450f859349', ref: 'routes/cdpaa.restaurant.tsx:39' },
  { url: 'https://images.unsplash.com/photo-1543353071-873f17a7a088', ref: 'routes/cdpaa.restaurant.tsx:40' },
  { url: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327', ref: 'routes/cdpaa.restaurant.tsx:41' },
  { url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0', ref: 'routes/cdpaa.restaurant.tsx:74' },
]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sniffJpeg(buf: Buffer): boolean {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
}

/** Télécharge une image avec retries + timeout généreux (réseau lent). Vérifie octets magiques + taille. */
async function fetchImageBytes(url: string): Promise<Buffer> {
  let lastError: unknown
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status} sur ${url}`)
      const buf = Buffer.from(await response.arrayBuffer())
      if (!sniffJpeg(buf)) throw new Error(`Contenu non-JPEG reçu pour ${url}`)
      if (buf.length > MAX_UPLOAD_BYTES) throw new Error(`Image trop volumineuse (${buf.length} octets) : ${url}`)
      return buf
    } catch (error) {
      lastError = error
      console.warn(`[migrate-mockdata-to-seed] tentative ${attempt}/${FETCH_RETRIES} échouée pour ${url} : ${(error as Error).message}`)
      if (attempt < FETCH_RETRIES) await sleep(2000 * attempt)
    } finally {
      clearTimeout(timeout)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Échec de téléchargement : ${url}`)
}

async function ensureImage(photoId: string): Promise<GeneratedImage> {
  const file = `${photoId}.jpg`
  const target = path.join(IMAGES_DIR, file)
  const sourceUrl = normalizedSourceUrl(photoId)

  // Rapide et sûr sur réseau lent : si le fichier est déjà présent et valide sur disque (d'une
  // exécution précédente du générateur), on ne le retélécharge pas — condition nécessaire pour
  // que "lancer le générateur 2 fois" ne dépende pas du réseau au 2e passage (spec §5, T2).
  if (existsSync(target)) {
    const existing = await readFile(target)
    if (sniffJpeg(existing)) {
      return { id: photoId, file, sourceUrl, sha256: createHash('sha256').update(existing).digest('hex'), octets: existing.length }
    }
  }

  if (SKIP_IMAGES) {
    throw new Error(`--skip-images actif mais aucune image locale pour ${photoId} — exécuter une première fois sans ce flag`)
  }

  const bytes = await fetchImageBytes(sourceUrl)
  const sha256 = createHash('sha256').update(bytes).digest('hex')

  if (!DRY_RUN) {
    await mkdir(IMAGES_DIR, { recursive: true })
    // "si le fichier existe déjà avec le même sha256, il est sauté" (spec §3.2) : ici le fichier
    // n'existait pas encore (branche ci-dessus), donc on écrit toujours ; le cas "même sha256"
    // est couvert par le fast-path existsSync ci-dessus lors des exécutions suivantes.
    await writeFile(target, bytes)
  }

  return { id: photoId, file, sourceUrl, sha256, octets: bytes.length }
}

// --- Transformation des collections -------------------------------------------------------

function toGeneratedCompanies(): GeneratedCompany[] {
  return validateCollection('companies', mockCompanies, mockCompanySchema).map((c) => ({
    slug: c.slug,
    description: c.description,
    secteurPrototype: c.secteur,
    heroImageId: extractPhotoId(c.imagePlaceholder),
    effectif: c.employesCount,
  }))
}

function toGeneratedServices(): GeneratedService[] {
  const items = validateCollection('services', mockServices, mockServiceSchema)
  const counters = new Map<string, number>()
  return items.map((s) => {
    const ordre = counters.get(s.filialeId) ?? 0
    counters.set(s.filialeId, ordre + 1)
    return { filiale: s.filialeId, titre: s.titre, description: s.description, ordre }
  })
}

function toGeneratedRealisations(): GeneratedRealisation[] {
  const items = validateCollection('realisations', mockRealisations, mockRealisationSchema)
  const counters = new Map<string, number>()
  return items.map((r) => {
    const ordre = counters.get(r.filialeId) ?? 0
    counters.set(r.filialeId, ordre + 1)
    return {
      filiale: r.filialeId,
      titre: r.titre,
      description: r.description,
      date: r.date,
      imageId: extractPhotoId(r.imagePlaceholder),
      ordre,
    }
  })
}

function toGeneratedEquipe(): GeneratedEquipeMembre[] {
  const items = validateCollection('equipe', mockEquipe, mockEquipeSchema)
  const counters = new Map<string, number>()
  return items.map((m) => {
    const ordre = counters.get(m.filialeId) ?? 0
    counters.set(m.filialeId, ordre + 1)
    return { filiale: m.filialeId, nom: m.nom, poste: m.poste, bio: m.bio, ordre }
  })
}

function toGeneratedPartenaires(): GeneratedPartenaire[] {
  const items = validateCollection('partenaires', mockPartenaires, mockPartenaireSchema)
  const counters = new Map<string, number>()
  return items.map((p) => {
    const ordre = counters.get(p.filialeId) ?? 0
    counters.set(p.filialeId, ordre + 1)
    return { filiale: p.filialeId, nom: p.nom, typeRelation: p.typeRelation, ordre }
  })
}

function toGeneratedSubConfig(): GeneratedSubConfig[] {
  return FILIALE_SLUGS_PROTO.map((slug) => {
    const cfg = SUB_CONFIG[slug]
    return {
      filiale: slug,
      shortName: cfg.shortName,
      tagline: cfg.tagline,
      headlineLead: cfg.headlineLead,
      headlineAccent: cfg.headlineAccent,
      headlineTail: cfg.headlineTail,
      heroPitch: cfg.heroPitch,
      ctaLabel: cfg.ctaLabel,
      contactIntro: cfg.contactIntro,
      contactHeadline: cfg.contactHeadline,
      contactBaseline: cfg.contactBaselinE,
      successMsg: cfg.successMsg,
    }
  })
}

function toGeneratedDemo(): GeneratedDemo {
  const messages: GeneratedMessage[] = mockMessages.map((m) => ({
    filiale: m.filialeId,
    nom: m.nom,
    email: m.email,
    telephone: m.telephone,
    sujet: m.sujet,
    message: m.message,
    statut: m.statut,
    date: m.date,
  }))

  const suggestions: GeneratedSuggestion[] = mockSuggestions.map((s) => ({
    filiale: s.filialeId,
    nom: s.nom,
    email: s.email,
    produit: s.produit,
    origine: s.origine,
    commentaire: s.commentaire,
    date: s.date,
  }))

  const reservations: GeneratedReservation[] = mockReservations.map((r) => ({
    nom: r.nom,
    email: r.email,
    telephone: r.telephone,
    heure: r.heure,
    personnes: r.personnes,
    note: r.note,
    statut: r.statut,
  }))

  const employes: GeneratedEmploye[] = mockEmployes.map((e) => ({
    filiale: e.filialeId,
    nom: e.nom,
    poste: e.poste,
    email: e.email,
    statut: e.statut,
  }))

  const employeById = new Map(mockEmployes.map((e) => [e.id, e] as const))
  const planningEntries: GeneratedPlanningEntry[] = mockPlanningEntries.map((p) => {
    const employe = employeById.get(p.employeId)
    if (!employe) throw new Error(`planningEntries : employeId ${p.employeId} introuvable`)
    return {
      employeFiliale: employe.filialeId,
      employeNom: employe.nom,
      jour: p.jour,
      debut: p.debut,
      fin: p.fin,
      lieu: p.lieu,
      note: p.note,
    }
  })

  const clients: GeneratedClient[] = mockClients.map((c) => ({
    nom: c.nom,
    entreprise: c.entreprise,
    email: c.email,
    telephone: c.telephone,
    filiale: c.filialeId,
    statut: c.statut,
    notes: c.notes,
    creeLe: c.creeLe,
  }))

  const clientsComptables: GeneratedClientComptable[] = mockClientsComptables.map((c) => ({
    entreprise: c.entreprise,
    contact: c.contact,
    email: c.email,
    forfait: c.forfait,
    prochaineEcheance: c.prochaineEcheance,
    statut: c.statut,
    notes: c.notes,
  }))

  const candidats: GeneratedCandidat[] = mockCandidats.map((c) => ({
    nom: c.nom,
    email: c.email,
    telephone: c.telephone,
    poste: c.poste,
    categorie: c.categorie,
    disponibilite: c.disponibilite,
    statut: c.statut,
    origine: c.origine,
  }))

  const demandesClients: GeneratedDemandeClient[] = mockDemandesClients.map((d) => ({
    entreprise: d.entreprise,
    contact: d.contact,
    email: d.email,
    poste: d.poste,
    categorie: d.categorie,
    quantite: d.quantite,
    debut: d.debut,
    statut: d.statut,
  }))

  const offresEmploi: GeneratedOffreEmploi[] = mockOffresEmploi.map((o) => ({
    titre: o.titre,
    categorie: o.categorie,
    lieu: o.lieu,
    typeContrat: o.typeContrat,
    salaire: o.salaire,
    description: o.description,
    publiee: o.publiee,
    date: o.date,
  }))

  const offreById = new Map(mockOffresEmploi.map((o) => [o.id, o] as const))
  const candidatures: GeneratedCandidature[] = mockCandidatures.map((c) => ({
    offreTitre: c.offreId !== null ? (offreById.get(c.offreId)?.titre ?? null) : null,
    nom: c.nom,
    email: c.email,
    telephone: c.telephone,
    posteVise: c.posteVise,
    experience: c.experience,
    cvNom: c.cvNom,
    documents: c.documents,
    statut: c.statut,
    date: c.date,
  }))

  return {
    messages,
    suggestions,
    reservations,
    employes,
    planningEntries,
    clients,
    clientsComptables,
    candidats,
    demandesClients,
    offresEmploi,
    candidatures,
  }
}

function collectImageIds(companies: readonly GeneratedCompany[], realisations: readonly GeneratedRealisation[]): string[] {
  const ids = new Set<string>()
  for (const c of companies) ids.add(c.heroImageId)
  for (const r of realisations) ids.add(r.imageId)
  for (const extra of EXTRA_IMAGE_SOURCES) ids.add(extractPhotoId(extra.url))
  return [...ids].sort()
}

// --- Sérialisation ---------------------------------------------------------------------

function serialize(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  const padChild = '  '.repeat(indent + 1)
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => `${padChild}${serialize(v, indent + 1)},`).join('\n')
    return `[\n${items}\n${pad}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return '{}'
    const body = entries.map(([k, v]) => `${padChild}${k}: ${serialize(v, indent + 1)},`).join('\n')
    return `{\n${body}\n${pad}}`
  }
  throw new Error(`Valeur non sérialisable : ${String(value)}`)
}

async function main(): Promise<void> {
  const companies = toGeneratedCompanies()
  const services = toGeneratedServices()
  const realisations = toGeneratedRealisations()
  const equipe = toGeneratedEquipe()
  const partenaires = toGeneratedPartenaires()
  const subConfig = toGeneratedSubConfig()
  const demo = toGeneratedDemo()

  const imageIds = collectImageIds(companies, realisations)
  const images: GeneratedImage[] = []
  for (const id of imageIds) {
    images.push(await ensureImage(id))
  }

  const data: GeneratedPrototype = { companies, services, realisations, equipe, partenaires, subConfig, demo, images }

  const header = `// GÉNÉRÉ par scripts/migrate-mockdata-to-seed.ts — NE PAS ÉDITER À LA MAIN.
// Relancer : pnpm tsx scripts/migrate-mockdata-to-seed.ts
// Source : prototype_react/cd-holding-nexus/src/data/mockdata.ts et .../subsidiary/subConfig.ts
// Consommé par prisma/seed/contenu.ts et prisma/seed/demo.ts (amorçage uniquement).
import type { GeneratedPrototype } from './types'

export const GENERATED: GeneratedPrototype = `

const output = `${header}${serialize(data)}\n`

if (DRY_RUN) {
  console.info('[migrate-mockdata-to-seed] --dry-run : aucun fichier écrit.')
  console.info(`Collections : companies=${companies.length} services=${services.length} realisations=${realisations.length} equipe=${equipe.length} partenaires=${partenaires.length} images=${images.length}`)
  return
}

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
await writeFile(OUTPUT_FILE, output)
console.info(`[migrate-mockdata-to-seed] Écrit ${OUTPUT_FILE}`)
console.info(`[migrate-mockdata-to-seed] Images : ${images.length} (${SKIP_IMAGES ? 'réutilisées, --skip-images' : 'vérifiées/téléchargées'})`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
