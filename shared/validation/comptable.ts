// Validation des routes admin comptable (lot 5 : dossiers clients).
// Source unique client (VeeValidate) + serveur (readValidatedBody). Imports relatifs et zod
// explicite (tsx/seed). Tous les objets sont `.strict()` : un champ imprévu est une 400.
import { z } from 'zod'
import { ADMIN_PAGE_MAX, COMPTABLE_TEXT_BOUNDS } from '../config/admin'
import { isDateCalendaireValide } from '../utils/dates'
import { exigerAuMoinsUnChamp } from './cms'
import { emailContactSchema } from './contact'

const CHAMP_REQUIS = 'Ce champ est requis.'
const MAX_CARACTÈRES = (max: number) => `${max} caractères au maximum.`

const videEnNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

// --- Enums ---

export const statutDossierSchema = z.enum(['A_JOUR', 'EN_TRAITEMENT', 'EN_RETARD'])
export const forfaitComptableSchema = z.enum(['MENSUEL', 'TRIMESTRIEL', 'ANNUEL'])

// --- Primitives ---

const entrepriseSchema = z
  .string({ required_error: CHAMP_REQUIS })
  .trim()
  .min(COMPTABLE_TEXT_BOUNDS.entreprise.min, CHAMP_REQUIS)
  .max(COMPTABLE_TEXT_BOUNDS.entreprise.max, MAX_CARACTÈRES(COMPTABLE_TEXT_BOUNDS.entreprise.max))

const contactSchema = z
  .string({ required_error: CHAMP_REQUIS })
  .trim()
  .min(COMPTABLE_TEXT_BOUNDS.contact.min, CHAMP_REQUIS)
  .max(COMPTABLE_TEXT_BOUNDS.contact.max, MAX_CARACTÈRES(COMPTABLE_TEXT_BOUNDS.contact.max))

const echeanceSchema = z
  .string({ required_error: CHAMP_REQUIS })
  .refine(isDateCalendaireValide, 'Date invalide.')

const notesSchema = z.preprocess(
  videEnNull,
  z.string().trim().max(COMPTABLE_TEXT_BOUNDS.notes.max, MAX_CARACTÈRES(COMPTABLE_TEXT_BOUNDS.notes.max)).nullable().optional(),
)

const pageSchema = z.coerce.number().int().min(1).max(ADMIN_PAGE_MAX).default(1)

// --- Dossiers ---

export const dossiersQuerySchema = z
  .object({
    statut: statutDossierSchema.optional(),
    page: pageSchema,
  })
  .strict()

const dossierChamps = {
  entreprise: entrepriseSchema,
  contact: contactSchema,
  email: emailContactSchema,
  forfait: forfaitComptableSchema,
  echeance: echeanceSchema,
  statut: statutDossierSchema.default('A_JOUR'),
  notes: notesSchema,
} as const

export const dossierCreateSchema = z.object({ ...dossierChamps }).strict()
export const dossierUpdateSchema = exigerAuMoinsUnChamp(z.object({ ...dossierChamps }).strict().partial())

// --- Types ---

export type DossiersQuery = z.infer<typeof dossiersQuerySchema>
export type DossierCreateInput = z.infer<typeof dossierCreateSchema>
export type DossierUpdateInput = z.infer<typeof dossierUpdateSchema>
