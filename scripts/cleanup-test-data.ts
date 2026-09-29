// Nettoie les données créées par scripts/api-check.mjs (messages de contact de test,
// lignes Fichier + fichiers physiques dans storage/uploads) après une vérification runtime.
// N'importe et ne modifie AUCUN fichier de prod — utilise le même client Prisma généré que
// server/utils/prisma.ts, en lecture/écriture ciblée sur des uuid/key précis fournis en argument.
//
// Usage :
//   npx tsx scripts/cleanup-test-data.ts --message-uuid <uuid> [--message-uuid <uuid> ...] \
//                                          --file-key <key> [--file-key <key> ...]
//   npx tsx scripts/cleanup-test-data.ts --contact-email test-runtime-check@example.com
//
// Lot 3 (e2e placement / restaurant) :
//   --candidature-email <e>   supprime les Candidature de cet e-mail + leurs Fichier (cv, autres
//                             documents) + objets stockés
//   --reservation-email <e>   supprime les ReservationRestaurant de cet e-mail
//   --offre-titre <t>         supprime les offres de test (DemandeClient placement) de ce titre et
//                             leurs candidatures (+ Fichier + objets stockés)
//   --creer-offre <t>         crée une offre de test publiée (placement) et imprime son uuid
//   --retirer-offre <uuid>    dépublie une offre (publiee=false)
//   --inspect-candidature-email <e>  imprime en JSON les champs vérifiables de la candidature
//   --inspect-reservation-email <e>  imprime en JSON les réservations (dateReservation ISO)
//   --count-fichiers-placement       imprime le nombre de Fichier de placement (détection d'orphelins)
//
// Lot 4 (e2e admin messages / clients) — marqueur = suffixe unique en minuscules ; toutes les
// lignes créées ont un e-mail se terminant par `-<marqueur>@example.test` :
//   --seed-admin-messages <m>   crée 25 messages entretien (pagination) + transport (details
//                               réalistes) + holding + suggestion ccdpaa + contact ccdpaa
//   --seed-dossier <email>      crée un DossierComptable pour le client de cet e-mail
//   --purge-admin-data <m>      supprime messages ET clients (dossiers en cascade) du marqueur
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

const MARQUEUR_OFFRE_TEST = 'E2E'

/** Supprime les lignes Fichier + objets stockés (même abstraction fs que --file-key). */
async function supprimerFichiersParCle(keys: string[]): Promise<void> {
  if (!keys.length) return
  const uploadsDir = process.env.NUXT_UPLOADS_DIR ?? join(process.cwd(), 'storage', 'uploads')
  for (const key of keys) {
    const res = await prisma.fichier.deleteMany({ where: { key } })
    const filePath = join(uploadsDir, key)
    const existed = existsSync(filePath)
    if (existed) rmSync(filePath)
    console.log(`Fichier ${key} : lignes DB supprimées=${res.count}, fichier disque supprimé=${existed}`)
  }
}

async function supprimerCandidatures(where: { email?: { in: string[] }; demandeId?: { in: number[] } }): Promise<void> {
  const rows = await prisma.candidature.findMany({ where, select: { id: true, cvKey: true, autresDocumentsKeys: true } })
  if (!rows.length) {
    console.log('Candidature supprimées : 0')
    return
  }
  await prisma.candidature.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  console.log(`Candidature supprimées : ${rows.length}`)
  await supprimerFichiersParCle(rows.flatMap((r) => [r.cvKey, ...r.autresDocumentsKeys]))
}

const NOMBRE_MESSAGES_PAGINATION = 25
const MINUTE_MS = 60_000

async function companyId(slug: string): Promise<number> {
  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true } })
  if (!company) throw new Error(`Filiale ${slug} introuvable`)
  return company.id
}

async function seedAdminMessages(marker: string): Promise<void> {
  const [entretien, transport, holding, ccdpaa] = await Promise.all(
    ['entretien', 'transport', 'holding', 'ccdpaa'].map((slug) => companyId(slug)),
  )
  const now = Date.now()
  const pagination = Array.from({ length: NOMBRE_MESSAGES_PAGINATION }, (_, i) => {
    const n = String(i + 1).padStart(2, '0')
    return {
      companyId: entretien,
      nom: `Pagination ${n}`,
      email: `pag-${n}-${marker}@example.test`,
      sujet: `Pagination ${marker}`,
      message: `Message de pagination numéro ${n}.`,
      createdAt: new Date(now - (i + 10) * MINUTE_MS),
    }
  })
  await prisma.messageContact.createMany({ data: pagination })
  await prisma.messageContact.createMany({
    data: [
      {
        companyId: transport,
        nom: 'Jean Transport',
        email: `transport-${marker}@example.test`,
        telephone: '514-555-0123',
        entreprise: 'Entreprise Test E2E',
        sujet: 'Demande de devis — transport',
        message: 'Besoin de déménager nos bureaux.',
        details: {
          typeTransport: 'demenagement-commercial',
          dateSouhaitee: '2026-11-12',
          origine: 'Montréal',
          destination: 'Laval',
          formulaire: 'transport',
        },
        createdAt: new Date(now - 2 * MINUTE_MS),
      },
      {
        companyId: holding,
        nom: 'Holding Contact',
        email: `holding-${marker}@example.test`,
        sujet: 'Demande — Groupe (via le site du groupe)',
        message: 'Question générale pour le groupe.',
        details: { formulaire: 'holding' },
        createdAt: new Date(now - 3 * MINUTE_MS),
      },
      {
        companyId: ccdpaa,
        nom: 'Suggestion Produit',
        email: `suggestion-${marker}@example.test`,
        sujet: 'Suggestion de produit',
        message: 'Demande de suggestion e2e.',
        type: 'SUGGESTION_PRODUIT' as const,
        produitSouhaite: 'Karité brut E2E',
        paysOrigine: 'Mali',
        details: { formulaire: 'suggestion' },
        createdAt: new Date(now - 4 * MINUTE_MS),
      },
      {
        companyId: entretien,
        nom: 'Casse Client',
        email: `Client.Casse-${marker}@Example.TEST`,
        sujet: 'Conversion e2e (courriel en casse mixte)',
        message: 'Message dont le courriel a des majuscules.',
        details: { formulaire: 'entretien' },
        createdAt: new Date(now - 6 * MINUTE_MS),
      },
      {
        companyId: ccdpaa,
        nom: 'Contact Ccdpaa',
        email: `ccdpaa-${marker}@example.test`,
        sujet: 'Contact ccdpaa e2e',
        message: 'Message ccdpaa hors périmètre entretien.',
        details: { formulaire: 'ccdpaa' },
        createdAt: new Date(now - 5 * MINUTE_MS),
      },
    ],
  })
  console.log(`Messages admin créés pour ${marker} : ${pagination.length + 5}`)
}

async function main() {
  const candidatureEmails = argValues('--candidature-email')
  const reservationEmails = argValues('--reservation-email')
  const offreTitres = argValues('--offre-titre')
  const creerOffre = argValues('--creer-offre')
  const retirerOffre = argValues('--retirer-offre')
  const inspectCandidature = argValues('--inspect-candidature-email')
  const inspectReservation = argValues('--inspect-reservation-email')
  const countFichiers = process.argv.includes('--count-fichiers-placement')
  const seedAdminMessagesArgs = argValues('--seed-admin-messages')
  const seedDossier = argValues('--seed-dossier')
  const purgeAdmin = argValues('--purge-admin-data')

  for (const marker of seedAdminMessagesArgs) await seedAdminMessages(marker)
  for (const email of seedDossier) {
    const client = await prisma.client.findFirst({ where: { email }, select: { id: true } })
    if (!client) throw new Error('Client introuvable pour le dossier de test')
    await prisma.dossierComptable.create({ data: { clientId: client.id } })
    console.log('DossierComptable créé : 1')
  }
  for (const marker of purgeAdmin) {
    const suffixe = { endsWith: `-${marker}@example.test`, mode: 'insensitive' as const }
    const clients = await prisma.client.deleteMany({ where: { email: suffixe } })
    const messages = await prisma.messageContact.deleteMany({ where: { email: suffixe } })
    console.log(`Purge ${marker} : clients=${clients.count}, messages=${messages.count}`)
  }

  if (creerOffre.length) {
    const placement = await prisma.company.findUnique({ where: { slug: 'placement' }, select: { id: true } })
    if (!placement) throw new Error('Filiale placement introuvable')
    const offre = await prisma.demandeClient.create({
      data: {
        companyId: placement.id,
        entrepriseCliente: `Client Secret ${MARQUEUR_OFFRE_TEST}`,
        posteRecherche: 'Manutentionnaire e2e',
        categorie: 'MANUTENTION',
        contactNom: 'Contact Secret E2E',
        contactEmail: 'contact-secret-e2e@example.test',
        contactTelephone: '514-555-0199',
        description: 'Description interne e2e (ne doit jamais être publique).',
        publiee: true,
        statut: 'OUVERTE',
        titreOffre: creerOffre[0],
        lieu: 'Laval (Québec)',
        typeContrat: 'TEMPS_PLEIN',
        salaire: '22 $/h',
        descriptionPublique: 'Poste de test créé par la suite e2e placement-offres.',
        publieeLe: new Date(),
      },
      select: { uuid: true },
    })
    console.log(`OFFRE_UUID=${offre.uuid}`)
  }
  if (retirerOffre.length) {
    const res = await prisma.demandeClient.updateMany({ where: { uuid: { in: retirerOffre } }, data: { publiee: false } })
    console.log(`Offres dépubliées : ${res.count}`)
  }
  if (inspectCandidature.length) {
    const rows = await prisma.candidature.findMany({
      where: { email: { in: inspectCandidature } },
      select: {
        posteRecherche: true, posteAutrePrecision: true, categorie: true, consentementLe: true, statut: true, pays: true,
        cvKey: true, autresDocumentsKeys: true, demande: { select: { uuid: true } },
        cv: { select: { visibilite: true, mimeType: true, nomOriginal: true, company: { select: { slug: true } } } },
      },
    })
    console.log(`INSPECT_JSON=${JSON.stringify(rows)}`)
  }
  if (inspectReservation.length) {
    const rows = await prisma.reservationRestaurant.findMany({
      where: { email: { in: inspectReservation } },
      select: { nombrePersonnes: true, dateReservation: true, statut: true, notes: true },
    })
    console.log(`INSPECT_JSON=${JSON.stringify(rows)}`)
  }
  if (countFichiers) {
    const placement = await prisma.company.findUnique({ where: { slug: 'placement' }, select: { id: true } })
    const n = placement ? await prisma.fichier.count({ where: { companyId: placement.id } }) : 0
    console.log(`COUNT_FICHIERS=${n}`)
  }

  if (candidatureEmails.length) {
    await supprimerCandidatures({ email: { in: candidatureEmails } })
  }
  if (reservationEmails.length) {
    const res = await prisma.reservationRestaurant.deleteMany({ where: { email: { in: reservationEmails } } })
    console.log(`ReservationRestaurant supprimées : ${res.count}`)
  }
  if (offreTitres.length) {
    const offres = await prisma.demandeClient.findMany({
      where: { titreOffre: { in: offreTitres }, entrepriseCliente: { contains: MARQUEUR_OFFRE_TEST } },
      select: { id: true },
    })
    const ids = offres.map((o) => o.id)
    if (ids.length) await supprimerCandidatures({ demandeId: { in: ids } })
    const res = await prisma.demandeClient.deleteMany({ where: { id: { in: ids } } })
    console.log(`DemandeClient (offres de test) supprimées : ${res.count}`)
  }

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

  const aFaitQuelqueChose =
    messageUuids.length || contactEmails.length || fileKeys.length || candidatureEmails.length || reservationEmails.length ||
    offreTitres.length || creerOffre.length || retirerOffre.length || inspectCandidature.length || inspectReservation.length || countFichiers ||
    seedAdminMessagesArgs.length || seedDossier.length || purgeAdmin.length
  if (!aFaitQuelqueChose) {
    console.log('Rien à nettoyer (aucun argument reconnu fourni).')
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
