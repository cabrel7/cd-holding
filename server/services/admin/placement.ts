// Service admin "placement" (lot 5) : candidats (vivier), demandes clientes (dont publication
// comme offre publique) et candidatures reçues. Aucune référence à l'event H3 : les handlers
// (server/api/admin/placement/**) font `requireModule` + validation zod, puis appellent ces
// fonctions. Le scoping est systématique sur `ctx.company.id` (la filiale placement — déjà
// épinglée par requireModule, SUPER_ADMIN compris).
import { ADMIN_PAGE_SIZE, MATCH_CANDIDATS_LIMIT } from '#shared/config/admin'
import { formatDateISO } from '#shared/utils/dates'
import type {
  AdminAffectationDto,
  AdminCandidatDto,
  AdminCandidatureDto,
  AdminCorrespondantDto,
  AdminDemandeDto,
  AdminFichierDto,
  AdminPage,
  CategoriePosteDto,
  NiveauExperienceDto,
  OrigineCandidatDto,
  StatutCandidatDto,
  StatutCandidatureDto,
} from '#shared/types/admin'
import type {
  AffectationCreateInput,
  CandidatCreateInput,
  CandidatsQuery,
  CandidatUpdateInput,
  CandidatureUpdateInput,
  CandidaturesQuery,
  DemandeCreateInput,
  DemandesQuery,
  DemandeUpdateInput,
} from '#shared/validation/placement'
import type { Prisma } from '../../generated/prisma/client'
import { anonymiserCandidatureParId } from '../../lib/anonymisation'
import { buildPage, isUniqueViolation, pageArgs } from '../../lib/admin/pagination'
import { invalidatePublicPages } from '../../utils/isr'
import { saveUploadedFile, supprimerFichiers, uploadsStorage } from '../../utils/storage'
import { toSiteSlug, type ModuleAuthContext } from '../../utils/site-scope'

// --- Selects explicites (jamais id/FK numériques exposés) ----

const COMPANY_REF_SELECT = { select: { uuid: true, slug: true, nom: true } } as const

export const CANDIDAT_SELECT = {
  uuid: true,
  nomComplet: true,
  email: true,
  telephone: true,
  posteRecherche: true,
  categorie: true,
  disponibilite: true,
  statut: true,
  origine: true,
  notes: true,
  cvKey: true,
  anonymiseLe: true,
  createdAt: true,
  company: COMPANY_REF_SELECT,
} as const

// `id` et `demandeId` servent uniquement au regroupement en mémoire — jamais dans un DTO.
export const DEMANDE_SELECT = {
  id: true,
  uuid: true,
  entrepriseCliente: true,
  posteRecherche: true,
  categorie: true,
  posteAutrePrecision: true,
  recrutementInternational: true,
  contactNom: true,
  contactEmail: true,
  contactTelephone: true,
  nombrePostes: true,
  dateDebut: true,
  description: true,
  publiee: true,
  statut: true,
  titreOffre: true,
  lieu: true,
  typeContrat: true,
  salaire: true,
  descriptionPublique: true,
  publieeLe: true,
  createdAt: true,
  company: COMPANY_REF_SELECT,
} as const

export const CANDIDATURE_SELECT = {
  uuid: true,
  nomComplet: true,
  email: true,
  telephone: true,
  adresseComplete: true,
  posteRecherche: true,
  posteAutrePrecision: true,
  categorie: true,
  experience: true,
  pays: true,
  message: true,
  statut: true,
  dateEnvoi: true,
  anonymiseLe: true,
  cvKey: true,
  autresDocumentsKeys: true,
  demande: { select: { titreOffre: true } },
  company: COMPANY_REF_SELECT,
} as const

const AFFECTATION_SELECT = {
  uuid: true,
  demandeId: true,
  dateAffectation: true,
  candidat: { select: { uuid: true, nomComplet: true } },
} as const

type CandidatRow = Prisma.CandidatGetPayload<{ select: typeof CANDIDAT_SELECT }>
type DemandeRow = Prisma.DemandeClientGetPayload<{ select: typeof DEMANDE_SELECT }>
type CandidatureRow = Prisma.CandidatureGetPayload<{ select: typeof CANDIDATURE_SELECT }>
type AffectationRow = Prisma.AffectationGetPayload<{ select: typeof AFFECTATION_SELECT }>

// --- Interfaçages de mapping (découplés du payload Prisma : testables sans DB) ----

export interface CompanyMapRef {
  readonly uuid: string
  readonly slug: string
  readonly nom: string
}

export interface CandidatMapRow {
  readonly uuid: string
  readonly nomComplet: string | null
  readonly email: string | null
  readonly telephone: string | null
  readonly posteRecherche: string | null
  readonly categorie: CategoriePosteDto
  readonly disponibilite: string | null
  readonly statut: StatutCandidatDto
  readonly origine: OrigineCandidatDto
  readonly notes: string | null
  readonly cvKey: string | null
  readonly anonymiseLe: Date | null
  readonly createdAt: Date
  readonly company: CompanyMapRef
}

export interface DemandeMapRow {
  readonly uuid: string
  readonly entrepriseCliente: string
  readonly posteRecherche: string
  readonly categorie: CategoriePosteDto
  readonly posteAutrePrecision: string | null
  readonly recrutementInternational: boolean
  readonly contactNom: string
  readonly contactEmail: string
  readonly contactTelephone: string | null
  readonly nombrePostes: number
  readonly dateDebut: Date | null
  readonly description: string
  readonly publiee: boolean
  readonly statut: 'OUVERTE' | 'POURVUE' | 'ANNULEE'
  readonly titreOffre: string | null
  readonly lieu: string | null
  readonly typeContrat: 'TEMPS_PLEIN' | 'TEMPS_PARTIEL' | 'TEMPORAIRE' | null
  readonly salaire: string | null
  readonly descriptionPublique: string | null
  readonly publieeLe: Date | null
  readonly createdAt: Date
  readonly company: CompanyMapRef
}

export interface CandidatureMapRow {
  readonly uuid: string
  readonly nomComplet: string | null
  readonly email: string | null
  readonly telephone: string | null
  readonly adresseComplete: string | null
  readonly posteRecherche: string
  readonly posteAutrePrecision: string | null
  readonly categorie: CategoriePosteDto
  readonly experience: NiveauExperienceDto | null
  readonly pays: string
  readonly message: string | null
  readonly statut: StatutCandidatureDto
  readonly dateEnvoi: Date
  readonly anonymiseLe: Date | null
  readonly cvKey: string | null
  readonly demande: { readonly titreOffre: string | null } | null
  readonly company: CompanyMapRef
}

function siteRef(company: CompanyMapRef) {
  return { uuid: company.uuid, slug: toSiteSlug(company.slug), nom: company.nom }
}

// --- Mappers (exports publics : réutilisés par les tâches/tests) ----

export function toCandidatDto(row: CandidatMapRow): AdminCandidatDto {
  const anonymise = row.anonymiseLe !== null
  return {
    uuid: row.uuid,
    // Masque défensif : une ligne anonymisée ne ré-expose jamais de PII, même si des données
    // patrimoniales ont survécu (par exemple pré-migration Loi 25).
    nomComplet: anonymise ? null : row.nomComplet,
    categorie: row.categorie,
    site: siteRef(row.company),
    email: anonymise ? null : row.email,
    telephone: anonymise ? null : row.telephone,
    posteRecherche: anonymise ? null : row.posteRecherche,
    disponibilite: anonymise ? null : row.disponibilite,
    statut: row.statut,
    origine: row.origine,
    notes: anonymise ? null : row.notes,
    aCv: row.cvKey !== null,
    anonymiseLe: row.anonymiseLe?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function toCorrespondantDto(row: CandidatMapRow): AdminCorrespondantDto {
  return {
    uuid: row.uuid,
    nomComplet: row.nomComplet,
    categorie: row.categorie,
    site: siteRef(row.company),
    posteRecherche: row.posteRecherche,
    disponibilite: row.disponibilite,
    statut: row.statut,
    origine: row.origine,
  }
}

function toAffectationDto(row: AffectationRow): AdminAffectationDto {
  return {
    uuid: row.uuid,
    candidatUuid: row.candidat.uuid,
    nomCompletCandidat: row.candidat.nomComplet,
    dateAffectation: row.dateAffectation.toISOString(),
  }
}

export function toDemandeDto(
  row: DemandeMapRow,
  correspondants: readonly AdminCorrespondantDto[] = [],
  affectations: readonly AdminAffectationDto[] = [],
): AdminDemandeDto {
  return {
    uuid: row.uuid,
    entrepriseCliente: row.entrepriseCliente,
    posteRecherche: row.posteRecherche,
    categorie: row.categorie,
    posteAutrePrecision: row.posteAutrePrecision,
    recrutementInternational: row.recrutementInternational,
    contactNom: row.contactNom,
    contactEmail: row.contactEmail,
    contactTelephone: row.contactTelephone,
    nombrePostes: row.nombrePostes,
    dateDebut: formatDateISO(row.dateDebut),
    description: row.description,
    publiee: row.publiee,
    statut: row.statut,
    titreOffre: row.titreOffre,
    lieu: row.lieu,
    typeContrat: row.typeContrat,
    salaire: row.salaire,
    descriptionPublique: row.descriptionPublique,
    publieeLe: row.publieeLe?.toISOString() ?? null,
    correspondants,
    affectations,
    site: siteRef(row.company),
    createdAt: row.createdAt.toISOString(),
  }
}

export function toCandidatureDto(row: CandidatureMapRow, documents: readonly AdminFichierDto[]): AdminCandidatureDto {
  const anonymise = row.anonymiseLe !== null
  return {
    uuid: row.uuid,
    nomComplet: anonymise ? null : row.nomComplet,
    email: anonymise ? null : row.email,
    telephone: anonymise ? null : row.telephone,
    adresseComplete: anonymise ? null : row.adresseComplete,
    posteRecherche: row.posteRecherche,
    posteAutrePrecision: anonymise ? null : row.posteAutrePrecision,
    categorie: row.categorie,
    experience: row.experience,
    pays: row.pays,
    message: anonymise ? null : row.message,
    statut: row.statut,
    offreTitre: row.demande?.titreOffre ?? null,
    aCv: row.cvKey !== null,
    documents,
    dateEnvoi: row.dateEnvoi.toISOString(),
    anonymiseLe: row.anonymiseLe?.toISOString() ?? null,
    site: siteRef(row.company),
  }
}

// --- Candidats (vivier) ------------------------------------------------------------------

const CONFLIT_EMAIL_CANDIDAT = 'Ce courriel existe déjà pour cette filiale.'

function whereRechercheCandidat(q: string): Prisma.CandidatWhereInput {
  return {
    OR: [
      { nomComplet: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { telephone: { contains: q, mode: 'insensitive' } },
      { posteRecherche: { contains: q, mode: 'insensitive' } },
    ],
  }
}

export async function listCandidats(ctx: ModuleAuthContext, query: CandidatsQuery): Promise<AdminPage<AdminCandidatDto>> {
  const where: Prisma.CandidatWhereInput = {
    companyId: ctx.company.id,
    ...(query.statut ? { statut: query.statut } : {}),
    ...(query.origine ? { origine: query.origine } : {}),
    ...(query.q ? whereRechercheCandidat(query.q) : {}),
  }
  const [total, rows] = await prisma.$transaction([
    prisma.candidat.count({ where }),
    prisma.candidat.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.page, ADMIN_PAGE_SIZE),
      select: CANDIDAT_SELECT,
    }),
  ])
  return buildPage(rows.map(toCandidatDto), total, query.page, ADMIN_PAGE_SIZE)
}

async function assertCandidatEmailLibre(companyId: number, email: string, excludeId?: number): Promise<void> {
  const existant = await prisma.candidat.findFirst({
    where: {
      companyId,
      email: { equals: email, mode: 'insensitive' },
      ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })
  if (existant) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL_CANDIDAT })
}

export async function createCandidat(ctx: ModuleAuthContext, data: CandidatCreateInput): Promise<AdminCandidatDto> {
  await assertCandidatEmailLibre(ctx.company.id, data.email)
  try {
    const row = await prisma.candidat.create({
      data: {
        companyId: ctx.company.id,
        nomComplet: data.nomComplet,
        email: data.email,
        telephone: data.telephone ?? null,
        posteRecherche: data.posteRecherche ?? null,
        categorie: data.categorie,
        disponibilite: data.disponibilite ?? null,
        statut: data.statut,
        origine: data.origine,
        notes: data.notes ?? null,
      },
      select: CANDIDAT_SELECT,
    })
    return toCandidatDto(row)
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL_CANDIDAT })
    throw error
  }
}

async function findCandidatOwnedOr404(
  ctx: ModuleAuthContext,
  uuid: string,
): Promise<{ id: number; cvKey: string | null; anonymiseLe: Date | null }> {
  const owner = await prisma.candidat.findFirst({
    where: { uuid, companyId: ctx.company.id },
    select: { id: true, cvKey: true, anonymiseLe: true },
  })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  return owner
}

export async function updateCandidat(
  ctx: ModuleAuthContext,
  uuid: string,
  data: CandidatUpdateInput,
): Promise<AdminCandidatDto> {
  const owner = await findCandidatOwnedOr404(ctx, uuid)
  // Loi 25 : un candidat anonymisé est un reste conservé, jamais ré-exposable (ni modifiable).
  if (owner.anonymiseLe !== null) throw createError({ statusCode: 409, statusMessage: 'Candidat anonymisé.' })
  const patch: Prisma.CandidatUpdateInput = {}
  if (data.nomComplet !== undefined) patch.nomComplet = data.nomComplet
  if (data.telephone !== undefined) patch.telephone = data.telephone
  if (data.posteRecherche !== undefined) patch.posteRecherche = data.posteRecherche
  if (data.categorie !== undefined) patch.categorie = data.categorie
  if (data.disponibilite !== undefined) patch.disponibilite = data.disponibilite
  if (data.statut !== undefined) patch.statut = data.statut
  if (data.origine !== undefined) patch.origine = data.origine
  if (data.notes !== undefined) patch.notes = data.notes
  if (data.email !== undefined) {
    await assertCandidatEmailLibre(ctx.company.id, data.email, owner.id)
    patch.email = data.email
  }
  try {
    const row = await prisma.candidat.update({ where: { id: owner.id }, data: patch, select: CANDIDAT_SELECT })
    return toCandidatDto(row)
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: CONFLIT_EMAIL_CANDIDAT })
    throw error
  }
}

/** Supprime le CV éventuel puis le candidat (affectations en cascade Prisma, candidatures SetNull). */
export async function deleteCandidat(ctx: ModuleAuthContext, uuid: string): Promise<void> {
  const owner = await findCandidatOwnedOr404(ctx, uuid)
  if (owner.cvKey !== null) await supprimerFichiers([owner.cvKey])
  await prisma.candidat.deleteMany({ where: { id: owner.id } })
}

// --- Demandes (dont publication comme offre) ---------------------------------------------

function whereRechercheDemande(q: string): Prisma.DemandeClientWhereInput {
  return {
    OR: [
      { entrepriseCliente: { contains: q, mode: 'insensitive' } },
      { contactNom: { contains: q, mode: 'insensitive' } },
      { posteRecherche: { contains: q, mode: 'insensitive' } },
    ],
  }
}

/**
 * Assemble les DTO de demandes en évitant le N+1 : une seule requête candidats pour toutes les
 * catégories concernées (top `MATCH_CANDIDATS_LIMIT` par catégorie) et une seule requête
 * affectations pour toutes les demandes de la page.
 */
async function assemblerDemandes(ctx: ModuleAuthContext, rows: readonly DemandeRow[]): Promise<AdminDemandeDto[]> {
  if (rows.length === 0) return []
  const ids = rows.map((row) => row.id)
  const categories = [...new Set(rows.map((row) => row.categorie))]

  const [candidats, affectations] = await Promise.all([
    prisma.candidat.findMany({
      where: {
        companyId: ctx.company.id,
        categorie: { in: categories },
        statut: { not: 'PLACE' },
        anonymiseLe: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: CANDIDAT_SELECT,
    }),
    prisma.affectation.findMany({
      where: { demandeId: { in: ids } },
      orderBy: [{ dateAffectation: 'desc' }, { id: 'desc' }],
      select: AFFECTATION_SELECT,
    }),
  ])

  const correspondantsParCategorie = new Map<string, AdminCorrespondantDto[]>()
  for (const candidat of candidats) {
    const liste = correspondantsParCategorie.get(candidat.categorie) ?? []
    if (liste.length >= MATCH_CANDIDATS_LIMIT) continue
    liste.push(toCorrespondantDto(candidat))
    correspondantsParCategorie.set(candidat.categorie, liste)
  }

  const affectationsParDemande = new Map<number, AdminAffectationDto[]>()
  for (const affectation of affectations) {
    const liste = affectationsParDemande.get(affectation.demandeId) ?? []
    liste.push(toAffectationDto(affectation))
    affectationsParDemande.set(affectation.demandeId, liste)
  }

  return rows.map((row) =>
    toDemandeDto(row, correspondantsParCategorie.get(row.categorie) ?? [], affectationsParDemande.get(row.id) ?? []),
  )
}

async function assemblerUneDemande(ctx: ModuleAuthContext, row: DemandeRow): Promise<AdminDemandeDto> {
  const [dto] = await assemblerDemandes(ctx, [row])
  if (!dto) throw createError({ statusCode: 500, statusMessage: 'Erreur serveur' })
  return dto
}

export async function listDemandes(ctx: ModuleAuthContext, query: DemandesQuery): Promise<AdminPage<AdminDemandeDto>> {
  const where: Prisma.DemandeClientWhereInput = {
    companyId: ctx.company.id,
    ...(query.statut ? { statut: query.statut } : {}),
    ...(query.publiee !== undefined ? { publiee: query.publiee } : {}),
    ...(query.q ? whereRechercheDemande(query.q) : {}),
  }
  const [total, rows] = await prisma.$transaction([
    prisma.demandeClient.count({ where }),
    prisma.demandeClient.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.page, ADMIN_PAGE_SIZE),
      select: DEMANDE_SELECT,
    }),
  ])
  return buildPage(await assemblerDemandes(ctx, rows), total, query.page, ADMIN_PAGE_SIZE)
}

export async function createDemande(ctx: ModuleAuthContext, data: DemandeCreateInput): Promise<AdminDemandeDto> {
  const row = await prisma.demandeClient.create({
    data: {
      companyId: ctx.company.id,
      entrepriseCliente: data.entrepriseCliente,
      posteRecherche: data.posteRecherche,
      categorie: data.categorie,
      posteAutrePrecision: data.posteAutrePrecision ?? null,
      recrutementInternational: data.recrutementInternational,
      contactNom: data.contactNom,
      contactEmail: data.contactEmail,
      contactTelephone: data.contactTelephone ?? null,
      nombrePostes: data.nombrePostes,
      dateDebut: data.dateDebut ? new Date(`${data.dateDebut}T00:00:00Z`) : null,
      description: data.description,
      statut: data.statut,
      publiee: false,
    },
    select: DEMANDE_SELECT,
  })
  return assemblerUneDemande(ctx, row)
}

async function findDemandeOwnedOr404(
  ctx: ModuleAuthContext,
  uuid: string,
): Promise<{ id: number; publiee: boolean }> {
  const owner = await prisma.demandeClient.findFirst({
    where: { uuid, companyId: ctx.company.id },
    select: { id: true, publiee: true },
  })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  return owner
}

export async function updateDemande(
  ctx: ModuleAuthContext,
  uuid: string,
  data: DemandeUpdateInput,
): Promise<AdminDemandeDto> {
  const owner = await findDemandeOwnedOr404(ctx, uuid)
  const patch: Prisma.DemandeClientUpdateInput = {}
  if (data.entrepriseCliente !== undefined) patch.entrepriseCliente = data.entrepriseCliente
  if (data.posteRecherche !== undefined) patch.posteRecherche = data.posteRecherche
  if (data.categorie !== undefined) patch.categorie = data.categorie
  if (data.posteAutrePrecision !== undefined) patch.posteAutrePrecision = data.posteAutrePrecision
  if (data.recrutementInternational !== undefined) patch.recrutementInternational = data.recrutementInternational
  if (data.contactNom !== undefined) patch.contactNom = data.contactNom
  if (data.contactEmail !== undefined) patch.contactEmail = data.contactEmail
  if (data.contactTelephone !== undefined) patch.contactTelephone = data.contactTelephone
  if (data.nombrePostes !== undefined) patch.nombrePostes = data.nombrePostes
  if (data.dateDebut !== undefined) {
    patch.dateDebut = data.dateDebut ? new Date(`${data.dateDebut}T00:00:00Z`) : null
  }
  if (data.description !== undefined) patch.description = data.description
  if (data.statut !== undefined) patch.statut = data.statut
  if (data.titreOffre !== undefined) patch.titreOffre = data.titreOffre
  if (data.lieu !== undefined) patch.lieu = data.lieu
  if (data.typeContrat !== undefined) patch.typeContrat = data.typeContrat
  if (data.salaire !== undefined) patch.salaire = data.salaire
  if (data.descriptionPublique !== undefined) patch.descriptionPublique = data.descriptionPublique

  // Toute mutation d'une demande publiée (contenu, statut, dépublication) peut changer l'offre
  // publique : on invalide dès que la demande l'était ou le devient. Un changement sur une demande
  // jamais publiée ne purge rien.
  const toucheOffrePublique = owner.publiee || data.publiee === true
  if (data.publiee !== undefined) {
    patch.publiee = data.publiee
    if (data.publiee && !owner.publiee) patch.publieeLe = new Date()
  }

  const row = await prisma.demandeClient.update({ where: { id: owner.id }, data: patch, select: DEMANDE_SELECT })
  if (toucheOffrePublique) await invalidatePublicPages()
  return assemblerUneDemande(ctx, row)
}

/** Supprime la demande ; les candidats dont c'était la seule affectation repassent DISPONIBLE. */
export async function deleteDemande(ctx: ModuleAuthContext, uuid: string): Promise<void> {
  const owner = await findDemandeOwnedOr404(ctx, uuid)
  const affectations = await prisma.affectation.findMany({
    where: { demandeId: owner.id },
    select: { candidatId: true },
  })
  const candidatIds = [...new Set(affectations.map((affectation) => affectation.candidatId))]

  await prisma.$transaction(async (tx) => {
    if (candidatIds.length > 0) {
      await tx.candidat.updateMany({
        where: { id: { in: candidatIds }, affectations: { none: { demandeId: { not: owner.id } } } },
        data: { statut: 'DISPONIBLE' },
      })
    }
    await tx.demandeClient.deleteMany({ where: { id: owner.id } })
  })
  if (owner.publiee) await invalidatePublicPages()
}

export async function affecter(
  ctx: ModuleAuthContext,
  demandeUuid: string,
  data: AffectationCreateInput,
): Promise<AdminDemandeDto> {
  const demande = await prisma.demandeClient.findFirst({
    where: { uuid: demandeUuid, companyId: ctx.company.id },
    select: { id: true },
  })
  if (!demande) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  const candidat = await prisma.candidat.findFirst({
    where: { uuid: data.candidatUuid, companyId: ctx.company.id },
    select: { id: true },
  })
  if (!candidat) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })

  try {
    await prisma.$transaction([
      prisma.affectation.create({
        data: { companyId: ctx.company.id, candidatId: candidat.id, demandeId: demande.id },
        select: { uuid: true },
      }),
      prisma.candidat.update({ where: { id: candidat.id }, data: { statut: 'PLACE' } }),
    ])
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, statusMessage: 'Candidat déjà affecté à cette demande' })
    }
    throw error
  }

  const row = await prisma.demandeClient.findUnique({ where: { id: demande.id }, select: DEMANDE_SELECT })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  return assemblerUneDemande(ctx, row)
}

export async function retirerAffectation(
  ctx: ModuleAuthContext,
  demandeUuid: string,
  affectationUuid: string,
): Promise<void> {
  const demande = await prisma.demandeClient.findFirst({
    where: { uuid: demandeUuid, companyId: ctx.company.id },
    select: { id: true },
  })
  if (!demande) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })

  const affectation = await prisma.affectation.findFirst({
    where: { uuid: affectationUuid, demandeId: demande.id, companyId: ctx.company.id },
    select: { id: true, candidatId: true },
  })
  if (!affectation) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })

  await prisma.$transaction(async (tx) => {
    await tx.affectation.delete({ where: { id: affectation.id } })
    const restantes = await tx.affectation.count({ where: { candidatId: affectation.candidatId } })
    if (restantes === 0) {
      await tx.candidat.update({ where: { id: affectation.candidatId }, data: { statut: 'DISPONIBLE' } })
    }
  })
}

// --- Candidatures ------------------------------------------------------------------------

async function chargerDocuments(rows: readonly CandidatureRow[]): Promise<Map<string, AdminFichierDto[]>> {
  const cles = new Set<string>()
  for (const row of rows) {
    if (row.cvKey !== null) cles.add(row.cvKey)
    for (const cle of row.autresDocumentsKeys) cles.add(cle)
  }
  const resultat = new Map<string, AdminFichierDto[]>()
  if (cles.size === 0) return resultat

  const fichiers = await prisma.fichier.findMany({
    where: { key: { in: [...cles] } },
    select: { key: true, nomOriginal: true },
  })
  const noms = new Map(fichiers.map((fichier) => [fichier.key, fichier.nomOriginal] as const))

  for (const row of rows) {
    const documents: AdminFichierDto[] = []
    // CV d'abord, puis les autres documents : `nomOriginal` seulement, jamais la clé seule.
    if (row.cvKey !== null) {
      const nom = noms.get(row.cvKey)
      if (nom !== undefined) documents.push({ key: row.cvKey, nomOriginal: nom })
    }
    for (const cle of row.autresDocumentsKeys) {
      const nom = noms.get(cle)
      if (nom !== undefined) documents.push({ key: cle, nomOriginal: nom })
    }
    resultat.set(row.uuid, documents)
  }
  return resultat
}

function whereRechercheCandidature(q: string): Prisma.CandidatureWhereInput {
  return {
    OR: [
      { nomComplet: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { posteRecherche: { contains: q, mode: 'insensitive' } },
    ],
  }
}

export async function listCandidatures(
  ctx: ModuleAuthContext,
  query: CandidaturesQuery,
): Promise<AdminPage<AdminCandidatureDto>> {
  const where: Prisma.CandidatureWhereInput = {
    companyId: ctx.company.id,
    ...(query.statut ? { statut: query.statut } : {}),
    ...(query.q ? whereRechercheCandidature(query.q) : {}),
  }
  const [total, rows] = await prisma.$transaction([
    prisma.candidature.count({ where }),
    prisma.candidature.findMany({
      where,
      orderBy: [{ dateEnvoi: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.page, ADMIN_PAGE_SIZE),
      select: CANDIDATURE_SELECT,
    }),
  ])
  const documents = await chargerDocuments(rows)
  return buildPage(rows.map((row) => toCandidatureDto(row, documents.get(row.uuid) ?? [])), total, query.page, ADMIN_PAGE_SIZE)
}

async function findCandidatureOwnedOr404(
  ctx: ModuleAuthContext,
  uuid: string,
): Promise<{ id: number; rejeteLe: Date | null; retenueLe: Date | null; anonymiseLe: Date | null }> {
  const owner = await prisma.candidature.findFirst({
    where: { uuid, companyId: ctx.company.id },
    select: { id: true, rejeteLe: true, retenueLe: true, anonymiseLe: true },
  })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  return owner
}

/**
 * Transitions d'horloges Loi 25 : REJETEE pose `rejeteLe` (une seule fois) ; quitter REJETEE
 * l'efface ; RETENUE pose `retenueLe` (une seule fois). Le passage à RETENUE ne supprime pas
 * `rejeteLe` de lui-même : on le fait dès que le statut n'est plus REJETEE.
 */
export async function updateCandidatureStatut(
  ctx: ModuleAuthContext,
  uuid: string,
  statut: CandidatureUpdateInput['statut'],
): Promise<AdminCandidatureDto> {
  const owner = await findCandidatureOwnedOr404(ctx, uuid)
  // Le statut d'une candidature anonymisée ne se joue plus (horloges Loi 25 figées, actions
  // réduites à la suppression). Le silo anonymisé remonte ses propre erreurs en toast.
  if (owner.anonymiseLe !== null) throw createError({ statusCode: 409, statusMessage: 'Candidature anonymisée.' })
  const maintenant = new Date()
  const patch: Prisma.CandidatureUpdateInput = { statut }
  if (statut === 'REJETEE' && owner.rejeteLe === null) patch.rejeteLe = maintenant
  if (statut !== 'REJETEE' && owner.rejeteLe !== null) patch.rejeteLe = null
  if (statut === 'RETENUE' && owner.retenueLe === null) patch.retenueLe = maintenant

  const row = await prisma.candidature.update({ where: { id: owner.id }, data: patch, select: CANDIDATURE_SELECT })
  const documents = await chargerDocuments([row])
  return toCandidatureDto(row, documents.get(row.uuid) ?? [])
}

/** Copie le CV d'une candidature dans un cycle de vie propre (nouvelle clé, visibilité PRIVE). */
async function copierCvCandidature(ctx: ModuleAuthContext, cvKey: string | null): Promise<string | null> {
  if (cvKey === null) return null
  const data = await uploadsStorage().getItemRaw<Buffer>(cvKey)
  if (!data) return null
  const fichier = await prisma.fichier.findUnique({ where: { key: cvKey }, select: { nomOriginal: true } })
  const saved = await saveUploadedFile(
    { data, filename: fichier?.nomOriginal },
    { companyId: ctx.company.id, visibilite: 'PRIVE' },
  )
  return saved.key
}

/**
 * « Ajouter au vivier » : crée un `Candidat` depuis une candidature et copie son CV. La copie
 * garantit que l'anonymisation ultérieure de la candidature (cycle 6 mois) ne casse jamais le CV
 * du vivier (cycle 12 mois). Une candidature anonymisée (PII nulles) est refusée : rien à copier.
 */
export async function ajouterAuVivier(ctx: ModuleAuthContext, uuid: string): Promise<AdminCandidatDto> {
  const candidature = await prisma.candidature.findFirst({
    where: { uuid, companyId: ctx.company.id },
    select: {
      id: true,
      nomComplet: true,
      email: true,
      telephone: true,
      categorie: true,
      posteRecherche: true,
      cvKey: true,
      anonymiseLe: true,
    },
  })
  if (!candidature) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  if (candidature.anonymiseLe !== null || candidature.email === null || candidature.nomComplet === null) {
    throw createError({ statusCode: 409, statusMessage: 'Candidature anonymisée' })
  }

  const email = candidature.email
  const existant = await prisma.candidat.findFirst({
    where: { companyId: ctx.company.id, email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  })
  if (existant) throw createError({ statusCode: 409, statusMessage: 'Un candidat avec cette adresse existe déjà' })

  const cvKey = await copierCvCandidature(ctx, candidature.cvKey)

  try {
    const created = await prisma.$transaction(async (tx) => {
      const candidat = await tx.candidat.create({
        data: {
          companyId: ctx.company.id,
          nomComplet: candidature.nomComplet,
          email,
          telephone: candidature.telephone,
          posteRecherche: candidature.posteRecherche,
          categorie: candidature.categorie,
          origine: 'LOCAL',
          cvKey,
        },
        // `id` n'est pas exposé : il ne sert qu'à lier la candidature, dans la transaction.
        select: { ...CANDIDAT_SELECT, id: true },
      })
      await tx.candidature.update({ where: { id: candidature.id }, data: { candidatId: candidat.id } })
      return candidat
    })
    return toCandidatDto(created)
  } catch (error) {
    if (cvKey !== null) await supprimerFichiers([cvKey])
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, statusMessage: 'Un candidat avec cette adresse existe déjà' })
    }
    throw error
  }
}

/** Supprime la ligne puis les fichiers — l'ordre inverse violerait la FK Restrict sur `cv`. */
export async function supprimerCandidature(ctx: ModuleAuthContext, uuid: string): Promise<void> {
  const owner = await prisma.candidature.findFirst({
    where: { uuid, companyId: ctx.company.id },
    select: { id: true, cvKey: true, autresDocumentsKeys: true },
  })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })

  const keys = [owner.cvKey, ...owner.autresDocumentsKeys].filter((cle): cle is string => cle !== null)
  await prisma.candidature.deleteMany({ where: { id: owner.id } })
  await supprimerFichiers(keys)
}

/** « Supprimer maintenant » (Loi 25) : anonymise en gardant la ligne statistique. */
export async function anonymiserCandidatureRoute(
  ctx: ModuleAuthContext,
  uuid: string,
): Promise<AdminCandidatureDto> {
  const owner = await prisma.candidature.findFirst({
    where: { uuid, companyId: ctx.company.id },
    select: { id: true },
  })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })

  await anonymiserCandidatureParId(owner.id)

  const row = await prisma.candidature.findUnique({ where: { id: owner.id }, select: CANDIDATURE_SELECT })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  return toCandidatureDto(row, [])
}
