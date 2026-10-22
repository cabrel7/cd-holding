// Champs, valeurs initiales et schémas de formulaire du module comptable, consommés par
// CmsFormDialog. La validation finale reste celle des schémas zod partagés
// (`#shared/validation/comptable`) — une seule source de vérité avec le serveur. Le wrapper
// `enFrancais` ne fait que traduire les messages génériques de zod (type, enum, bornes).
import { z, type ZodErrorMap, type ZodType } from 'zod'
import type { CmsField } from '#shared/content/sections/types'
import {
  COMPTABLE_TEXT_BOUNDS,
  FORFAIT_COMPTABLE_LABELS,
  STATUT_DOSSIER_LABELS,
} from '#shared/config/admin'
import type { AdminDossierComptableDto } from '#shared/types/admin'
import { dossierCreateSchema, dossierUpdateSchema } from '#shared/validation/comptable'

const CHAMP_REQUIS = 'Ce champ est requis.'

const messagesFr: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return { message: CHAMP_REQUIS }
    case z.ZodIssueCode.too_small:
      return { message: issue.minimum === 1 ? CHAMP_REQUIS : `Minimum ${String(issue.minimum)} caractères.` }
    case z.ZodIssueCode.too_big:
      return { message: `Maximum ${String(issue.maximum)} caractères.` }
    case z.ZodIssueCode.invalid_string:
      return { message: issue.validation === 'email' ? 'Courriel invalide.' : ctx.defaultError }
    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Choisissez une valeur.' }
    default:
      return { message: ctx.defaultError }
  }
}

/** Rejoue le schéma avec des messages français ; renvoie la donnée parsée du schéma d'origine. */
function enFrancais(schema: ZodType): ZodType {
  return z.unknown().transform((value, ctx) => {
    const result = schema.safeParse(value, { errorMap: messagesFr })
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: issue.path, message: issue.message })
      }
      return z.NEVER
    }
    return result.data as unknown
  })
}

const optionsDe = (labels: Record<string, string>): readonly { value: string; label: string }[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }))

// --- Dossier comptable ---

export const DOSSIER_FIELDS: readonly CmsField[] = [
  { key: 'entreprise', label: 'Entreprise', type: 'text', required: true, maxLength: COMPTABLE_TEXT_BOUNDS.entreprise.max },
  { key: 'contact', label: 'Contact', type: 'text', required: true, maxLength: COMPTABLE_TEXT_BOUNDS.contact.max },
  { key: 'email', label: 'Courriel', type: 'text', required: true, maxLength: COMPTABLE_TEXT_BOUNDS.email.max },
  { key: 'forfait', label: 'Forfait', type: 'select', required: true, options: optionsDe(FORFAIT_COMPTABLE_LABELS) },
  { key: 'echeance', label: 'Prochaine échéance', type: 'date', required: true },
  { key: 'statut', label: 'Statut', type: 'select', required: true, options: optionsDe(STATUT_DOSSIER_LABELS) },
  { key: 'notes', label: 'Notes', type: 'textarea', maxLength: COMPTABLE_TEXT_BOUNDS.notes.max },
]

export function dossierInitialValues(dossier: AdminDossierComptableDto | null): Record<string, unknown> {
  return {
    entreprise: dossier?.entreprise ?? '',
    contact: dossier?.contact ?? '',
    email: dossier?.email ?? '',
    forfait: dossier?.forfait ?? 'MENSUEL',
    echeance: dossier?.echeance ?? '',
    statut: dossier?.statut ?? 'A_JOUR',
    notes: dossier?.notes ?? '',
  }
}

export const dossierCreateFormSchema = enFrancais(dossierCreateSchema)
export const dossierEditFormSchema = enFrancais(dossierUpdateSchema)
