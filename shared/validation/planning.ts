// Validation du planning admin (lot 5 : 3 plannings + mon-planning).
// Imports relatifs uniquement (seed/tsx).
import { z } from 'zod'
import { PLANNING_SITES } from '../config/planning'
import { isDateCalendaireValide, jourIsoSemaine } from '../utils/dates'
import { exigerAuMoinsUnChamp } from './cms'

const CHAMP_REQUIS = 'Ce champ est requis.'
const MAX_CARACTERES = (max: number): string => `${max} caractères au maximum.`

/**
 * Champ texte optionnel : '' (champ vidé) → null = EFFACER à l'édition (l'ancien titre/notes ne
 * survit pas), absent → undefined = ne pas toucher, jamais de blanc stocké.
 */
const texteOptionnel = (max: number) =>
  z.preprocess(
    (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max, MAX_CARACTERES(max)).nullable().optional(),
  )

/** `site` du path : filiale portant le module planning (400 sinon, jamais 500). */
export const planningSiteSchema = z.enum(PLANNING_SITES)

/**
 * Semaine au format lundi ISO (YYYY-MM-DD, jour ISO 1). Optionnelle : le service applique le
 * défaut (lundi courant Québec) quand elle est absente.
 */
export const semaineSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Semaine invalide (YYYY-MM-DD, un lundi).')
  .refine((v) => isDateCalendaireValide(v) && jourIsoSemaine(v) === 1, 'Semaine invalide (YYYY-MM-DD, un lundi).')
  .optional()

export const planningSemaineQuerySchema = z.object({ semaine: semaineSchema }).strict()

const datetimeIso = z.string().datetime({ offset: true, message: 'Date et heure invalides (ISO 8601).' })

const quartChamps = {
  employeUuid: z.string().uuid(),
  dateDebut: datetimeIso,
  dateFin: datetimeIso,
  lieu: z.string().trim().min(1, CHAMP_REQUIS).max(160, MAX_CARACTERES(160)),
  titre: texteOptionnel(120),
  notes: texteOptionnel(2000),
}

/**
 * Création d'un quart. Nuit acceptée (fin <= début = +24 h, durée calculée côté service),
 * chevauchement ignoré — comme le prototype.
 */
export const quartCreateSchema = z.object({ ...quartChamps }).strict()

export const quartUpdateSchema = exigerAuMoinsUnChamp(z.object({ ...quartChamps }).strict().partial())

export type PlanningSiteInput = z.infer<typeof planningSiteSchema>
export type PlanningSemaineQuery = z.infer<typeof planningSemaineQuerySchema>
export type QuartCreateInput = z.infer<typeof quartCreateSchema>
export type QuartUpdateInput = z.infer<typeof quartUpdateSchema>
