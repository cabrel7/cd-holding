// GET /api/admin/mon-planning : quarts de la semaine de l'employé connecté (spec lot 5 §2).
// EMPLOYE uniquement (pas de requireModule : SA/AF → 403 via le rôle).
import { planningSemaineQuerySchema } from '#shared/validation/planning'
import { getMonPlanning } from '../../services/admin/planning'

const ROLES_MON_PLANNING = [ROLES.EMPLOYE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_MON_PLANNING)
  const query = await getValidatedQuery(event, planningSemaineQuerySchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return getMonPlanning(ctx, query)
})
