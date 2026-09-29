// DELETE /api/admin/messages/[uuid] : effacement définitif (204).
import { z } from 'zod'
import { deleteMessage } from '../../../services/admin/messages'

const ROLES_LOT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_LOT)
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  await deleteMessage(ctx, uuid)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 204)
  return null
})
