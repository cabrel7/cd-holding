// GET /api/admin/reservations : réservations du restaurant paginées (spec lot 5 §3).
import { MODULES } from '#shared/config/modules'
import { RESTAURANT_SLUG } from '#shared/utils/restaurant'
import { reservationsQuerySchema } from '#shared/validation/reservation'
import { listReservations } from '../../../services/admin/reservations'

const ROLES_RESERVATIONS = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.RESERVATIONS, { site: RESTAURANT_SLUG, roles: ROLES_RESERVATIONS })
  const query = await getValidatedQuery(event, reservationsQuerySchema.parse)
  setResponseHeader(event, 'cache-control', 'no-store')
  return listReservations(ctx, query)
})
