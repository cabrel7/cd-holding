// Validation de la candidature (placement). Imports relatifs uniquement (seed/tsx).
import { z } from 'zod'
import {
  CANDIDATURE_LIMITS,
  CV_MIMES,
  DOCUMENT_MIMES,
  EXTENSIONS_PAR_MIME,
  NIVEAUX_EXPERIENCE,
  POSTES_CANDIDAT,
  POSTE_AUTRE,
  type NiveauExperienceKey,
  type PosteCandidatKey,
} from '../config/candidature'
import { CONTROLE_PATTERN, emailContactSchema, honeypotSchema, nomContactSchema, telephoneContactSchema, texteCourtSchema } from './contact'

const CHAMP_REQUIS = 'Ce champ est requis.'
const CONSENTEMENT_REQUIS = 'Votre consentement est requis pour traiter votre candidature.'

// Seuls casts : z.enum exige un tuple ; valeurs issues de constantes `as const` (couvertes par tests).
const POSTES = POSTES_CANDIDAT.map((p) => p.value) as unknown as [PosteCandidatKey, ...PosteCandidatKey[]]
const EXPERIENCES = NIVEAUX_EXPERIENCE.map((n) => n.value) as unknown as [NiveauExperienceKey, ...NiveauExperienceKey[]]

const sansControle = (s: string) => !CONTROLE_PATTERN.test(s)

/** '' (champ vidé / multipart) → undefined. */
export const videEnUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

export const adresseCompleteSchema = z
  .string({ required_error: CHAMP_REQUIS })
  .trim()
  .min(CANDIDATURE_LIMITS.adresseMin, 'Indiquez votre adresse complète.')
  .max(CANDIDATURE_LIMITS.adresseMax, `${CANDIDATURE_LIMITS.adresseMax} caractères au maximum.`)
  .refine(sansControle, 'Caractères non autorisés.')

const champsCommuns = {
  nom: nomContactSchema,
  email: emailContactSchema,
  telephone: telephoneContactSchema,
  adresseComplete: adresseCompleteSchema,
  pays: texteCourtSchema(CANDIDATURE_LIMITS.paysMax),
  posteRecherche: z.preprocess(videEnUndefined, z.enum(POSTES, { errorMap: () => ({ message: 'Sélectionnez un poste.' }) }).optional()),
  posteAutrePrecision: z.preprocess(videEnUndefined, texteCourtSchema(CANDIDATURE_LIMITS.precisionMax).optional()),
  experience: z.enum(EXPERIENCES, { errorMap: () => ({ message: 'Sélectionnez votre expérience.' }) }),
  message: z.preprocess(
    videEnUndefined,
    z
      .string()
      .trim()
      .max(CANDIDATURE_LIMITS.messageMax, `${CANDIDATURE_LIMITS.messageMax} caractères au maximum.`)
      .refine(sansControle, 'Caractères non autorisés.')
      .optional(),
  ),
  website: honeypotSchema,
}

interface ChampsPoste {
  readonly posteRecherche?: PosteCandidatKey
  readonly posteAutrePrecision?: string
}

/** Poste requis sans offre ; précision requise ssi « Autre » (DEC-19). Avec offre : dérivé serveur. */
function reglesPoste(v: ChampsPoste, ctx: z.RefinementCtx, posteRequis: boolean): void {
  if (!posteRequis) return
  if (!v.posteRecherche) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['posteRecherche'], message: 'Sélectionnez un poste.' })
  else if (v.posteRecherche === POSTE_AUTRE && !v.posteAutrePrecision)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['posteAutrePrecision'], message: 'Précisez le poste recherché.' })
}

/** Champs texte du multipart (serveur). Les fichiers sont validés sur leurs octets (server/lib/candidature.ts). */
export const candidatureChampsSchema = z
  .object({
    ...champsCommuns,
    demandeUuid: z.string().uuid().optional(),
    consentement: z.literal('true', { errorMap: () => ({ message: CONSENTEMENT_REQUIS }) }),
  })
  .strict()
  .superRefine((v, ctx) => reglesPoste(v, ctx, v.demandeUuid === undefined))

// --- Client : ajoute les File (contrôle ergonomique ; le serveur refait tout sur les octets réels) ---
const MO = 1024 * 1024
const estFichier = (v: unknown): v is File => typeof File !== 'undefined' && v instanceof File
const taille = (v: unknown): number => (estFichier(v) ? v.size : 0)

function typeAccepte(f: File, mimes: readonly string[]): boolean {
  if (mimes.includes(f.type)) return true
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  return f.type === '' && mimes.some((m) => EXTENSIONS_PAR_MIME[m]?.includes(ext) ?? false)
}

function fichierSchema(mimes: readonly string[], maxBytes: number, erreurType: string) {
  return z
    .custom<File>(estFichier, { message: 'Joignez un fichier.' })
    .refine((f) => taille(f) > 0, 'Ce fichier est vide.')
    .refine((f) => taille(f) <= maxBytes, `${maxBytes / MO} Mo au maximum par fichier.`)
    .refine((f) => estFichier(f) && typeAccepte(f, mimes), erreurType)
}

export const cvFichierSchema = fichierSchema(CV_MIMES, CANDIDATURE_LIMITS.cvMaxBytes, 'Le CV doit être un fichier PDF.')
export const documentFichierSchema = fichierSchema(DOCUMENT_MIMES, CANDIDATURE_LIMITS.documentMaxBytes, 'Formats acceptés : PDF, JPEG ou PNG.')

export function candidatureFormSchema(options: { readonly avecOffre: boolean }) {
  return z
    .object({
      ...champsCommuns,
      consentement: z.literal(true, { errorMap: () => ({ message: CONSENTEMENT_REQUIS }) }),
      cv: cvFichierSchema,
      documents: z.array(documentFichierSchema).max(CANDIDATURE_LIMITS.documentsMax, `${CANDIDATURE_LIMITS.documentsMax} documents au maximum.`),
    })
    .strict()
    .superRefine((v, ctx) => {
      reglesPoste(v, ctx, !options.avecOffre)
      const total = taille(v.cv) + (Array.isArray(v.documents) ? v.documents.reduce((s, f) => s + taille(f), 0) : 0)
      if (total > CANDIDATURE_LIMITS.totalMaxBytes)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['documents'],
          message: `Taille totale limitée à ${CANDIDATURE_LIMITS.totalMaxBytes / MO} Mo.`,
        })
    })
}

export type CandidatureChamps = z.infer<typeof candidatureChampsSchema>
export type CandidatureFormValues = z.input<ReturnType<typeof candidatureFormSchema>>
