// Amorce la holding et les 6 filiales (spec §2 : "upsert par slug, update: {} (inchangé)").
// `nom`, `secteur`, `couleurAccent` et `type` ne sont JAMAIS modifiés après création — seule
// la création initiale les fixe (CLAUDE.md : couleurAccent non éditable ; contenu.ts complète
// séparément les colonnes ajoutées en phase 2, en amorçage, sans jamais toucher ces 3 champs).
import { CompanyType, type PrismaClient } from '../../server/generated/prisma/client'

// Secteur affiché publiquement : aligné sur PROJECT_CONTEXT.md §2 (comptable : mention de la
// création/régularisation d'entreprise ; cdpaa : mention du restaurant), PAS sur
// `secteurPrototype` du générateur (explicitement informatif, jamais semé — spec §3.2).
const FILIALES = [
  { slug: 'entretien', nom: 'Chaudetcha Entretiens et Sanitations', couleurAccent: '#0F6E56', secteur: 'Entretien ménager résidentiel et commercial' },
  { slug: 'transport', nom: 'Chaudetcha Transport et Logistique', couleurAccent: '#D85A30', secteur: 'Transport de marchandises, déménagement, logistique' },
  { slug: 'comptable', nom: 'CD Tenue de Livre Comptable', couleurAccent: '#185FA5', secteur: 'Comptabilité, paie, déclarations fiscales, création et régularisation d’entreprise' },
  { slug: 'placement', nom: 'Placement CD Pro', couleurAccent: '#D4537E', secteur: 'Placement de personnel et recrutement de travailleurs étrangers temporaires' },
  { slug: 'cdpaa', nom: 'CDPAA', couleurAccent: '#BA7517', secteur: 'Import-export de produits agricoles d’Afrique et restaurant Les Ambassades d’Afrique' },
  { slug: 'boissons', nom: "CD Boissons d'Afrique", couleurAccent: '#A32D2D', secteur: 'Représentation et distribution de boissons' },
] as const

export interface SeededCompanies {
  readonly holding: { readonly id: number; readonly slug: string }
  readonly filiales: Readonly<Record<(typeof FILIALES)[number]['slug'], { readonly id: number; readonly slug: string }>>
  readonly bySlug: ReadonlyMap<string, { readonly id: number; readonly slug: string }>
}

export async function seedCompanies(prisma: PrismaClient): Promise<SeededCompanies> {
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
    select: { id: true, slug: true },
  })

  const bySlug = new Map<string, { id: number; slug: string }>([[holding.slug, holding]])
  const filialesEntries: [string, { id: number; slug: string }][] = []

  for (const f of FILIALES) {
    const company = await prisma.company.upsert({
      where: { slug: f.slug },
      update: {},
      create: { type: CompanyType.FILIALE, slug: f.slug, nom: f.nom, secteur: f.secteur, couleurAccent: f.couleurAccent },
      select: { id: true, slug: true },
    })
    bySlug.set(f.slug, company)
    filialesEntries.push([f.slug, company])
  }

  return {
    holding,
    filiales: Object.fromEntries(filialesEntries) as SeededCompanies['filiales'],
    bySlug,
  }
}
