// GET /api/admin/messages : liste paginée (lot 4). `q` jamais loggé.
import { messagesQuerySchema } from '#shared/validation/admin'
import { listMessages } from '../../../services/admin/messages'

const ROLES_LOT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_LOT)
  const query = await getValidatedQuery(event, messagesQuerySchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return listMessages(ctx, query)
})
