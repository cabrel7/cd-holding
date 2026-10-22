// Service admin "profil" (lot 5 — sous-lot paramètres) : profil du compte connecté et
// changement de son mot de passe. Aucune référence à l'event H3 : les handlers
// (server/api/admin/profil/**) font `requireRole` + validation zod, puis appellent ces
// fonctions. Lecture de soi uniquement (`secure.userId`, jamais un identifiant client).
// AUCUN appel à hashPassword/verifyPassword ici : ce sont des auto-imports Nitro que
// vitest ne résout pas (les tests unitaires importent ce module) — la crypto vit dans la route.
import type { AdminProfilDto } from '#shared/types/admin'
import { ROLES } from '#shared/utils/roles'
import type { Prisma } from '../../generated/prisma/client'

// Les 3 rôles de la console admin : le mot de passe est une capacité de compte, pas une donnée.
export const ROLES_PROFIL = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE, ROLES.EMPLOYE] as const

// --- Select explicite (jamais id/FK numériques, passwordHash ni actif exposés) ----

export const PROFIL_SELECT = {
  uuid: true,
  nom: true,
  email: true,
  role: true,
  company: { select: { uuid: true, nom: true } },
} as const

export type ProfilMapRow = Prisma.UserGetPayload<{ select: typeof PROFIL_SELECT }>

export function toProfilDto(row: ProfilMapRow): AdminProfilDto {
  return {
    uuid: row.uuid,
    nom: row.nom,
    email: row.email,
    role: row.role,
    company: row.company === null ? null : { uuid: row.company.uuid, nom: row.company.nom },
  }
}

/** Profil du compte, `null` si le compte a été supprimé entre-temps. */
export async function getProfil(userId: number): Promise<AdminProfilDto | null> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: PROFIL_SELECT })
  return row === null ? null : toProfilDto(row)
}

/** Lecture strictement nécessaire au changement de mot de passe — jamais retournée au client.
 * Le contrôle `actif` y est retiré (D8) : le garde central de `requireAuth` l'a déjà fait
 * en amont ; seule la présence du compte reste défensive (course suppression/requête). */
export interface CompteMotDePasse {
  readonly passwordHash: string
}

export async function lireComptePourMotDePasse(userId: number): Promise<CompteMotDePasse | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })
}

/**
 * Écrit `passwordHash` ET `passwordChangedAt` (D10) : les autres sessions du compte meurent
 * au prochain appel ; la route rebombe ensuite `loggedInAt` pour sauver la session courante.
 */
export async function enregistrerMotDePasse(userId: number, hash: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hash, passwordChangedAt: new Date() },
  })
}
