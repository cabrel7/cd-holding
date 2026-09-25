// Nettoie les données créées par scripts/api-check.mjs (messages de contact de test,
// lignes Fichier + fichiers physiques dans storage/uploads) après une vérification runtime.
// N'importe et ne modifie AUCUN fichier de prod — utilise le même client Prisma généré que
// server/utils/prisma.ts, en lecture/écriture ciblée sur des uuid/key précis fournis en argument.
//
// Usage :
//   npx tsx scripts/cleanup-test-data.ts --message-uuid <uuid> [--message-uuid <uuid> ...] \
//                                          --file-key <key> [--file-key <key> ...]
//   npx tsx scripts/cleanup-test-data.ts --contact-email test-runtime-check@example.com
import 'dotenv/config'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../server/generated/prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL manquant')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

function argValues(name: string): string[] {
  const out: string[] = []
  const argv = process.argv.slice(2)
  argv.forEach((a, i) => {
    if (a === name) out.push(argv[i + 1])
  })
  return out
}

async function main() {
  const messageUuids = argValues('--message-uuid')
  const fileKeys = argValues('--file-key')
  const contactEmails = argValues('--contact-email')

  if (messageUuids.length) {
    const res = await prisma.messageContact.deleteMany({ where: { uuid: { in: messageUuids } } })
    console.log(`MessageContact supprimés par uuid : ${res.count}`)
  }
  if (contactEmails.length) {
    const res = await prisma.messageContact.deleteMany({ where: { email: { in: contactEmails } } })
    console.log(`MessageContact supprimés par email : ${res.count}`)
  }
  if (fileKeys.length) {
    const uploadsDir = process.env.NUXT_UPLOADS_DIR ?? join(process.cwd(), 'storage', 'uploads')
    for (const key of fileKeys) {
      const res = await prisma.fichier.deleteMany({ where: { key } })
      const filePath = join(uploadsDir, key)
      const existed = existsSync(filePath)
      if (existed) rmSync(filePath)
      console.log(`Fichier ${key} : lignes DB supprimées=${res.count}, fichier disque supprimé=${existed}`)
    }
  }

  if (!messageUuids.length && !contactEmails.length && !fileKeys.length) {
    console.log('Rien à nettoyer (aucun --message-uuid / --contact-email / --file-key fourni).')
  }
}

main()
  .catch((err) => {
    console.error('ERREUR cleanup-test-data.ts:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
