// Amorce le contenu "collection" (spec §2/§3.3) : colonnes Company ajoutées en phase 2
// (si null), puis Service/Realisation/MembreEquipe/Partenaire (si la filiale n'a encore aucune
// ligne de cette entité). Ne touche JAMAIS `nom`, `secteur`, `couleurAccent` (déjà fixés par
// companies.ts). Import relatif de shared/config/sites (contrainte seed, tsx hors Nuxt).
import { FILIALE_SLUGS, type FilialeSlug } from '../../shared/config/sites'
import type { PrismaClient } from '../../server/generated/prisma/client'
import { GENERATED } from '../seed-data/prototype.generated'
import type { GeneratedService } from '../seed-data/types'
import { seedImage } from './fichiers'
import type { SeededCompanies } from './companies'

const ADRESSE_PAR_DEFAUT = 'Montréal, Québec, Canada'
// components/holding/Hero.tsx:93 — image du siège social, holding.
const HOLDING_HERO_IMAGE_ID = '1519501025264-65ba15a82390'
const RESTAURANT_TITRE = 'Restaurant Les Ambassades d’Afrique'

export async function seedContenu(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  await fillHoldingColumns(prisma, companies)
  await fillFilialeColumns(prisma, companies)
  await seedServices(prisma, companies)
  await seedRealisations(prisma, companies)
  await seedEquipe(prisma, companies)
  await seedPartenaires(prisma, companies)
}

async function fillHoldingColumns(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  const current = await prisma.company.findUniqueOrThrow({
    where: { id: companies.holding.id },
    select: { nomCourt: true, adresse: true, heroImageKey: true, ordre: true },
  })

  const patch: { nomCourt?: string; adresse?: string; heroImageKey?: string } = {}
  if (current.nomCourt === null) patch.nomCourt = 'Groupe CD'
  if (current.adresse === null) patch.adresse = ADRESSE_PAR_DEFAUT
  if (current.heroImageKey === null) patch.heroImageKey = await seedImage(prisma, companies.holding.id, HOLDING_HERO_IMAGE_ID)

  if (Object.keys(patch).length > 0) {
    await prisma.company.update({ where: { id: companies.holding.id }, data: patch })
  }
}

async function fillFilialeColumns(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  const bySlug = new Map(GENERATED.companies.map((c) => [c.slug, c] as const))
  const subConfigBySlug = new Map(GENERATED.subConfig.map((s) => [s.filiale, s] as const))

  for (const [index, slug] of FILIALE_SLUGS.entries()) {
    const company = companies.filiales[slug]
    const generated = bySlug.get(slug)
    const subConfig = subConfigBySlug.get(slug)
    if (!generated || !subConfig) throw new Error(`Filiale "${slug}" absente de prototype.generated.ts`)

    const current = await prisma.company.findUniqueOrThrow({
      where: { id: company.id },
      select: { description: true, nomCourt: true, heroImageKey: true, effectif: true, ordre: true, adresse: true },
    })

    const patch: {
      description?: string
      nomCourt?: string
      heroImageKey?: string
      effectif?: number
      ordre?: number
      adresse?: string
    } = {}
    if (current.description === null) patch.description = generated.description
    if (current.nomCourt === null) patch.nomCourt = subConfig.shortName
    if (current.heroImageKey === null) patch.heroImageKey = await seedImage(prisma, company.id, generated.heroImageId)
    if (current.effectif === null) patch.effectif = generated.effectif
    // `ordre` a un défaut 0 (non nullable) : 0 sert de sentinelle "pas encore amorcé" pour les
    // filiales (holding conserve légitimement 0, jamais retouché ici).
    if (current.ordre === 0) patch.ordre = index + 1
    if (current.adresse === null) patch.adresse = ADRESSE_PAR_DEFAUT

    if (Object.keys(patch).length > 0) {
      await prisma.company.update({ where: { id: company.id }, data: patch })
    }
  }
}

async function seedServices(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  const byFiliale = new Map<FilialeSlug, GeneratedService[]>()
  for (const service of GENERATED.services) {
    const list = byFiliale.get(service.filiale) ?? []
    list.push(service)
    byFiliale.set(service.filiale, list)
  }

  for (const slug of FILIALE_SLUGS) {
    const company = companies.filiales[slug]
    const count = await prisma.service.count({ where: { companyId: company.id } })
    if (count > 0) continue

    const services = [...(byFiliale.get(slug) ?? [])].sort((a, b) => a.ordre - b.ordre)
    // Retour client (Q-05, spec §3.3) : le service "supermarchés" de la filiale entretien passe
    // en premier (ordre 0), les autres services de la filiale décalent d'un cran.
    const supermarches = services.find((s) => s.titre.toLowerCase().includes('supermarch'))
    const ordonnes = supermarches ? [supermarches, ...services.filter((s) => s !== supermarches)] : services

    // "Mis en avant" par défaut : les 3 premiers par ordre final, sauf le service Restaurant de
    // ccdpaa (le restaurant n'est jamais mis en avant sur la page services — spec §3.3, point ouvert #13).
    const eligibles = ordonnes.filter((s) => !(slug === 'ccdpaa' && s.titre === RESTAURANT_TITRE))
    const misEnAvantTitres = new Set(eligibles.slice(0, 3).map((s) => s.titre))

    await prisma.service.createMany({
      data: ordonnes.map((s, i) => ({
        companyId: company.id,
        titre: s.titre,
        description: s.description,
        ordre: i,
        misEnAvant: misEnAvantTitres.has(s.titre),
      })),
    })
  }
}

async function seedRealisations(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  for (const company of [companies.holding, ...Object.values(companies.filiales)]) {
    const count = await prisma.realisation.count({ where: { companyId: company.id } })
    if (count > 0) continue

    const realisations = GENERATED.realisations
      .filter((r) => r.filiale === company.slug)
      .sort((a, b) => a.ordre - b.ordre)
    if (realisations.length === 0) continue

    for (const r of realisations) {
      const imageKey = await seedImage(prisma, company.id, r.imageId)
      await prisma.realisation.create({
        data: {
          companyId: company.id,
          titre: r.titre,
          description: r.description,
          imageKey,
          dateRealisation: new Date(`${r.date}T00:00:00Z`),
          ordre: r.ordre,
        },
      })
    }
  }
}

async function seedEquipe(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  for (const company of [companies.holding, ...Object.values(companies.filiales)]) {
    const count = await prisma.membreEquipe.count({ where: { companyId: company.id } })
    if (count > 0) continue

    const membres = GENERATED.equipe.filter((m) => m.filiale === company.slug)
    if (membres.length === 0) continue

    await prisma.membreEquipe.createMany({
      data: membres.map((m) => ({ companyId: company.id, nom: m.nom, poste: m.poste, bio: m.bio, ordre: m.ordre })),
    })
  }
}

async function seedPartenaires(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  for (const company of [companies.holding, ...Object.values(companies.filiales)]) {
    const count = await prisma.partenaire.count({ where: { companyId: company.id } })
    if (count > 0) continue

    const partenaires = GENERATED.partenaires.filter((p) => p.filiale === company.slug)
    if (partenaires.length === 0) continue

    await prisma.partenaire.createMany({
      data: partenaires.map((p) => ({ companyId: company.id, nom: p.nom, typeRelation: p.typeRelation, ordre: p.ordre })),
    })
  }
}
