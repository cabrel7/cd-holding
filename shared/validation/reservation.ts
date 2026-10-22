// Validation de la réservation du restaurant (ccdpaa). Imports relatifs uniquement (seed/tsx).
import { z } from 'zod'
import { ADMIN_PAGE_MAX, ADMIN_SEARCH_MAX } from '../config/admin'
import { CONTROLE_PATTERN, emailContactSchema, honeypotSchema, nomContactSchema, telephoneContactSchema } from './contact'
import { HEURE_PATTERN, creneauxPourDate, verifierDate, type RaisonDateInvalide, type ReglagesReservation } from '../utils/restaurant'

export const RESERVATION_LIMITS = { notesMax: 1000, personnesMin: 1 } as const

const CHAMP_REQUIS = 'Ce champ est requis.'

export const reservationBaseSchema = z
  .object({
    nom: nomContactSchema,
    email: emailContactSchema,
    telephone: telephoneContactSchema,
    date: z.string({ required_error: CHAMP_REQUIS }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Choisissez une date.'),
    heure: z.string({ required_error: CHAMP_REQUIS }).regex(HEURE_PATTERN, 'Choisissez une heure.'),
    nombrePersonnes: z.coerce
      .number({ invalid_type_error: 'Indiquez le nombre de personnes.' })
      .int('Nombre entier attendu.')
      .min(RESERVATION_LIMITS.personnesMin, 'Au moins 1 personne.'),
    notes: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z
        .string()
        .trim()
        .max(RESERVATION_LIMITS.notesMax, `${RESERVATION_LIMITS.notesMax} caractères au maximum.`)
        .refine((s) => !CONTROLE_PATTERN.test(s), 'Caractères non autorisés.')
        .optional(),
    ),
    website: honeypotSchema,
  })
  .strict()

const MESSAGES_DATE: Record<RaisonDateInvalide, (r: ReglagesReservation) => string> = {
  format: () => 'Choisissez une date valide.',
  passee: () => 'Cette date est passée.',
  'trop-loin': (r) => `Les réservations sont ouvertes ${r.horizonJours} jours à l’avance au maximum.`,
  fermee: () => 'Le restaurant est fermé ce jour-là.',
}

/** Règles métier (réglages en base) ; `maintenant` relu à chaque validation (jamais figé). */
export function reservationSchema(r: ReglagesReservation, maintenant: () => Date = () => new Date()) {
  return reservationBaseSchema.superRefine((v, ctx) => {
    if (v.nombrePersonnes > r.capaciteMaxReservation)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nombrePersonnes'],
        message: `Au-delà de ${r.capaciteMaxReservation} personnes, écrivez-nous.`,
      })
    const now = maintenant()
    const raison = verifierDate(r, v.date, now)
    if (raison) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: MESSAGES_DATE[raison](r) })
      return
    }
    if (!creneauxPourDate(r, v.date, now).includes(v.heure))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['heure'], message: 'Ce créneau n’est plus disponible. Choisissez-en un autre.' })
  })
}

export type ReservationFormValues = z.input<typeof reservationBaseSchema>
export type ReservationBody = z.infer<typeof reservationBaseSchema>

// --- Admin (lot 5) --------------------------------------------------------------------------

const vide = (v: unknown): unknown => (typeof v === 'string' && v.trim() === '' ? undefined : v)

export const statutReservationSchema = z.enum(['EN_ATTENTE', 'CONFIRMEE', 'ANNULEE'])

export const reservationsQuerySchema = z
  .object({
    statut: statutReservationSchema.optional(),
    q: z.preprocess(vide, z.string().trim().max(ADMIN_SEARCH_MAX).optional()),
    page: z.coerce.number().int().min(1).max(ADMIN_PAGE_MAX).default(1),
  })
  .strict()

export const reservationUpdateSchema = z.object({ statut: statutReservationSchema }).strict()

export type ReservationsQuery = z.infer<typeof reservationsQuerySchema>
export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>
