// Service admin "utilisateurs" (lot 6 — gestion des comptes, spec §6) : IO Prisma
// uniquement, aucun #auth-utils (hashPassword/verifyPassword vit dans les routes — règle
// du lot 5). Les gardes pures (auto-modification, dernier SA, rattachement) viennent de
// server/lib/admin/comptes.ts ; ce service les traduit en HTTP et orchestre les requêtes.
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import { isFilialeSlug, type FilialeSlug } from '#shared/config/sites'
import type { AdminCompteDto, AdminPage } from '#shared/types/admin'
import { ROLES } from '#shared/utils/roles'
import type {
  UtilisateurCreateInput,
  UtilisateurUpdateInput,
  UtilisateursQuery,
} from '#shared/validation/utilisateurs'
import type { Prisma } from '../../generated/prisma/client'
import { buildPage, isUniqueViolation, pageArgs } from '../../lib/admin/pagination'
import {
  resoudreRattachement,
  toCompteDto,
  verifierAutoModification,
  verifierDernierSuperAdmin,
} from '../../lib/admin/comptes'

// Messages HTTP — génériques et affichables, aucun détail technique (CLAUDE.md).
const CONFLIT_EMAIL = 'Un compte existe déjà avec cet email.'
const MESSAGE_COMPTE_PROPRE = 'Impossible de modifier votre propre compte.'
const MESSAGE_RESET_PROPRE = 'Utilisez la page Paramètres pour modifier votre propre mot de passe.'
const MESSAGE_DERNIER_SA = 'Impossible de désactiver le dernier compte super administrateur.'
const MESSAGE_SITE_INATTENDU = "Un super administrateur n'est rattaché à aucune filiale."
const MESSAGE_SITE_REQUIS = 'Une filiale est requise pour ce rôle.'
const INTROUVABLE = 'Introuvable'

// --- Select explicite (jamais id, companyId, passwordHash ni passwordChangedAt — D17) ----

export const COMPTES_SELECT = {
  uuid: true,
  nom: true,
  email: true,
  role: true,
  actif: true,
  company: { select: { uuid: true, nom: true, slug: true } },
} as const

type CompteSelectRow = Prisma.UserGetPayload<{ select: typeof COMPTES_SELECT }>

/** Frontière Prisma → DTO : garde le slug dans `FilialeSlug` (anomalie = 500, jamais holding). */
function versSlugFiliale(slug: string): FilialeSlug {
  if (!isFilialeSlug(slug)) throw createError({ statusCode: 500, statusMessage: 'Configuration invalide' })
  return slug
}

function versDto(row: CompteSelectRow): AdminCompteDto {
  return toCompteDto({
    uuid: row.uuid,
    nom: row.nom,
    email: row.email,
    role: row.role,
    actif: row.actif,
    company:
      row.company === null
        ? null
        : { uuid: row.company.uuid, nom: row.company.nom, slug: versSlugFiliale(row.company.slug) },
  })
}

/** Slug de filiale → id interne (jamais exposé). `site` validé par zod en amont (enum filiales). */
async function companyIdParSlug(slug: string): Promise<number> {
  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true } })
  if (company === null) throw createError({ statusCode: 404, statusMessage: INTROUVABLE })
  return company.id
}

// --- Liste paginée (GET) --------------------------------------------------------------------

export async function listComptes(query: UtilisateursQuery): Promise<AdminPage<AdminCompteDto>> {
  const where: Prisma.UserWhereInput = {
    ...(query.role !== undefined ? { role: query.role } : {}),
    ...(query.actif !== undefined ? { actif: query.actif === 'true' } : {}),
    ...(query.q !== undefined
      ? {
          OR: [
            { nom: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ nom: 'asc' }, { email: 'asc' }],
      select: COMPTES_SELECT,
      ...pageArgs(query.page, ADMIN_PAGE_SIZE),
    }),
    prisma.user.count({ where }),
  ])
  return buildPage(rows.map(versDto), total, query.page, ADMIN_PAGE_SIZE)
}

// --- Création (POST, 201) -------------------------------------------------------------------

export async function creerCompte(data: UtilisateurCreateInput, passwordHash: string): Promise<AdminCompteDto> {
  const rattachement = resoudreRattachement(
    data.role,
    data.site !== undefined ? { companyId: await companyIdParSlug(data.site) } : undefined,
    null,
  )
  if (!rattachement.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: rattachement.code === 'site-inattendu' ? MESSAGE_SITE_INATTENDU : MESSAGE_SITE_REQUIS,
    })
  }

  const existant = await prisma.user.findUnique({ where: { email: data.email }, select: { uuid: true } })
  if (existant !== null) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL })

  try {
    const row = await prisma.user.create({
      data: {
        nom: data.nom,
        email: data.email,
        role: data.role,
        companyId: rattachement.companyId,
        passwordHash,
        actif: true,
      },
      select: COMPTES_SELECT,
    })
    return versDto(row)
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL })
    throw error
  }
}

// --- Édition (PATCH) ------------------------------------------------------------------------

export async function modifierCompte(
  uuidSession: string,
  uuid: string,
  data: UtilisateurUpdateInput,
): Promise<AdminCompteDto> {
  if (verifierAutoModification(uuid, uuidSession) === 'compte-propre') {
    throw createError({ statusCode: 409, statusMessage: MESSAGE_COMPTE_PROPRE })
  }

  const cible = await prisma.user.findUnique({
    where: { uuid },
    // `id` sert uniquement à la garde dernier SA et à l'update — jamais dans le DTO.
    select: { ...COMPTES_SELECT, id: true, companyId: true },
  })
  if (cible === null) throw createError({ statusCode: 404, statusMessage: INTROUVABLE })

  const roleResultant = data.role ?? cible.role
  const actifResultant = data.actif ?? cible.actif

  const site = data.site !== undefined ? { companyId: await companyIdParSlug(data.site) } : undefined
  const rattachement = resoudreRattachement(roleResultant, site, cible.companyId)
  if (!rattachement.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: rattachement.code === 'site-inattendu' ? MESSAGE_SITE_INATTENDU : MESSAGE_SITE_REQUIS,
    })
  }

  // Le count (hors cible) n'est utile que si la cible est un SA actif : sinon la garde pure
  // renvoie null quel que soit le résultat.
  const nbAutresSuperAdminsActifs =
    cible.role === ROLES.SUPER_ADMIN && cible.actif
      ? await prisma.user.count({ where: { role: ROLES.SUPER_ADMIN, actif: true, id: { not: cible.id } } })
      : 0
  if (
    verifierDernierSuperAdmin(
      { roleActuel: cible.role, actifActuel: cible.actif, roleResultant, actifResultant },
      nbAutresSuperAdminsActifs,
    ) === 'dernier-super-admin'
  ) {
    throw createError({ statusCode: 409, statusMessage: MESSAGE_DERNIER_SA })
  }

  try {
    const row = await prisma.user.update({
      where: { id: cible.id },
      data: {
        ...(data.nom !== undefined ? { nom: data.nom } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.actif !== undefined ? { actif: data.actif } : {}),
        companyId: rattachement.companyId,
      },
      select: COMPTES_SELECT,
    })
    return versDto(row)
  } catch (error) {
    // Email immuable (D6) : P2002 ne peut théoriquement pas viser l'email ici, gardé par défense.
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL })
    throw error
  }
}

// --- Reset de mot de passe (POST, D11/D14) --------------------------------------------------

/**
 * Reset par un admin : hash déjà calculé par la route, `passwordChangedAt` bumpé (D11 —
 * toutes les sessions de la cible reçoivent 401 au prochain appel, y compris ses onglets).
 */
export async function reinitialiserMotDePasse(uuidSession: string, uuid: string, passwordHash: string): Promise<void> {
  if (verifierAutoModification(uuid, uuidSession) === 'compte-propre') {
    throw createError({ statusCode: 409, statusMessage: MESSAGE_RESET_PROPRE })
  }

  const cible = await prisma.user.findUnique({ where: { uuid }, select: { id: true } })
  if (cible === null) throw createError({ statusCode: 404, statusMessage: INTROUVABLE })

  await prisma.user.update({
    where: { id: cible.id },
    data: { passwordHash, passwordChangedAt: new Date() },
  })
}
