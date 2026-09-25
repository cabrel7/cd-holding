// ReglagesRestaurant (ccdpaa), amorcé une seule fois — spec §2 : "créé si absent : [2..7],
// 11:30, 22:00, dernier service 21:30, pas de 30 min, 20 personnes, 2 h, 90 j". Valeurs reprises
// de routes/ccdpaa.restaurant.tsx:63-69 ("Mardi — dimanche, 11h30 · 22h00").
import type { PrismaClient } from '../../server/generated/prisma/client'
import type { SeededCompanies } from './companies'

export async function seedReglages(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  const companyId = companies.filiales.ccdpaa.id

  const existing = await prisma.reglagesRestaurant.findUnique({ where: { companyId } })
  if (existing) return

  await prisma.reglagesRestaurant.create({
    data: {
      companyId,
      nom: 'Les Ambassades d’Afrique',
      adresse: null,
      quartier: 'Plateau Mont-Royal',
      joursOuverture: [2, 3, 4, 5, 6, 7], // mardi (2) → dimanche (7), ISO
      heureOuverture: '11:30',
      heureFermeture: '22:00',
      dernierService: '21:30',
      pasCreneauMinutes: 30,
      capaciteMaxReservation: 20,
      delaiMinimumHeures: 2,
      horizonJours: 90,
    },
  })
}
