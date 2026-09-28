// GET /api/public/placement/offres/[uuid] — détail public d'une offre (spec lot 3 §3). Un uuid
// malformé fait échouer `getValidatedRouterParams` en 400 avant toute requête Prisma. Une offre
// inconnue, retirée (dépubliée/pourvue/annulée) ou incomplète répond 404 — jamais un détail sur
// la raison exacte (pas de fuite d'existence).
import { z } from 'zod'
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import type { PublicOffreDto } from '#shared/types/public'
import { OFFRE_SELECT, toOffreDto } from '../../../../lib/candidature'

const paramsSchema = z.object({ uuid: z.string().uuid() })

async function resolvePlacementId(): Promise<number> {
  const company = await prisma.company.findUnique({ where: { slug: PLACEMENT_SLUG }, select: { id: true } })
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Configuration invalide' })
  }
  return company.id
}

export default defineEventHandler(async (event): Promise<PublicOffreDto> => {
  const { uuid } = await getValidatedRouterParams(event, paramsSchema.parse)
  const companyId = await resolvePlacementId()

  const row = await prisma.demandeClient.findFirst({
    where: {
      uuid,
      companyId,
      publiee: true,
      statut: 'OUVERTE',
      titreOffre: { not: null },
      lieu: { not: null },
      typeContrat: { not: null },
      descriptionPublique: { not: null },
      publieeLe: { not: null },
    },
    select: OFFRE_SELECT,
  })
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Offre introuvable ou retirée' })
  }

  return toOffreDto(row)
})
