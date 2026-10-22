// Champs, valeurs initiales et schémas de formulaire du module placement, consommés par
// CmsFormDialog. La validation finale reste celle des schémas zod partagés
// (`#shared/validation/placement`) — une seule source de vérité avec le serveur. Le wrapper
// `enFrancais` ne fait que traduire les messages génériques de zod (type, enum, bornes).
import { z, type ZodErrorMap, type ZodType } from 'zod'
import type { CmsField } from '#shared/content/sections/types'
import {
  CATEGORIE_POSTE_LABELS,
  ORIGINE_CANDIDAT_LABELS,
  PLACEMENT_TEXT_BOUNDS,
  STATUT_CANDIDAT_LABELS,
  STATUT_DEMANDE_LABELS,
  TYPE_CONTRAT_LABELS,
} from '#shared/config/admin'
import type { AdminCandidatDto, AdminDemandeDto } from '#shared/types/admin'
import {
  candidatCreateSchema,
  candidatUpdateSchema,
  demandeCreateSchema,
  demandeUpdateSchema,
  typeContratSchema,
} from '#shared/validation/placement'

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

// --- Candidat (vivier) ---

export const CANDIDAT_FIELDS: readonly CmsField[] = [
  { key: 'nomComplet', label: 'Nom complet', type: 'text', required: true, maxLength: PLACEMENT_TEXT_BOUNDS.nomComplet.max },
  { key: 'email', label: 'Courriel', type: 'text', required: true, maxLength: PLACEMENT_TEXT_BOUNDS.email.max },
  { key: 'telephone', label: 'Téléphone', type: 'text', maxLength: PLACEMENT_TEXT_BOUNDS.telephone.max },
  { key: 'posteRecherche', label: 'Poste recherché', type: 'text', maxLength: PLACEMENT_TEXT_BOUNDS.texte.max },
  { key: 'categorie', label: 'Catégorie', type: 'select', required: true, options: optionsDe(CATEGORIE_POSTE_LABELS) },
  { key: 'disponibilite', label: 'Disponibilité', type: 'text', maxLength: PLACEMENT_TEXT_BOUNDS.texte.max, helpText: 'Ex. « Immédiate », « 2 semaines ».' },
  { key: 'origine', label: 'Origine', type: 'select', required: true, options: optionsDe(ORIGINE_CANDIDAT_LABELS) },
  { key: 'statut', label: 'Statut', type: 'select', required: true, options: optionsDe(STATUT_CANDIDAT_LABELS) },
  { key: 'notes', label: 'Notes', type: 'textarea', maxLength: PLACEMENT_TEXT_BOUNDS.notes.max },
]

export function candidatInitialValues(candidat: AdminCandidatDto | null): Record<string, unknown> {
  return {
    nomComplet: candidat?.nomComplet ?? '',
    email: candidat?.email ?? '',
    telephone: candidat?.telephone ?? '',
    posteRecherche: candidat?.posteRecherche ?? '',
    categorie: candidat?.categorie ?? '',
    disponibilite: candidat?.disponibilite ?? '',
    origine: candidat?.origine ?? 'LOCAL',
    statut: candidat?.statut ?? 'DISPONIBLE',
    notes: candidat?.notes ?? '',
  }
}

export const candidatCreateFormSchema = enFrancais(candidatCreateSchema)
export const candidatEditFormSchema = enFrancais(candidatUpdateSchema)

// --- Demande (dont champs de publication en offre) ---

export const DEMANDE_FIELDS: readonly CmsField[] = [
  { key: 'entrepriseCliente', label: 'Entreprise cliente', type: 'text', required: true, maxLength: 160 },
  { key: 'posteRecherche', label: 'Poste recherché', type: 'text', required: true, maxLength: 120 },
  { key: 'categorie', label: 'Catégorie', type: 'select', required: true, options: optionsDe(CATEGORIE_POSTE_LABELS) },
  {
    key: 'posteAutrePrecision',
    label: 'Précision du poste',
    type: 'text',
    maxLength: 120,
    helpText: 'À remplir lorsque la catégorie est « Autre ».',
  },
  { key: 'recrutementInternational', label: 'Recrutement international', type: 'switch' },
  { key: 'contactNom', label: 'Personne-ressource', type: 'text', required: true, maxLength: 120 },
  { key: 'contactEmail', label: 'Courriel du contact', type: 'text', required: true, maxLength: PLACEMENT_TEXT_BOUNDS.email.max },
  { key: 'contactTelephone', label: 'Téléphone du contact', type: 'text', maxLength: PLACEMENT_TEXT_BOUNDS.telephone.max },
  { key: 'nombrePostes', label: 'Nombre de postes', type: 'text', required: true, helpText: 'Entre 1 et 99.' },
  { key: 'dateDebut', label: 'Date de début souhaitée', type: 'date' },
  { key: 'description', label: 'Description', type: 'textarea', required: true, maxLength: 5000 },
  { key: 'statut', label: 'Statut', type: 'select', required: true, options: optionsDe(STATUT_DEMANDE_LABELS) },
]

export function demandeInitialValues(demande: AdminDemandeDto | null): Record<string, unknown> {
  return {
    entrepriseCliente: demande?.entrepriseCliente ?? '',
    posteRecherche: demande?.posteRecherche ?? '',
    categorie: demande?.categorie ?? '',
    posteAutrePrecision: demande?.posteAutrePrecision ?? '',
    recrutementInternational: demande?.recrutementInternational ?? false,
    contactNom: demande?.contactNom ?? '',
    contactEmail: demande?.contactEmail ?? '',
    contactTelephone: demande?.contactTelephone ?? '',
    nombrePostes: demande ? String(demande.nombrePostes) : '1',
    dateDebut: demande?.dateDebut ?? '',
    description: demande?.description ?? '',
    statut: demande?.statut ?? 'OUVERTE',
  }
}

export const demandeCreateFormSchema = enFrancais(demandeCreateSchema)
export const demandeEditFormSchema = enFrancais(demandeUpdateSchema)

// --- Publier comme offre ---

export const OFFRE_FIELDS: readonly CmsField[] = [
  { key: 'titreOffre', label: "Titre de l'offre", type: 'text', required: true, maxLength: 160 },
  { key: 'lieu', label: 'Lieu', type: 'text', required: true, maxLength: 160 },
  { key: 'typeContrat', label: 'Type de contrat', type: 'select', required: true, options: optionsDe(TYPE_CONTRAT_LABELS) },
  { key: 'salaire', label: 'Salaire', type: 'text', maxLength: 120, helpText: 'Facultatif.' },
  { key: 'descriptionPublique', label: 'Description publique', type: 'textarea', required: true, maxLength: 5000 },
]

/**
 * Le schéma partagé exige les champs d'offre dès `publiee: true` ; ce formulaire ne porte que ces
 * champs (le drapeau est ajouté par la page au moment du PATCH). Exiger ici évite d'envoyer une
 * publication incomplète que le serveur rejetterait en 400.
 */
export const offreFormSchema = enFrancais(
  z
    .object({
      titreOffre: z.string().trim().min(2, CHAMP_REQUIS).max(160),
      lieu: z.string().trim().min(2, CHAMP_REQUIS).max(160),
      typeContrat: typeContratSchema,
      salaire: z.preprocess(
        (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
        z.string().trim().max(120).nullable().optional(),
      ),
      descriptionPublique: z.string().trim().min(10, 'Au moins 10 caractères.').max(5000),
    })
    .strict(),
)

export function offreInitialValues(demande: AdminDemandeDto | null): Record<string, unknown> {
  return {
    titreOffre: demande?.titreOffre ?? demande?.posteRecherche ?? '',
    lieu: demande?.lieu ?? '',
    typeContrat: demande?.typeContrat ?? '',
    salaire: demande?.salaire ?? '',
    descriptionPublique: demande?.descriptionPublique ?? '',
  }
}
