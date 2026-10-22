// PATCH /api/admin/reservations/[uuid] : changement de statut (409 si conflit d'index partiel).
import { z } from 'zod'
import { MODULES } from '#shared/config/modules'
import { RESTAURANT_SLUG } from '#shared/utils/restaurant'
import { reservationUpdateSchema } from '#shared/validation/reservation'
import { updateReservationStatut } from '../../../services/admin/reservations'

const ROLES_RESERVATIONS = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const
const paramsSchema = z.object({ uuid: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireModule(event, MODULES.RESERVATIONS, { site: RESTAURANT_SLUG, roles: ROLES_RESERVATIONS })
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { statut } = await readValidatedBody(event, reservationUpdateSchema.parse)
  const reservation = await updateReservationStatut(ctx, uuid, statut)
  setResponseHeader(event, 'cache-control', 'no-store')
  return reservation
})
