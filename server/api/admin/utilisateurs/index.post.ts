// POST /api/admin/utilisateurs : création d'un compte (201, D14 — mot de passe temporaire
// généré serveur, haché immédiatement, renvoyé une seule fois, jamais loggé). Orchestration
// (D7 du lot 5) : requireRole → rate-limit → garde 4 Ko → zod → génération + hashPassword
// (crypto uniquement ici, jamais dans le service) → service → resetRateLimit → réponse.
import { utilisateurCreateSchema } from '#shared/validation/utilisateurs'
import { genererMotDePasseTemporaire } from '../../../lib/admin/comptes'
import { creerCompte } from '../../../services/admin/utilisateurs'

const ROLES_COMPTES = [ROLES.SUPER_ADMIN] as const
const COMPTES_RATE_LIMIT = { scope: 'admin-comptes', max: 10, windowMs: 15 * 60 * 1000 } as const
// Corps : nom + email + rôle + site, quelques centaines d'octets suffisent largement.
// Rejeté avant lecture si `content-length` annonce plus (déni de service). L'absence de
// header (chunked) tombe dans readValidatedBody comme sur [uuid].patch.ts — route déjà
// protégée par requireRole + rate-limit — au lieu d'un 413 trompeur sur une simple absence.
const MAX_BODY_BYTES = 4 * 1024

export default defineEventHandler(async (event) => {
  const { secure } = await requireRole(event, ROLES_COMPTES)
  const cle = String(secure.userId)
  assertRateLimit(event, { ...COMPTES_RATE_LIMIT, cle })

  const contentLength = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Requête trop volumineuse' })
  }

  const body = await readValidatedBody(event, utilisateurCreateSchema.parse)

  const motDePasseTemporaire = genererMotDePasseTemporaire()
  const hash = await hashPassword(motDePasseTemporaire)
  const compte = await creerCompte(body, hash)

  resetRateLimit(event, COMPTES_RATE_LIMIT.scope, cle)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 201)
  return { compte, motDePasseTemporaire }
})
