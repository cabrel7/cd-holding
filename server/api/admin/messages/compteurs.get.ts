// GET /api/admin/messages/compteurs : messages NOUVEAU (scopé) pour la sidebar.
import { compterMessagesNouveaux } from '../../../services/admin/messages'

const ROLES_LOT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_LOT)
  setResponseHeader(event, 'cache-control', 'no-store')
  return compterMessagesNouveaux(ctx)
})
