import 'dotenv/config'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { PrismaPg } from '@prisma/adapter-pg'
import { CompanyType, PrismaClient, Role } from '../server/generated/prisma/client'

// Même driver et mêmes options par défaut que nuxt-auth-utils (hashPassword/verifyPassword) :
// les hash produits ici sont vérifiables par le serveur. `#auth-utils` n'est pas importable
// hors du contexte Nitro, d'où l'usage direct de @adonisjs/hash.
const hasher = new Hash(new Scrypt({}))

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variable d'environnement ${name} manquante — voir .env.example`)
  return value
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
})

const FILIALES = [
  { slug: 'entretien', nom: 'Chaudetcha Entretiens et Sanitations', couleurAccent: '#0F6E56', secteur: 'Entretien ménager résidentiel et commercial' },
  { slug: 'transport', nom: 'Chaudetcha Transport et Logistique', couleurAccent: '#D85A30', secteur: 'Transport de marchandises, déménagement, logistique' },
  { slug: 'comptable', nom: 'CD Tenue de Livre Comptable', couleurAccent: '#185FA5', secteur: 'Comptabilité, paie, déclarations fiscales' },
  { slug: 'placement', nom: 'Placement CD Pro', couleurAccent: '#D4537E', secteur: 'Placement de personnel et recrutement' },
  { slug: 'ccdpaa', nom: 'CCDPAA', couleurAccent: '#BA7517', secteur: "Import-export de produits agricoles d'Afrique" },
  { slug: 'boissons', nom: "CD Boissons d'Afrique", couleurAccent: '#A32D2D', secteur: 'Représentation et distribution de boissons' },
] as const

async function main(): Promise<void> {
  const holding = await prisma.company.upsert({
    where: { slug: 'holding' },
    update: {},
    create: {
      type: CompanyType.HOLDING,
      slug: 'holding',
      nom: 'Groupe CD',
      description: 'Groupe de sociétés montréalais.',
      couleurAccent: '#1B2A4A',
    },
  })

  const companies: Record<string, { id: string }> = { holding }
  for (const f of FILIALES) {
    companies[f.slug] = await prisma.company.upsert({
      where: { slug: f.slug },
      update: {},
      create: { type: CompanyType.FILIALE, ...f },
    })
  }

  const entretienId = companies.entretien?.id
  if (!entretienId) throw new Error('Filiale entretien absente après upsert')

  // 3 comptes de démo — un par rôle. Mots de passe lus depuis .env, jamais en dur.
  const demoUsers = [
    { email: 'admin@groupecd.ca', nom: 'Admin Groupe CD', role: Role.SUPER_ADMIN, companyId: null, passwordEnv: 'SEED_SUPER_ADMIN_PASSWORD' },
    { email: 'admin@entretien.groupecd.ca', nom: 'Admin Entretien', role: Role.ADMIN_FILIALE, companyId: entretienId, passwordEnv: 'SEED_ADMIN_FILIALE_PASSWORD' },
    { email: 'employe@entretien.groupecd.ca', nom: 'Employé Entretien', role: Role.EMPLOYE, companyId: entretienId, passwordEnv: 'SEED_EMPLOYE_PASSWORD' },
  ] as const

  for (const { passwordEnv, ...user } of demoUsers) {
    const passwordHash = await hasher.make(requireEnv(passwordEnv))
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash },
    })
  }

  // Messages de démo : un par filiale ciblée, pour vérifier le scoping de /api/admin/messages
  const demoMessages = [
    { slug: 'entretien', nom: 'Marie Tremblay', email: 'marie@example.com', sujet: 'Soumission bureau', message: "Bonjour, j'aimerais une soumission pour l'entretien de nos bureaux (800 pi²)." },
    { slug: 'transport', nom: 'Jean Gagnon', email: 'jean@example.com', sujet: 'Déménagement', message: 'Déménagement commercial prévu le mois prochain, êtes-vous disponibles ?' },
  ] as const

  for (const { slug, ...message } of demoMessages) {
    const companyId = companies[slug]?.id
    if (!companyId) continue
    const exists = await prisma.messageContact.findFirst({ where: { companyId, email: message.email } })
    if (!exists) {
      await prisma.messageContact.create({ data: { ...message, companyId } })
    }
  }

  console.info('Seed terminé.')
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
