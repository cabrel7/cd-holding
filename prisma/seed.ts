// Point d'entrée du seed (spec phase 2 §2) : orchestre prisma/seed/*.ts. Toujours en
// "amorçage" — création si absent, jamais de mise à jour d'une ligne existante (les éditions
// admin ne sont jamais écrasées, les suppressions jamais ressuscitées). Lancé explicitement
// (`pnpm db:seed`), jamais automatiquement (Prisma 7).
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../server/generated/prisma/client'
import { seedCompanies } from './seed/companies'
import { seedAccounts } from './seed/accounts'
import { seedContenu } from './seed/contenu'
import { seedSections } from './seed/sections'
import { seedReglages } from './seed/reglages'
import { seedDemo } from './seed/demo'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variable d'environnement ${name} manquante — voir .env.example`)
  return value
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
})

async function main(): Promise<void> {
  const companies = await seedCompanies(prisma)
  await seedAccounts(prisma, companies)
  await seedContenu(prisma, companies)
  await seedSections(prisma, companies)
  await seedReglages(prisma, companies)

  if (process.env.SEED_DEMO_DATA === 'true') {
    await seedDemo(prisma, companies)
    console.info('Seed terminé (avec données de démonstration).')
  } else {
    console.info('Seed terminé (SEED_DEMO_DATA non activé — pas de données de démo).')
  }
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
