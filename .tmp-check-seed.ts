import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './server/generated/prisma/client'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL manquant')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  const [services, sections, companies, sites] = await Promise.all([
    prisma.service.count(),
    prisma.sectionContenu.count(),
    prisma.company.count(),
    prisma.company.findMany({ select: { slug: true, nom: true } }),
  ])
  console.log(JSON.stringify({ services, sections, companies, sites }, null, 2))
  await prisma.$disconnect()
}

main().catch((e: Error) => {
  console.error('ERR', e.message)
  process.exit(1)
})
