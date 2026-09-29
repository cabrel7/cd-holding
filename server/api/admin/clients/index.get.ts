// GET /api/admin/clients : liste paginée (lot 4). `q` jamais loggé.
import { clientsQuerySchema } from '#shared/validation/admin'
import { listClients } from '../../../services/admin/clients'

const ROLES_LOT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_LOT)
  const query = await getValidatedQuery(event, clientsQuerySchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return listClients(ctx, query)
})
