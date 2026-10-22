// POST /api/admin/utilisateurs/[uuid]/mot-de-passe : reset par un admin (D11/D14). Le mot
// de passe est généré serveur (16 car., alphabet sans ambiguïté), haché immédiatement,
// renvoyé une seule fois (no-store) — aucun courriel envoyé (Q-10). Toutes les sessions de
// la cible reçoivent 401 au prochain appel (passwordChangedAt bumpé par le service).
// Orchestration (D7 du lot 5) : requireRole → rate-limit → params zod → garde 4 Ko →
// corps strict vide → génération + hashPassword → service → resetRateLimit.
import { z } from 'zod'
import { resetMotDePasseSchema } from '#shared/validation/utilisateurs'
import { genererMotDePasseTemporaire } from '../../../../lib/admin/comptes'
import { reinitialiserMotDePasse } from '../../../../services/admin/utilisateurs'

const ROLES_COMPTES = [ROLES.SUPER_ADMIN] as const
const COMPTES_RATE_LIMIT = { scope: 'admin-comptes', max: 10, windowMs: 15 * 60 * 1000 } as const
const paramsSchema = z.object({ uuid: z.string().uuid() })
// Corps attendu : vide ( `{}` ). `?? {}` : un POST sans corps reste un objet vide au lieu
// d'une erreur de type ; une clé inconnue reste rejetée en 400 par `.strict()`.
const MAX_BODY_BYTES = 4 * 1024

export default defineEventHandler(async (event) => {
  const { user, secure } = await requireRole(event, ROLES_COMPTES)
  const cle = String(secure.userId)
  assertRateLimit(event, { ...COMPTES_RATE_LIMIT, cle })

  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)

  // Corps volontairement vide : seul un dépassement de taille est rejeté ici (pas d'absence
  // de corps, légitime sur cette route).
  const contentLength = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Requête trop volumineuse' })
  }

  await readValidatedBody(event, (corps: unknown) => resetMotDePasseSchema.parse(corps ?? {}))

  const motDePasseTemporaire = genererMotDePasseTemporaire()
  const hash = await hashPassword(motDePasseTemporaire)
  await reinitialiserMotDePasse(user.uuid, uuid, hash)

  resetRateLimit(event, COMPTES_RATE_LIMIT.scope, cle)
  setResponseHeader(event, 'cache-control', 'no-store')
  return { motDePasseTemporaire }
})
