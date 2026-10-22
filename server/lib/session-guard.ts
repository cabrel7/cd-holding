// Garde de session paresseux (lot 6, D8/D9 — spec §2.2) : fonction PURE, sans Prisma ni
// createError. requireAuth (server/utils/auth.ts) fait le lookup PK puis délègue la décision
// ici ; le motif d'échec reste testable en unit, le client ne reçoit jamais qu'un 401 générique.
import type { AppRole } from '#shared/utils/roles'

/** Motifs d'échec — jamais exposés au client (message HTTP unique dans requireAuth). */
export type EchecSession =
  | 'compte-introuvable'
  | 'compte-inactif'
  | 'role-modifie'
  | 'filiale-modifiee'
  | 'mot-de-passe-change'

/** État de session évalué : rôle visible + filiale serveur (`secure`, jamais `user`). */
export interface SessionConnue {
  readonly role: AppRole
  readonly companyId: number | null
}

/** Champs du compte nécessaires à l'évaluation (miroir du select de requireAuth). */
export interface CompteSession {
  readonly actif: boolean
  readonly role: AppRole
  readonly companyId: number | null
  readonly passwordChangedAt: Date | null
}

export type ResultatSession = { readonly ok: true } | { readonly ok: false; readonly echec: EchecSession }

/**
 * Invalidation paresseuse (D9) : une session est valable si le compte existe, est actif, si
 * rôle/filiale de la session correspondent encore à la base, et si `loggedInAt >= passwordChangedAt`
 * (comparaison en millisecondes epoch ; égalité au même ms = valable, D10). `passwordChangedAt`
 * null = jamais changé = valable (grandfathering : aucune déconnexion massive au déploiement).
 * Session sans `loggedInAt` (inatteignable par le login, défense en profondeur) : valable
 * uniquement si `passwordChangedAt` est null.
 */
export function evaluerSession(
  loggedInAt: number | undefined,
  session: SessionConnue,
  compte: CompteSession | null,
): ResultatSession {
  if (compte === null) return { ok: false, echec: 'compte-introuvable' }
  if (!compte.actif) return { ok: false, echec: 'compte-inactif' }
  if (compte.role !== session.role) return { ok: false, echec: 'role-modifie' }
  if (compte.companyId !== session.companyId) return { ok: false, echec: 'filiale-modifiee' }
  if (compte.passwordChangedAt !== null && (loggedInAt === undefined || compte.passwordChangedAt.getTime() > loggedInAt)) {
    return { ok: false, echec: 'mot-de-passe-change' }
  }
  return { ok: true }
}
