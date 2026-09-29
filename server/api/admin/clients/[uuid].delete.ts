// DELETE /api/admin/clients/[uuid] : suppression (204), cascade sur le DossierComptable.
import { z } from 'zod'
import { deleteClient } from '../../../services/admin/clients'

const ROLES_LOT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_LOT)
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  await deleteClient(ctx, uuid)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 204)
  return null
})
