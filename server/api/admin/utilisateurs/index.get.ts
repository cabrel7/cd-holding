// GET /api/admin/utilisateurs : liste paginée des comptes (SUPER_ADMIN, spec §3).
import { utilisateursQuerySchema } from '#shared/validation/utilisateurs'
import { listComptes } from '../../../services/admin/utilisateurs'

const ROLES_COMPTES = [ROLES.SUPER_ADMIN] as const

export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_COMPTES)
  const query = await getValidatedQuery(event, utilisateursQuerySchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return listComptes(query)
})
