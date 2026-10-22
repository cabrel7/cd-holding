// Validation des routes admin placement (lot 5 : candidats, demandes, candidatures).
// Source unique client (VeeValidate) + serveur (readValidatedBody). Imports relatifs et zod
// explicite (tsx/seed). Tous les objets sont `.strict()` : un champ imprévu est une 400.
import { z } from 'zod'
import { ADMIN_PAGE_MAX, ADMIN_SEARCH_MAX, PLACEMENT_TEXT_BOUNDS } from '../config/admin'
import {
  NIVEAUX_EXPERIENCE,
  POSTES_CANDIDAT,
  TYPES_CONTRAT,
  type CategoriePosteKey,
  type NiveauExperienceKey,
  type TypeContratKey,
} from '../config/candidature'
import { isDateCalendaireValide } from '../utils/dates'
import { exigerAuMoinsUnChamp } from './cms'
import { CONTROLE_PATTERN, emailContactSchema, telephoneContactSchema } from './contact'

const CHAMP_REQUIS = 'Ce champ est requis.'
const MAX_CARACTÈRES = (max: number) => `${max} caractères au maximum.`
const SANS_CONTROLE = 'Caractères non autorisés.'

const vide = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const videEnNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)
// 'true'/'false' (query string) → bool ; toute autre valeur reste telle quelle : z.boolean().optional()
// la rejettera alors (et l'absence passe par optional, pas par un sentinelle qui fuirait).
const boolQuery = (v: unknown) => (v === 'true' ? true : v === 'false' ? false : v)
const sansControle = (s: string) => !CONTROLE_PATTERN.test(s)

// --- Enums ---

export const statutCandidatSchema = z.enum(['DISPONIBLE', 'EN_PROCESSUS', 'PLACE'])
export const statutCandidatureSchema = z.enum(['NOUVELLE', 'EN_REVISION', 'RETENUE', 'REJETEE'])
export const statutDemandeSchema = z.enum(['OUVERTE', 'POURVUE', 'ANNULEE'])
export const origineCandidatSchema = z.enum(['LOCAL', 'INTERNATIONAL'])

// Seuls casts : z.enum exige un tuple ; valeurs issues de constantes `as const` (couvertes par tests).
const CATEGORIES = POSTES_CANDIDAT.map((p) => p.categorie) as unknown as [CategoriePosteKey, ...CategoriePosteKey[]]
const EXPERIENCES = NIVEAUX_EXPERIENCE.map((n) => n.value) as unknown as [NiveauExperienceKey, ...NiveauExperienceKey[]]
const CONTRATS = Object.keys(TYPES_CONTRAT) as unknown as [TypeContratKey, ...TypeContratKey[]]

export const categoriePosteSchema = z.enum(CATEGORIES)
export const typeContratSchema = z.enum(CONTRATS)

// --- Primitives ---

function texteSchema(max: number, min = 1) {
  return z
    .string({ required_error: CHAMP_REQUIS })
    .trim()
    .min(min, CHAMP_REQUIS)
    .max(max, MAX_CARACTÈRES(max))
    .refine(sansControle, SANS_CONTROLE)
}

/** Champ texte optionnel : '' (champ vidé) → null, absent → undefined, jamais de blanc stocké. */
function texteOptionnel(max: number, min = 1) {
  return z.preprocess(videEnNull, texteSchema(max, min).nullable().optional())
}

const telephoneOptionnel = z.preprocess(videEnNull, telephoneContactSchema.nullable().optional())

const pageSchema = z.coerce.number().int().min(1).max(ADMIN_PAGE_MAX).default(1)
const rechercheSchema = z.preprocess(vide, z.string().trim().max(ADMIN_SEARCH_MAX).optional())

// --- Candidats (vivier) ---

export const candidatsQuerySchema = z
  .object({
    statut: statutCandidatSchema.optional(),
    origine: origineCandidatSchema.optional(),
    q: rechercheSchema,
    page: pageSchema,
  })
  .strict()

const candidatChamps = {
  nomComplet: texteSchema(PLACEMENT_TEXT_BOUNDS.nomComplet.max, PLACEMENT_TEXT_BOUNDS.nomComplet.min),
  email: emailContactSchema,
  telephone: telephoneOptionnel,
  posteRecherche: texteOptionnel(PLACEMENT_TEXT_BOUNDS.texte.max, PLACEMENT_TEXT_BOUNDS.texte.min),
  categorie: categoriePosteSchema,
  disponibilite: texteOptionnel(PLACEMENT_TEXT_BOUNDS.texte.max, PLACEMENT_TEXT_BOUNDS.texte.min),
  statut: statutCandidatSchema.default('DISPONIBLE'),
  origine: origineCandidatSchema,
  notes: texteOptionnel(PLACEMENT_TEXT_BOUNDS.notes.max),
} as const

export const candidatCreateSchema = z.object({ ...candidatChamps }).strict()
export const candidatUpdateSchema = exigerAuMoinsUnChamp(z.object({ ...candidatChamps }).strict().partial())

// --- Demandes (dont publication comme offre) ---

export const demandesQuerySchema = z
  .object({
    statut: statutDemandeSchema.optional(),
    publiee: z.preprocess(boolQuery, z.boolean({ message: 'Valeur attendue : true ou false.' }).optional()),
    q: rechercheSchema,
    page: pageSchema,
  })
  .strict()

const demandeChamps = {
  entrepriseCliente: texteSchema(160, 2),
  posteRecherche: texteSchema(120, 2),
  categorie: categoriePosteSchema,
  posteAutrePrecision: texteOptionnel(120, 2),
  recrutementInternational: z.boolean().default(false),
  contactNom: texteSchema(120, 2),
  contactEmail: emailContactSchema,
  contactTelephone: telephoneOptionnel,
  nombrePostes: z.coerce.number().int().min(1).max(99).default(1),
  dateDebut: z.preprocess(videEnNull, z.string().refine(isDateCalendaireValide, 'Date invalide.').nullable().optional()),
  description: texteSchema(5000, 10),
  statut: statutDemandeSchema.default('OUVERTE'),
} as const

/** Champs d'offre (publication) — exigés serveur dès `publiee: true` (spec lot 5 §0). */
const champsOffre = {
  titreOffre: texteOptionnel(160, 2),
  lieu: texteOptionnel(160, 2),
  typeContrat: z.preprocess(videEnNull, typeContratSchema.nullable().optional()),
  salaire: texteOptionnel(120),
  descriptionPublique: texteOptionnel(5000, 10),
} as const

/**
 * Publier sans champs d'offre casserait `/placement/offres` : `publiee: true` exige les 4
 * champs de publication DANS le même corps (l'UI les envoie via « Publier comme offre »).
 */
const CHAMPS_OFFRE_REQUIS = [
  ['titreOffre', 'Le titre de l’offre est requis pour publier.'],
  ['lieu', 'Le lieu est requis pour publier.'],
  ['typeContrat', 'Le type de contrat est requis pour publier.'],
  ['descriptionPublique', 'La description publique est requise pour publier.'],
] as const satisfies readonly (readonly [string, string])[]

export const demandeCreateSchema = z.object({ ...demandeChamps }).strict()
export const demandeUpdateSchema = exigerAuMoinsUnChamp(
  z.object({ ...demandeChamps, publiee: z.boolean().optional(), ...champsOffre }).strict().partial(),
).superRefine((v, ctx) => {
  if (v.publiee !== true) return
  const vues = v as Record<string, unknown>
  for (const [cle, message] of CHAMPS_OFFRE_REQUIS) {
    const valeur = vues[cle]
    if (typeof valeur !== 'string' || valeur.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [cle], message })
    }
  }
})

export const affectationCreateSchema = z.object({ candidatUuid: z.string().uuid() }).strict()

// --- Candidatures ---

export const candidaturesQuerySchema = z
  .object({
    statut: statutCandidatureSchema.optional(),
    q: rechercheSchema,
    page: pageSchema,
  })
  .strict()

export const candidatureUpdateSchema = z.object({ statut: statutCandidatureSchema }).strict()

// --- Types ---

export type CandidatsQuery = z.infer<typeof candidatsQuerySchema>
export type CandidatCreateInput = z.infer<typeof candidatCreateSchema>
export type CandidatUpdateInput = z.infer<typeof candidatUpdateSchema>
export type DemandesQuery = z.infer<typeof demandesQuerySchema>
export type DemandeCreateInput = z.infer<typeof demandeCreateSchema>
export type DemandeUpdateInput = z.infer<typeof demandeUpdateSchema>
export type AffectationCreateInput = z.infer<typeof affectationCreateSchema>
export type CandidaturesQuery = z.infer<typeof candidaturesQuerySchema>
export type CandidatureUpdateInput = z.infer<typeof candidatureUpdateSchema>