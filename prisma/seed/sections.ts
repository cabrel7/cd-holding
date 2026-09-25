// Amorce `SectionContenu` : pour chaque entrée du catalogue × site concerné, crée la ligne si
// absente avec la valeur par défaut de prisma/seed-data/sections.ts — VALIDÉE par le schéma zod
// du type déclaré au catalogue avant écriture (contrat T0, shared/content/sections/types.ts).
// Le seed échoue bruyamment si une valeur ne passe pas son schéma (spec §2).
import { catalogPourSite } from '../../shared/content/sections/catalog'
import { sectionTypeDefinition } from '../../shared/content/sections/types'
import { SITE_SLUGS } from '../../shared/config/sites'
import type { Prisma, PrismaClient } from '../../server/generated/prisma/client'
import { defaultDonnees } from '../seed-data/sections'
import type { SeededCompanies } from './companies'

export async function seedSections(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  for (const slug of SITE_SLUGS) {
    const company = companies.bySlug.get(slug)
    if (!company) throw new Error(`Filiale "${slug}" introuvable pour le seed de sections`)

    for (const entry of catalogPourSite(slug)) {
      const raw = defaultDonnees(entry.page, entry.cle, slug)
      if (raw === undefined) {
        throw new Error(
          `Aucune valeur par défaut dans prisma/seed-data/sections.ts pour ${entry.page}:${entry.cle} (site "${slug}") — ` +
            `entrée pourtant présente dans le catalogue (shared/content/sections/catalog.ts)`,
        )
      }

      const { schema } = sectionTypeDefinition(entry.type)
      const result = schema.safeParse(raw)
      if (!result.success) {
        throw new Error(
          `Valeur par défaut invalide pour ${entry.page}:${entry.cle} (site "${slug}", type "${entry.type}") : ` +
            result.error.issues.map((issue) => `${issue.path.join('.')} — ${issue.message}`).join('; '),
        )
      }

      await prisma.sectionContenu.upsert({
        where: { companyId_page_cle: { companyId: company.id, page: entry.page, cle: entry.cle } },
        update: {},
        create: {
          companyId: company.id,
          page: entry.page,
          cle: entry.cle,
          donnees: result.data as Prisma.InputJsonValue,
        },
      })
    }
  }
}
