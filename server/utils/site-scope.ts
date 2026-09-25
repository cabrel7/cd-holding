// Résolution de la filiale ciblée par une route /api/admin/** (spec §4.2, "Côté serveur") :
// enchaîne requireRole, transforme un slug `?site=`/`{site}` éventuel en companyId réel (via
// Prisma), applique la politique pure de server/policies/site-access.ts, et lève les erreurs
// HTTP correspondantes. Utilisé par server/utils/cms-collection.ts et par les routes
// admin/sites/**, admin/contenu/sections/**.
import type { H3Event } from 'h3'
import { isSiteSlug, siteSlugSchema, type SiteSlug } from '#shared/config/sites'
import { siteHasModule, type ModuleKey } from '#shared/config/modules'
import { decideReadScope, decideWriteCompany } from '../policies/site-access'
import type { AuthContext } from './auth'

export { siteSlugSchema }

export interface ReadScopeResult {
  readonly scope: 'all' | 'company'
  /** null uniquement quand `scope === 'all'` (SUPER_ADMIN, aucune filiale demandée). */
  readonly companyId: number | null
}

export interface WriteScopeResult {
  readonly companyId: number
  readonly slug: SiteSlug
}

/** Caste un `Company.slug` (texte libre côté Prisma) vers `SiteSlug` — frontière Prisma/shared. */
export function toSiteSlug(slug: string): SiteSlug {
  if (!isSiteSlug(slug)) {
    throw createError({ statusCode: 500, statusMessage: 'Configuration de site invalide' })
  }
  return slug
}

const ACCENT_COLOR_PATTERN = /^#[0-9A-F]{6}$/
const FALLBACK_ACCENT_COLOR = '#1B2A4A' // navy — voir §6 du socle visuel (fallback non négociable)

/**
 * Revalide `Company.couleurAccent` avant toute injection en style inline (admin ET public) :
 * protection contre une valeur corrompue/injectée en base (le champ est nullable et jamais
 * modifiable via l'admin — §6, mais reste une colonne texte libre côté Prisma).
 */
export function resolveAccentColor(value: string | null): string {
  return value !== null && ACCENT_COLOR_PATTERN.test(value) ? value : FALLBACK_ACCENT_COLOR
}

async function resolveCompanyIdBySlug(slug: SiteSlug): Promise<number> {
  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true } })
  if (!company) {
    throw createError({ statusCode: 404, statusMessage: 'Site introuvable' })
  }
  return company.id
}

async function resolveSlugByCompanyId(companyId: number): Promise<SiteSlug> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } })
  if (!company) {
    throw createError({ statusCode: 404, statusMessage: 'Site introuvable' })
  }
  return toSiteSlug(company.slug)
}

async function resolveRequestedCompanyId(site: SiteSlug | undefined): Promise<number | null> {
  if (site === undefined) return null
  return resolveCompanyIdBySlug(site)
}

/** Portée de lecture d'une route GET scopée par filiale — voir server/policies/site-access.ts. */
export async function resolveReadScope(ctx: AuthContext, site: SiteSlug | undefined): Promise<ReadScopeResult> {
  const requestedCompanyId = await resolveRequestedCompanyId(site)
  const sessionCompanyId = ctx.secure.companyId
  const scope = decideReadScope({ role: ctx.user.role, sessionCompanyId, requestedCompanyId })

  if (scope === 'forbidden') {
    throw createError({ statusCode: 403, statusMessage: 'Accès refusé pour cette filiale' })
  }
  if (scope === 'all') {
    return { scope: 'all', companyId: null }
  }

  const companyId = requestedCompanyId ?? sessionCompanyId
  if (companyId === null) {
    // Défensif : la politique aurait dû renvoyer 'forbidden' dans ce cas (anomalie de données).
    throw createError({ statusCode: 403, statusMessage: 'Compte non rattaché à une filiale' })
  }
  return { scope: 'company', companyId }
}

/** Filiale cible d'une écriture — voir server/policies/site-access.ts. */
export async function resolveWriteCompany(ctx: AuthContext, site: SiteSlug | undefined): Promise<WriteScopeResult> {
  const requestedCompanyId = await resolveRequestedCompanyId(site)
  const sessionCompanyId = ctx.secure.companyId
  const decision = decideWriteCompany({ role: ctx.user.role, sessionCompanyId, requestedCompanyId })

  if (decision === 'forbidden') {
    throw createError({ statusCode: 403, statusMessage: 'Accès refusé pour cette filiale' })
  }
  if (decision === 'missing') {
    throw createError({ statusCode: 400, statusMessage: 'Le site cible est requis' })
  }

  const companyId = requestedCompanyId ?? sessionCompanyId
  if (companyId === null) {
    throw createError({ statusCode: 403, statusMessage: 'Compte non rattaché à une filiale' })
  }
  const slug = site ?? (await resolveSlugByCompanyId(companyId))
  return { companyId, slug }
}

export interface ModuleAuthContext extends AuthContext {
  readonly company: { readonly id: number; readonly slug: SiteSlug }
}

/**
 * Enchaîne requireRole, résolution de la filiale (ADMIN_FILIALE : la sienne ; SUPER_ADMIN :
 * `site` obligatoire) et vérifie que cette filiale dispose du module demandé — 403 sinon.
 * Fondation pour les futures routes de module (planning, comptable, placement, réservations),
 * posée en phase 2 sans consommateur encore branché.
 */
export async function requireModule(
  event: H3Event,
  moduleKey: ModuleKey,
  options: { site?: SiteSlug; roles?: readonly AppRole[] } = {},
): Promise<ModuleAuthContext> {
  const roles = options.roles ?? [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE]
  const ctx = await requireRole(event, roles)
  const { companyId, slug } = await resolveWriteCompany(ctx, options.site)

  if (!siteHasModule(slug, moduleKey)) {
    throw createError({ statusCode: 403, statusMessage: 'Module non disponible pour cette filiale' })
  }

  return { ...ctx, company: { id: companyId, slug } }
}
