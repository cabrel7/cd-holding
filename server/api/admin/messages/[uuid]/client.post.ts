// POST /api/admin/messages/[uuid]/client : ajoute l'expéditeur aux clients (201, 409 si présent).
import { z } from 'zod'
import { convertirEnClient } from '../../../../services/admin/messages'

const ROLES_LOT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_LOT)
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const client = await convertirEnClient(ctx, uuid)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 201)
  return client
})
