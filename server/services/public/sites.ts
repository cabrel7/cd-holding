// Lecture publique des sites (spec §4.2, "Public (lecture)") — pas de session, slug inconnu
// → 404. Chaque entrée du catalogue de sections est revalidée à la lecture (ligne invalide
// omise, `consola.warn` sans PII) — la base peut contenir une valeur écrite par une version
// antérieure du schéma. Les chiffres calculés (`effectif`, `filiales`) sont résolus ici,
// jamais côté client (spec §1.4).
import { z } from 'zod'
import { consola } from 'consola'
import { HOLDING_SLUG, isSiteSlug, type SiteSlug } from '#shared/config/sites'
import {
  catalogPourSite,
  sectionTypeDefinition,
  trouverEntreeCatalogue,
  PAGE_SITE,
  type CatalogEntry,
  type ChiffreItem,
  type PageSiteKey,
} from '#shared/content/sections'
import { resolveChiffres, type ContexteChiffres } from '#shared/utils/chiffres'
import type {
  PublicMembreEquipeDto,
  PublicPartenaireDto,
  PublicRealisationDto,
  PublicSectionDonnees,
  PublicSectionsDto,
  PublicServiceDto,
  PublicSite,
  PublicSiteCommun,
  PublicSiteSummary,
} from '#shared/types/public'
import { dateOnlyFromDate } from '../cms/shared'
import { resolveAccentColor, toSiteSlug } from '../../utils/site-scope'

// --- résolution du site --------------------------------------------------------------
const slugParamSchema = z.object({ slug: z.string().min(1).max(50) })

async function resolveSiteOr404(slugParam: string): Promise<{ id: number; slug: SiteSlug }> {
  if (!isSiteSlug(slugParam)) {
    throw createError({ statusCode: 404, statusMessage: 'Site introuvable' })
  }
  const company = await prisma.company.findUnique({ where: { slug: slugParam }, select: { id: true } })
  if (!company) {
    throw createError({ statusCode: 404, statusMessage: 'Site introuvable' })
  }
  return { id: company.id, slug: slugParam }
}

// --- GET /api/public/sites -------------------------------------------------------------
const SUMMARY_SELECT = {
  uuid: true,
  slug: true,
  nom: true,
  secteur: true,
  description: true,
  couleurAccent: true,
  heroImageKey: true,
  statutSite: true,
} as const

interface SummaryRow {
  readonly uuid: string
  readonly slug: string
  readonly nom: string
  readonly secteur: string | null
  readonly description: string | null
  readonly couleurAccent: string | null
  readonly heroImageKey: string | null
  readonly statutSite: PublicSiteSummary['statutSite']
}

function toSummaryDto(row: SummaryRow): PublicSiteSummary {
  return {
    uuid: row.uuid,
    slug: toSiteSlug(row.slug),
    nom: row.nom,
    secteur: row.secteur,
    description: row.description,
    couleurAccent: resolveAccentColor(row.couleurAccent),
    heroImageKey: row.heroImageKey,
    statutSite: row.statutSite,
  }
}

const list = defineEventHandler(async (): Promise<PublicSiteSummary[]> => {
  const rows = await prisma.company.findMany({
    where: { type: 'FILIALE' },
    orderBy: { ordre: 'asc' },
    select: SUMMARY_SELECT,
  })
  return rows.map(toSummaryDto)
})

// --- GET /api/public/sites/[slug] -------------------------------------------------------------
const DETAIL_SELECT = {
  id: true,
  uuid: true,
  slug: true,
  nom: true,
  nomCourt: true,
  secteur: true,
  description: true,
  couleurAccent: true,
  heroImageKey: true,
  email: true,
  telephone: true,
  adresse: true,
  linkedinUrl: true,
  facebookUrl: true,
  instagramUrl: true,
  statutSite: true,
} as const

const COMMUN_CLES = ['piedDePage', 'maintenance', 'mentionAlcool'] as const

async function resolveCommun(companyId: number, slug: SiteSlug): Promise<PublicSiteCommun> {
  const catalog = catalogPourSite(slug).filter((entry) => entry.page === PAGE_SITE.COMMUN)
  if (catalog.length === 0) {
    return { piedDePage: null, maintenance: null, mentionAlcool: null }
  }

  const rows = await prisma.sectionContenu.findMany({
    where: { companyId, page: 'COMMUN', cle: { in: catalog.map((entry) => entry.cle) } },
    select: { cle: true, donnees: true },
  })
  const byCle = new Map(rows.map((row) => [row.cle, row.donnees]))

  const resolved: Record<string, PublicSectionDonnees | null> = {}
  for (const cle of COMMUN_CLES) {
    const entry = catalog.find((candidate) => candidate.cle === cle)
    const raw = entry ? byCle.get(cle) : undefined
    resolved[cle] = entry && raw !== undefined ? validateSection(entry, raw, slug) : null
  }
  return {
    piedDePage: resolved.piedDePage ?? null,
    maintenance: resolved.maintenance ?? null,
    mentionAlcool: resolved.mentionAlcool ?? null,
  }
}

interface GroupeDto {
  readonly nom: string
  readonly mentionFormulaires: string | null
}

/**
 * Nom du groupe (repli sur `nomCourant` si la holding a disparu — anomalie de données) et
 * mention Loi 25 (spec contact §2.3/§3.3), unique pour le groupe donc toujours lue via la
 * holding même sur une page filiale — une seule requête `SectionContenu` supplémentaire,
 * groupée avec la lecture du nom de la holding.
 */
async function resolveGroupe(slug: SiteSlug, company: { id: number; nom: string }): Promise<GroupeDto> {
  const holding =
    slug === HOLDING_SLUG ? company : await prisma.company.findUnique({ where: { slug: HOLDING_SLUG }, select: { id: true, nom: true } })
  if (!holding) return { nom: company.nom, mentionFormulaires: null }

  const entry = trouverEntreeCatalogue(PAGE_SITE.COMMUN, 'mentionFormulaires')
  if (!entry) return { nom: holding.nom, mentionFormulaires: null }

  const row = await prisma.sectionContenu.findUnique({
    where: { companyId_page_cle: { companyId: holding.id, page: 'COMMUN', cle: 'mentionFormulaires' } },
    select: { donnees: true },
  })
  if (!row) return { nom: holding.nom, mentionFormulaires: null }

  const donnees = validateSection(entry, row.donnees, slug)
  const mentionFormulaires = donnees && typeof donnees.texte === 'string' ? donnees.texte : null
  return { nom: holding.nom, mentionFormulaires }
}

const detail = defineEventHandler(async (event): Promise<PublicSite> => {
  const { slug: slugParam } = await getValidatedRouterParams(event, slugParamSchema.parse)
  if (!isSiteSlug(slugParam)) {
    throw createError({ statusCode: 404, statusMessage: 'Site introuvable' })
  }
  const company = await prisma.company.findUnique({ where: { slug: slugParam }, select: DETAIL_SELECT })
  if (!company) {
    throw createError({ statusCode: 404, statusMessage: 'Site introuvable' })
  }

  const [commun, groupe] = await Promise.all([
    resolveCommun(company.id, slugParam),
    resolveGroupe(slugParam, { id: company.id, nom: company.nom }),
  ])

  return {
    uuid: company.uuid,
    slug: slugParam,
    nom: company.nom,
    nomCourt: company.nomCourt,
    secteur: company.secteur,
    description: company.description,
    couleurAccent: resolveAccentColor(company.couleurAccent),
    heroImageKey: company.heroImageKey,
    email: company.email,
    telephone: company.telephone,
    adresse: company.adresse,
    reseaux: {
      linkedinUrl: company.linkedinUrl,
      facebookUrl: company.facebookUrl,
      instagramUrl: company.instagramUrl,
    },
    statutSite: company.statutSite,
    groupe,
    commun,
  }
})

// --- GET /api/public/sites/[slug]/services -------------------------------------------------------------
const servicesQuerySchema = z.object({ misEnAvant: z.enum(['true', 'false']).optional() }).strict()
const MAX_SERVICES_FALLBACK = 3

const SERVICE_SELECT = { uuid: true, titre: true, description: true, imageKey: true, ordre: true } as const

const services = defineEventHandler(async (event): Promise<PublicServiceDto[]> => {
  const { slug } = await getValidatedRouterParams(event, slugParamSchema.parse)
  const { id: companyId } = await resolveSiteOr404(slug)
  const query = await getValidatedQuery(event, servicesQuerySchema.parse)

  if (query.misEnAvant !== 'true') {
    return prisma.service.findMany({ where: { companyId }, orderBy: { ordre: 'asc' }, select: SERVICE_SELECT })
  }

  const misEnAvant = await prisma.service.findMany({
    where: { companyId, misEnAvant: true },
    orderBy: { ordre: 'asc' },
    select: SERVICE_SELECT,
  })
  if (misEnAvant.length > 0) return misEnAvant

  return prisma.service.findMany({
    where: { companyId },
    orderBy: { ordre: 'asc' },
    take: MAX_SERVICES_FALLBACK,
    select: SERVICE_SELECT,
  })
})

// --- GET /api/public/sites/[slug]/realisations -------------------------------------------------------------
const DEFAULT_REALISATIONS_LIMIT = 12
const realisationsQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(50).optional() })
  .strict()

const REALISATION_SELECT = { uuid: true, titre: true, description: true, imageKey: true, dateRealisation: true, ordre: true } as const

const realisations = defineEventHandler(async (event): Promise<PublicRealisationDto[]> => {
  const { slug } = await getValidatedRouterParams(event, slugParamSchema.parse)
  const { id: companyId } = await resolveSiteOr404(slug)
  const query = await getValidatedQuery(event, realisationsQuerySchema.parse)

  const rows = await prisma.realisation.findMany({
    where: { companyId },
    orderBy: { ordre: 'asc' },
    take: query.limit ?? DEFAULT_REALISATIONS_LIMIT,
    select: REALISATION_SELECT,
  })
  return rows.map((row) => ({
    uuid: row.uuid,
    titre: row.titre,
    description: row.description,
    imageKey: row.imageKey,
    dateRealisation: dateOnlyFromDate(row.dateRealisation),
  }))
})

// --- GET /api/public/sites/[slug]/equipe -------------------------------------------------------------
const equipe = defineEventHandler(async (event): Promise<PublicMembreEquipeDto[]> => {
  const { slug } = await getValidatedRouterParams(event, slugParamSchema.parse)
  const { id: companyId } = await resolveSiteOr404(slug)
  return prisma.membreEquipe.findMany({
    where: { companyId },
    orderBy: { ordre: 'asc' },
    select: { uuid: true, nom: true, poste: true, bio: true, photoKey: true },
  })
})

// --- GET /api/public/sites/[slug]/partenaires -------------------------------------------------------------
const partenaires = defineEventHandler(async (event): Promise<PublicPartenaireDto[]> => {
  const { slug } = await getValidatedRouterParams(event, slugParamSchema.parse)
  const { id: companyId } = await resolveSiteOr404(slug)
  return prisma.partenaire.findMany({
    where: { companyId },
    orderBy: { ordre: 'asc' },
    select: { uuid: true, nom: true, typeRelation: true, siteUrl: true, logoKey: true },
  })
})

// --- GET /api/public/sites/[slug]/sections?page= -------------------------------------------------------------
const PAGE_SITE_KEYS = Object.keys(PAGE_SITE) as [PageSiteKey, ...PageSiteKey[]]
const sectionsQuerySchema = z.object({ page: z.enum(PAGE_SITE_KEYS) }).strict()

interface ChiffresValue {
  readonly items: readonly ChiffreItem[]
  readonly [key: string]: unknown
}

function validateSection(entry: CatalogEntry, donnees: unknown, slug: SiteSlug): PublicSectionDonnees | null {
  const result = sectionTypeDefinition(entry.type).schema.safeParse(donnees)
  if (!result.success) {
    consola.warn('[sections] entrée invalide, omise', { slug, page: entry.page, cle: entry.cle })
    return null
  }
  return result.data as PublicSectionDonnees
}

async function computeChiffresContext(): Promise<ContexteChiffres> {
  const [sommeEffectif, nombreFiliales] = await Promise.all([
    prisma.company.aggregate({ _sum: { effectif: true } }),
    prisma.company.count({ where: { type: 'FILIALE' } }),
  ])
  return { effectifTotal: sommeEffectif._sum.effectif ?? 0, nombreFiliales }
}

const sections = defineEventHandler(async (event): Promise<PublicSectionsDto> => {
  const { slug: slugParam } = await getValidatedRouterParams(event, slugParamSchema.parse)
  const { id: companyId, slug } = await resolveSiteOr404(slugParam)
  const { page } = await getValidatedQuery(event, sectionsQuerySchema.parse)

  const catalog = catalogPourSite(slug).filter((entry) => entry.page === page)
  if (catalog.length === 0) return {}

  const rows = await prisma.sectionContenu.findMany({
    where: { companyId, page, cle: { in: catalog.map((entry) => entry.cle) } },
    select: { cle: true, donnees: true },
  })
  const byCle = new Map(rows.map((row) => [row.cle, row.donnees]))

  let chiffresContext: ContexteChiffres | undefined
  const result: PublicSectionsDto = {}

  for (const entry of catalog) {
    const raw = byCle.get(entry.cle)
    if (raw === undefined) continue
    const value = validateSection(entry, raw, slug)
    if (!value) continue

    if (entry.type === 'chiffres') {
      chiffresContext ??= await computeChiffresContext()
      const chiffresValue = value as unknown as ChiffresValue
      result[entry.cle] = { ...chiffresValue, items: resolveChiffres(chiffresValue.items, chiffresContext) }
    } else {
      result[entry.cle] = value
    }
  }

  return result
})

export const sitesPublic = { list, detail, services, realisations, equipe, partenaires, sections }
