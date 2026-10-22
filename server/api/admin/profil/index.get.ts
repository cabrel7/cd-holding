// GET /api/admin/profil : profil du compte connecté (spec lot 5 §3).
// Lecture de soi uniquement (`secure.userId`) : aucun scoping filiale, aucun cas 403 (D9),
// aucun rate-limit sur une lecture sans surface de force brute (D10).
import { getProfil, ROLES_PROFIL } from '../../../services/admin/profil'

export default defineEventHandler(async (event) => {
  const { secure } = await requireRole(event, ROLES_PROFIL)
  // Avant la requête : la réponse d'erreur 5xx reste elle aussi non cacheable.
  setResponseHeader(event, 'cache-control', 'no-store')

  const profil = await getProfil(secure.userId)
  if (profil === null) {
    throw createError({ statusCode: 401, statusMessage: 'Session invalide, veuillez vous reconnecter' })
  }

  return profil
})
