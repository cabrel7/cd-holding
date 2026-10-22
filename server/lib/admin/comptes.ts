// Logique pure de gestion des comptes (lot 6, spec §6) : garde auto-modification, garde
// dernier super administrateur actif (anti-lockout D4), résolution du rattachement filiale
// (D7) et mappage DTO. Aucune dépendance Prisma ni createError : les fonctions renvoient
// des codes que le service (server/services/admin/utilisateurs.ts) traduit en HTTP.
import type { FilialeSlug } from '#shared/config/sites'
import type { AppRole } from '#shared/utils/roles'
import { ROLES } from '#shared/utils/roles'
import type { AdminCompteDto } from '#shared/types/admin'

// --- Générération du mot de passe temporaire (D14) --------------------------------------------
// Alphabet sans ambiguïté : A-Z a-z 2-9, sans 0/O/1/l/I. 57 caractères.
const ALPHABET_MDP_TEMPORAIRE = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const MDP_TEMPORAIRE_LONGUEUR = 16
// Rejet du modulo bias : seuls les octets < 228 (multiple de 57 ≤ 256) sont acceptés.
const MDP_TEMPORAIRE_PLAFOND = 256 - (256 % ALPHABET_MDP_TEMPORAIRE.length)

/**
 * Mot de passe temporaire serveur (D14) : 16 caractères, `crypto.getRandomValues` (jamais
 * Math.random), toujours conforme au `passwordSchema` (longueur ≥ 8). Haché immédiatement
 * par la route, renvoyé une seule fois, jamais loggé.
 */
export function genererMotDePasseTemporaire(): string {
  let mot = ''
  while (mot.length < MDP_TEMPORAIRE_LONGUEUR) {
    const octets = crypto.getRandomValues(new Uint8Array(MDP_TEMPORAIRE_LONGUEUR))
    for (const octet of octets) {
      if (octet >= MDP_TEMPORAIRE_PLAFOND) continue
      mot += ALPHABET_MDP_TEMPORAIRE[octet % ALPHABET_MDP_TEMPORAIRE.length]
      if (mot.length === MDP_TEMPORAIRE_LONGUEUR) break
    }
  }
  return mot
}

// --- Garde auto-modification (D3) -----------------------------------------------------------

/** Toute mutation ciblant le propre compte est refusée (409), reset compris. */
export function verifierAutoModification(uuidCible: string, uuidSession: string): 'compte-propre' | null {
  return uuidCible === uuidSession ? 'compte-propre' : null
}

// --- Garde dernier super administrateur actif (D4) -------------------------------------------

export interface CibleDernierSuperAdmin {
  readonly roleActuel: AppRole
  readonly actifActuel: boolean
  readonly roleResultant: AppRole
  readonly actifResultant: boolean
}

/**
 * Refuse l'opération qui ferait passer les SUPER_ADMIN actifs à zéro (désactivation ou
 * rétrogradation du dernier). Le seed ne répare jamais un compte désactivé : un tel verrou
 * rendrait le dépôt ingérable. `nbAutresSuperAdminsActifs` = count hors la cible elle-même.
 */
export function verifierDernierSuperAdmin(
  cible: CibleDernierSuperAdmin,
  nbAutresSuperAdminsActifs: number,
): 'dernier-super-admin' | null {
  const etaitActifSuperAdmin = cible.roleActuel === ROLES.SUPER_ADMIN && cible.actifActuel
  const resteraActifSuperAdmin = cible.roleResultant === ROLES.SUPER_ADMIN && cible.actifResultant
  if (etaitActifSuperAdmin && !resteraActifSuperAdmin && nbAutresSuperAdminsActifs === 0) {
    return 'dernier-super-admin'
  }
  return null
}

// --- Rattachement filiale (D7) --------------------------------------------------------------

export interface RattachementSite {
  readonly companyId: number
}

export type ResultatRattachement =
  | { readonly ok: true; readonly companyId: number | null }
  | { readonly ok: false; readonly code: 'site-requis' | 'site-inattendu' }

/**
 * Fusion rôle résultant × site fourni × companyId actuel : SUPER_ADMIN ⇒ companyId null (et
 * `site` fourni = incohérence, rejetée), sinon filiale obligatoire — celle du body si
 * fournie, sinon le rattachement actuel, sinon refus. Le slug est déjà résolu en companyId
 * par le service (IO) avant l'appel.
 */
export function resoudreRattachement(
  roleResultant: AppRole,
  site: RattachementSite | undefined,
  companyIdActuel: number | null,
): ResultatRattachement {
  if (roleResultant === ROLES.SUPER_ADMIN) {
    return site === undefined ? { ok: true, companyId: null } : { ok: false, code: 'site-inattendu' }
  }
  if (site !== undefined) return { ok: true, companyId: site.companyId }
  if (companyIdActuel !== null) return { ok: true, companyId: companyIdActuel }
  return { ok: false, code: 'site-requis' }
}

// --- DTO (pick explicite, miroir toProfilDto) -------------------------------------------------

/** Row minimale attendue par le mapping — le service garantit le select et le typage du slug. */
export interface CompteRow {
  readonly uuid: string
  readonly nom: string
  readonly email: string
  readonly role: AppRole
  readonly actif: boolean
  readonly company: { readonly uuid: string; readonly nom: string; readonly slug: FilialeSlug } | null
}

/** Jamais `id`, `companyId`, `passwordHash` ni `passwordChangedAt` (D17). */
export function toCompteDto(row: CompteRow): AdminCompteDto {
  return {
    uuid: row.uuid,
    nom: row.nom,
    email: row.email,
    role: row.role,
    actif: row.actif,
    company: row.company === null ? null : { uuid: row.company.uuid, nom: row.company.nom, slug: row.company.slug },
  }
}
