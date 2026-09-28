// GET /api/public/placement/offres — liste publique des postes ouverts (spec lot 3 §3). Handler
// mince : résout la filiale « placement », lit les offres publiées et ouvertes (champs d'offre
// non nuls), mappe vers le DTO public (server/lib/candidature.ts, pure). Jamais l'objet Prisma
// brut, jamais `entrepriseCliente` ni les champs de contact (spec §6, critère 2).
import { PLACEMENT_SLUG } from '#shared/config/candidature'
import type { PublicOffreDto } from '#shared/types/public'
import { OFFRE_SELECT, toOffreDto } from '../../../../lib/candidature'

// Pas de pagination à cette échelle (spec, point ouvert n°10).
const TAKE = 50

async function resolvePlacementId(): Promise<number> {
  const company = await prisma.company.findUnique({ where: { slug: PLACEMENT_SLUG }, select: { id: true } })
  if (!company) {
    throw createError({ statusCode: 500, statusMessage: 'Configuration invalide' })
  }
  return company.id
}

export default defineEventHandler(async (): Promise<PublicOffreDto[]> => {
  const companyId = await resolvePlacementId()

  const rows = await prisma.demandeClient.findMany({
    where: {
      companyId,
      publiee: true,
      statut: 'OUVERTE',
      titreOffre: { not: null },
      lieu: { not: null },
      typeContrat: { not: null },
      descriptionPublique: { not: null },
      publieeLe: { not: null },
    },
    orderBy: { publieeLe: 'desc' },
    take: TAKE,
    select: OFFRE_SELECT,
  })

  return rows.map(toOffreDto)
})
