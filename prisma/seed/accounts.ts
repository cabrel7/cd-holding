// Comptes du dashboard (spec §2) : SUPER_ADMIN toujours ; ADMIN_FILIALE (entretien, ccdpaa) et
// EMPLOYE (lié à l'Employe "Awa Diallo", DEC-29 — liaison faite par seedDemo, qui possède la
// ligne Employe) seulement si SEED_DEMO_DATA=true. Mots de passe lus depuis .env, jamais en dur —
// même driver de hash que nuxt-auth-utils (`#auth-utils` non importable hors contexte Nitro).
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { Role, type PrismaClient } from '../../server/generated/prisma/client'
import type { SeededCompanies } from './companies'

const hasher = new Hash(new Scrypt({}))

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variable d'environnement ${name} manquante — voir .env.example`)
  return value
}

interface DemoUser {
  readonly email: string
  readonly nom: string
  readonly role: (typeof Role)[keyof typeof Role]
  readonly companyId: number | null
  readonly passwordEnv: string
}

async function upsertUser(prisma: PrismaClient, user: DemoUser): Promise<void> {
  const passwordHash = await hasher.make(requireEnv(user.passwordEnv))
  await prisma.user.upsert({
    where: { email: user.email },
    update: {},
    create: { email: user.email, nom: user.nom, role: user.role, companyId: user.companyId, passwordHash },
  })
}

export async function seedAccounts(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  await upsertUser(prisma, {
    email: 'admin@groupecd.ca',
    nom: 'Admin Groupe CD',
    role: Role.SUPER_ADMIN,
    companyId: null,
    passwordEnv: 'SEED_SUPER_ADMIN_PASSWORD',
  })

  if (process.env.SEED_DEMO_DATA !== 'true') return

  await upsertUser(prisma, {
    email: 'admin@entretien.groupecd.ca',
    nom: 'Admin Entretien',
    role: Role.ADMIN_FILIALE,
    companyId: companies.filiales.entretien.id,
    passwordEnv: 'SEED_ADMIN_FILIALE_PASSWORD',
  })
  await upsertUser(prisma, {
    email: 'admin@ccdpaa.groupecd.ca',
    nom: 'Admin CCDPAA',
    role: Role.ADMIN_FILIALE,
    companyId: companies.filiales.ccdpaa.id,
    passwordEnv: 'SEED_ADMIN_FILIALE_PASSWORD',
  })
  await upsertUser(prisma, {
    email: 'employe@entretien.groupecd.ca',
    nom: 'Awa Diallo',
    role: Role.EMPLOYE,
    companyId: companies.filiales.entretien.id,
    passwordEnv: 'SEED_EMPLOYE_PASSWORD',
  })
}
