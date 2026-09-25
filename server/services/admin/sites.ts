// Handlers admin "réglages de site" (spec §4.2, "Admin sites") — alimente les sélecteurs de
// site du CMS (GET liste) et le futur écran `/admin/parametres` (GET/PATCH détail, phase 3).
// `couleurAccent` n'apparaît dans AUCUN schéma de body (shared/validation/sites.ts) : un champ
// imprévu est rejeté en 400 par `.strict()`, ce qui la rend non modifiable ici (§6).
import { z } from 'zod'
import {
  siteReglagesFilialeSchema,
  siteReglagesSuperAdminSchema,
  type SiteReglagesFilialeInput,
} from '#shared/validation/sites'
import { SITE_MODULES } from '#shared/config/modules'
import type { AdminSiteReglages, AdminSiteSummary, CompanyTypeDto, StatutSiteDto } from '#shared/types/admin'
import type { Prisma } from '../../generated/prisma/client'
import { assertPublicImages } from '../../utils/public-images'
import { invalidatePublicPages } from '../../utils/isr'
import { resolveAccentColor, toSiteSlug } from '../../utils/site-scope'
import type { AuthContext } from '../../utils/auth'
import { decideSitesListScope } from '../../policies/site-access'

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const uuidParamSchema = z.object({ uuid: z.string().uuid() })

const SUMMARY_SELECT = {
  uuid: true,
  slug: true,
  nom: true,
  nomCourt: true,
  type: true,
  couleurAccent: true,
  statutSite: true,
} as const

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  id: true,
  ordre: true,
  secteur: true,
  description: true,
  effectif: true,
  email: true,
  telephone: true,
  adresse: true,
  linkedinUrl: true,
  facebookUrl: true,
  instagramUrl: true,
  heroImageKey: true,
} as const

interface SummaryRow {
  readonly uuid: string
  readonly slug: string
  readonly nom: string
  readonly nomCourt: string | null
  readonly type: CompanyTypeDto
  readonly couleurAccent: string | null
  readonly statutSite: StatutSiteDto
}

function toSummaryDto(row: SummaryRow): AdminSiteSummary {
  const slug = toSiteSlug(row.slug)
  return {
    uuid: row.uuid,
    slug,
    nom: row.nom,
    nomCourt: row.nomCourt,
    type: row.type,
    couleurAccent: resolveAccentColor(row.couleurAccent),
    statutSite: row.statutSite,
    modules: SITE_MODULES[slug],
  }
}

interface DetailRow extends SummaryRow {
  readonly id: number
  readonly ordre: number
  readonly secteur: string | null
  readonly description: string | null
  readonly effectif: number | null
  readonly email: string | null
  readonly telephone: string | null
  readonly adresse: string | null
  readonly linkedinUrl: string | null
  readonly facebookUrl: string | null
  readonly instagramUrl: string | null
  readonly heroImageKey: string | null
}

function toReglagesDto(row: DetailRow): AdminSiteReglages {
  return {
    ...toSummaryDto(row),
    ordre: row.ordre,
    secteur: row.secteur,
    description: row.description,
    effectif: row.effectif,
    email: row.email,
    telephone: row.telephone,
    adresse: row.adresse,
    linkedinUrl: row.linkedinUrl,
    facebookUrl: row.facebookUrl,
    instagramUrl: row.instagramUrl,
    heroImageKey: row.heroImageKey,
  }
}

function applyFilialeFields(patch: Prisma.CompanyUpdateInput, data: SiteReglagesFilialeInput): void {
  if (data.nomCourt !== undefined) patch.nomCourt = data.nomCourt
  if (data.secteur !== undefined) patch.secteur = data.secteur
  if (data.description !== undefined) patch.description = data.description
  if (data.effectif !== undefined) patch.effectif = data.effectif
  if (data.email !== undefined) patch.email = data.email
  if (data.telephone !== undefined) patch.telephone = data.telephone
  if (data.adresse !== undefined) patch.adresse = data.adresse
  if (data.linkedinUrl !== undefined) patch.linkedinUrl = data.linkedinUrl
  if (data.facebookUrl !== undefined) patch.facebookUrl = data.facebookUrl
  if (data.instagramUrl !== undefined) patch.instagramUrl = data.instagramUrl
  if (data.heroImageKey !== undefined) {
    patch.heroImage = data.heroImageKey ? { connect: { key: data.heroImageKey } } : { disconnect: true }
  }
}

/**
 * Portée de la LISTE des sites (`Company` elle-même, pas une ressource avec FK `companyId` —
 * `companyScope` ne s'applique pas ici) : décidée par `decideSitesListScope`
 * (server/policies/site-access.ts, testé unitairement), traduite ici en `where` Prisma.
 */
function sitesListWhere(ctx: AuthContext): Prisma.CompanyWhereInput {
  const scope = decideSitesListScope(ctx.user.role, ctx.secure.companyId)
  if (scope === 'forbidden') {
    throw createError({ statusCode: 403, statusMessage: 'Compte non rattaché à une filiale' })
  }
  if (scope === 'all') return {}
  if (ctx.secure.companyId === null) {
    // Défensif : `decideSitesListScope` ne renvoie 'company' pour ADMIN_FILIALE que si
    // sessionCompanyId est non-null (voir site-access.ts) — inatteignable en pratique.
    throw createError({ statusCode: 403, statusMessage: 'Compte non rattaché à une filiale' })
  }
  return { id: ctx.secure.companyId }
}

const list = defineEventHandler(async (event): Promise<AdminSiteSummary[]> => {
  const ctx = await requireRole(event, ADMIN_ROLES)
  const where = sitesListWhere(ctx)
  const rows = await prisma.company.findMany({ where, orderBy: { ordre: 'asc' }, select: SUMMARY_SELECT })
  return rows.map(toSummaryDto)
})

async function findDetailOr404(uuid: string): Promise<DetailRow> {
  const row = await prisma.company.findUnique({ where: { uuid }, select: DETAIL_SELECT })
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }
  return row
}

const get = defineEventHandler(async (event): Promise<AdminSiteReglages> => {
  const ctx = await requireRole(event, ADMIN_ROLES)
  const { uuid } = await getValidatedRouterParams(event, uuidParamSchema.parse)
  const row = await findDetailOr404(uuid)
  assertCompanyAccess(ctx.user, ctx.secure, row.id)
  return toReglagesDto(row)
})

const update = defineEventHandler(async (event): Promise<AdminSiteReglages> => {
  const ctx = await requireRole(event, ADMIN_ROLES)
  const { uuid } = await getValidatedRouterParams(event, uuidParamSchema.parse)
  const existing = await findDetailOr404(uuid)
  assertCompanyAccess(ctx.user, ctx.secure, existing.id)

  const patch: Prisma.CompanyUpdateInput = {}

  if (ctx.user.role === ROLES.SUPER_ADMIN) {
    const data = await readValidatedBody(event, siteReglagesSuperAdminSchema.parse)
    applyFilialeFields(patch, data)
    if (data.nom !== undefined) patch.nom = data.nom
    if (data.ordre !== undefined) patch.ordre = data.ordre
    if (data.statutSite !== undefined) patch.statutSite = data.statutSite
    if (data.heroImageKey) await assertPublicImages([data.heroImageKey], existing.id)
  } else {
    const data = await readValidatedBody(event, siteReglagesFilialeSchema.parse)
    applyFilialeFields(patch, data)
    if (data.heroImageKey) await assertPublicImages([data.heroImageKey], existing.id)
  }

  const row = await prisma.company.update({ where: { id: existing.id }, data: patch, select: DETAIL_SELECT })
  await invalidatePublicPages()
  return toReglagesDto(row)
})

export const sitesAdmin = { list, get, update }
