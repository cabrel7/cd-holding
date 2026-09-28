// GET /api/public/restaurant — réglages publics du restaurant ccdpaa (spec lot 3 §3). Source
// unique des horaires/créneaux/capacité : aucun horaire en dur, ni ici ni côté client
// (`creneauxPourDate` consomme directement ce DTO). Absents ou invalides (garde-fou boucle
// infinie/créneaux absurdes) → 404, jamais une page avec des horaires incohérents.
import { consola } from 'consola'
import { RESTAURANT_SLUG, reglagesValides } from '#shared/utils/restaurant'
import type { PublicRestaurantDto } from '#shared/types/public'
import { RESTAURANT_SELECT, toRestaurantDto } from '../../../lib/reservation'

export default defineEventHandler(async (): Promise<PublicRestaurantDto> => {
  const company = await prisma.company.findUnique({ where: { slug: RESTAURANT_SLUG }, select: { id: true } })
  const reglages = company ? await prisma.reglagesRestaurant.findUnique({ where: { companyId: company.id }, select: RESTAURANT_SELECT }) : null

  if (!reglages || !reglagesValides(reglages)) {
    consola.warn('[restaurant] réglages absents ou invalides')
    throw createError({ statusCode: 404, statusMessage: 'Réglages du restaurant introuvables' })
  }

  return toRestaurantDto(reglages)
})
