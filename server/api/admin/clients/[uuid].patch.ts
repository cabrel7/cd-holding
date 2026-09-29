// PATCH /api/admin/clients/[uuid] : modification (filiale immuable).
import { z } from 'zod'
import { clientUpdateSchema } from '#shared/validation/admin'
import { updateClient } from '../../../services/admin/clients'

const ROLES_LOT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_LOT)
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const data = await readValidatedBody(event, clientUpdateSchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return updateClient(ctx, uuid, data)
})
