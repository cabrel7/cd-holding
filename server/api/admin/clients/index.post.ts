// POST /api/admin/clients : création (201). SA : `site` requis ; AF : forcé sur sa filiale.
import { clientCreateSchema } from '#shared/validation/admin'
import { createClient } from '../../../services/admin/clients'

const ROLES_LOT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_LOT)
  const data = await readValidatedBody(event, clientCreateSchema.parse)
  const client = await createClient(ctx, data)
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, 201)
  return client
})
