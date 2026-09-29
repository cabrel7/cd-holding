// PATCH /api/admin/messages/[uuid] : changement de statut.
import { z } from 'zod'
import { messageUpdateSchema } from '#shared/validation/admin'
import { updateMessageStatut } from '../../../services/admin/messages'

const ROLES_LOT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_LOT)
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { statut } = await readValidatedBody(event, messageUpdateSchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return updateMessageStatut(ctx, uuid, statut)
})
