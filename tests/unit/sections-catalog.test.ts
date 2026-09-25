import { describe, expect, it } from 'vitest'
import { CATALOG, catalogPourSite } from '#shared/content/sections/catalog'
import { sectionTypeDefinition } from '#shared/content/sections/types'
import { SITE_SLUGS } from '#shared/config/sites'
import { defaultDonnees } from '../../prisma/seed-data/sections'

describe('sections-catalog', () => {
  it('has at least one catalog entry', () => {
    expect(CATALOG.length).toBeGreaterThan(0)
  })

  for (const slug of SITE_SLUGS) {
    const entries = catalogPourSite(slug)

    describe(`site "${slug}"`, () => {
      for (const entry of entries) {
        it(`has a valid default for ${entry.page}:${entry.cle} (type "${entry.type}")`, () => {
          const donnees = defaultDonnees(entry.page, entry.cle, slug)
          expect(donnees, `prisma/seed-data/sections.ts n'a pas de valeur par défaut pour ${entry.page}:${entry.cle} (${slug})`).toBeDefined()

          const { schema } = sectionTypeDefinition(entry.type)
          const result = schema.safeParse(donnees)
          if (!result.success) {
            throw new Error(
              `${entry.page}:${entry.cle} (${slug}) ne passe pas son schéma "${entry.type}" : ` +
                result.error.issues.map((issue) => `${issue.path.join('.')} — ${issue.message}`).join('; '),
            )
          }
        })
      }
    })
  }

  it('has no duplicate (page, cle, site) triple across the catalog', () => {
    const seen = new Set<string>()
    for (const slug of SITE_SLUGS) {
      for (const entry of catalogPourSite(slug)) {
        const key = `${slug}:${entry.page}:${entry.cle}`
        expect(seen.has(key), `entrée en double : ${key}`).toBe(false)
        seen.add(key)
      }
    }
  })
})
