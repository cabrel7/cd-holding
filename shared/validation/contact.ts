// Validation des formulaires de contact publics (spec docs/specs/phase3-holding-contact.md §3.1).
// Source unique client (VeeValidate) + serveur (POST /api/public/contact). Imports relatifs et
// zod explicite : ce fichier doit rester importable par tsx (seed, scripts).
import { z } from 'zod'
import { SITE_SLUGS } from '../config/sites'
import {
  CONTACT_FORMS,
  SITES_SUGGESTION,
  estChampDetail,
  type ChampContact,
  type ChampDetail,
  type ConfigFormulaireContact,
  type FormulaireFilialeSlug,
} from '../config/contact-forms'
import { ajouterJoursIso, dateDuJourQuebec, isDateCalendaireValide } from '../utils/dates'
import { ETAPES_ASSISTANT, type ReponsesAssistant } from '../content/cdpaa/assistant-import-export'

export const CONTACT_LIMITS = {
  nomMin: 2,
  nomMax: 120,
  emailMax: 254,
  messageMin: 10,
  messageMax: 5000,
  honeypotMax: 200,
  telephoneMin: 7,
  telephoneMax: 30,
  telephoneChiffresMin: 7,
  texteCourtMin: 2,
  texteCourtMax: 120,
  entrepriseMax: 160,
  paysMax: 80,
  dateMaxJours: 365,
} as const

// Lettres de toutes langues, espaces, apostrophes ' ’, point, trait d'union. Pas de chiffres ni
// de « @ / : » : aucune URL possible dans un nom repris par l'accusé de réception (anti-relais).
const NOM_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u
// Caractères de contrôle refusés (un NUL ferait une 500 Postgres), sauf \t \n \r.
// eslint-disable-next-line no-control-regex
export const CONTROLE_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

// `required_error` : message français si le champ est absent (sinon zod renvoie « Required »).
const CHAMP_REQUIS = 'Ce champ est requis.'

export const nomContactSchema = z
  .string({ required_error: CHAMP_REQUIS })
  .trim()
  .min(CONTACT_LIMITS.nomMin, 'Veuillez saisir votre nom.')
  .max(CONTACT_LIMITS.nomMax, `${CONTACT_LIMITS.nomMax} caractères au maximum.`)
  .regex(NOM_PATTERN, 'Utilisez uniquement des lettres, espaces, apostrophes ou traits d’union.')

export const emailContactSchema = z
  .string({ required_error: CHAMP_REQUIS })
  .trim()
  .toLowerCase()
  .max(CONTACT_LIMITS.emailMax, 'Adresse courriel trop longue.')
  .email('Adresse courriel invalide.')

export const messageContactSchema = z
  .string({ required_error: CHAMP_REQUIS })
  .trim()
  .min(CONTACT_LIMITS.messageMin, `Votre message doit contenir au moins ${CONTACT_LIMITS.messageMin} caractères.`)
  .max(CONTACT_LIMITS.messageMax, 'Votre message ne peut dépasser 5 000 caractères.')
  .refine((s) => !CONTROLE_PATTERN.test(s), 'Votre message contient des caractères non autorisés.')

// Jamais rejeté quand il est rempli : le serveur simule alors un succès sans rien écrire.
export const honeypotSchema = z.string().max(CONTACT_LIMITS.honeypotMax).optional()

const cibleSchema = z.enum(SITE_SLUGS, { errorMap: () => ({ message: 'Sélectionnez une filiale.' }) })

/** Valeurs du formulaire de contact de la holding (VeeValidate, toTypedSchema). */
export const holdingContactFormSchema = z
  .object({
    nom: nomContactSchema,
    email: emailContactSchema,
    cible: cibleSchema,
    message: messageContactSchema,
    website: honeypotSchema,
  })
  .strict()

export const holdingContactBodySchema = holdingContactFormSchema.extend({ formulaire: z.literal('holding') })

// --- Formulaires des filiales et suggestion de produit (spec lot 2 §1-§2) ---

const TELEPHONE_INVALIDE = 'Numéro de téléphone invalide.'

export const telephoneContactSchema = z
  .string({ required_error: CHAMP_REQUIS })
  .trim()
  .min(CONTACT_LIMITS.telephoneMin, TELEPHONE_INVALIDE)
  .max(CONTACT_LIMITS.telephoneMax, TELEPHONE_INVALIDE)
  .regex(/^[0-9+().\s-]+$/, TELEPHONE_INVALIDE)
  .refine((s) => (s.match(/\d/g)?.length ?? 0) >= CONTACT_LIMITS.telephoneChiffresMin, TELEPHONE_INVALIDE)

export function texteCourtSchema(max: number = CONTACT_LIMITS.texteCourtMax) {
  return z
    .string({ required_error: CHAMP_REQUIS })
    .trim()
    .min(CONTACT_LIMITS.texteCourtMin, `Ce champ est requis (${CONTACT_LIMITS.texteCourtMin} caractères minimum).`)
    .max(max, `${max} caractères au maximum.`)
    .refine((s) => !CONTROLE_PATTERN.test(s), 'Caractères non autorisés.')
}

/** Date "YYYY-MM-DD" entre aujourd'hui (fuseau Québec) et aujourd'hui + `dateMaxJours`. */
export const dateFutureSchema = z.string({ required_error: CHAMP_REQUIS }).superRefine((date, ctx) => {
  if (!isDateCalendaireValide(date)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choisissez une date valide.' })
    return
  }
  const aujourdhui = dateDuJourQuebec()
  if (date < aujourdhui) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La date doit être aujourd’hui ou plus tard.' })
  } else if (date > ajouterJoursIso(aujourdhui, CONTACT_LIMITS.dateMaxJours)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Date trop éloignée.' })
  }
})

function schemaDetail(champ: ChampDetail): z.ZodTypeAny {
  switch (champ.type) {
    case 'texte':
      return texteCourtSchema()
    case 'date-future':
      return dateFutureSchema
    case 'entier': {
      const bornes = `Entre ${champ.min} et ${champ.max}.`
      return z.coerce
        .number({ invalid_type_error: 'Indiquez un nombre.' })
        .int('Nombre entier attendu.')
        .min(champ.min, bornes)
        .max(champ.max, bornes)
    }
    case 'select':
      return z.enum(champ.options.map((option) => option.value) as [string, ...string[]], {
        errorMap: () => ({ message: 'Sélectionnez une option.' }),
      })
  }
}

export type DetailsContact = Readonly<Record<string, string | number>>
type DetailsSchema = z.ZodType<DetailsContact, z.ZodTypeDef, Record<string, unknown>>

function detailsSchema(config: ConfigFormulaireContact): DetailsSchema {
  const shape = Object.fromEntries(config.champs.filter(estChampDetail).map((champ) => [champ.cle, schemaDetail(champ)]))
  // Seul cast du fichier : la forme exacte est connue au runtime (config) ; le type statique est
  // l'enveloppe commune des 6 filiales, couverte par les tests (tests/unit/contact-forms.test.ts).
  return z.object(shape).strict() as unknown as DetailsSchema
}

const aChamp = (config: ConfigFormulaireContact, type: ChampContact['type']) =>
  config.champs.some((champ) => champ.type === type)

function formSchemaFiliale(config: ConfigFormulaireContact) {
  return z
    .object({
      nom: nomContactSchema,
      email: emailContactSchema,
      message: messageContactSchema,
      website: honeypotSchema,
      telephone: aChamp(config, 'telephone') ? telephoneContactSchema : z.undefined(),
      entreprise: aChamp(config, 'entreprise') ? texteCourtSchema(CONTACT_LIMITS.entrepriseMax) : z.undefined(),
      details: detailsSchema(config),
    })
    .strict()
}

/** Valeurs du formulaire de contact d'une filiale (VeeValidate, toTypedSchema). */
export function filialeContactFormSchema(slug: FormulaireFilialeSlug) {
  return formSchemaFiliale(CONTACT_FORMS[slug])
}

const varianteFiliale = <S extends FormulaireFilialeSlug>(slug: S) =>
  filialeContactFormSchema(slug).extend({ formulaire: z.literal(slug) })

/** Valeurs du formulaire « suggestion de produit » (cdpaa, boissons). */
export const suggestionFormSchema = z
  .object({
    nom: nomContactSchema,
    email: emailContactSchema,
    produitSouhaite: texteCourtSchema(),
    paysOrigine: texteCourtSchema(CONTACT_LIMITS.paysMax),
    message: messageContactSchema,
    website: honeypotSchema,
  })
  .strict()

export const suggestionBodySchema = suggestionFormSchema.extend({
  formulaire: z.literal('suggestion'),
  site: z.enum(SITES_SUGGESTION),
})

// --- Assistant import-export (cdpaa) : variante de POST /api/public/contact (T0, spec lot 3 §3) ---

const videEnUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const enumEtape = (options: readonly { readonly value: string }[]) =>
  z.enum(options.map((x) => x.value) as [string, ...string[]], { errorMap: () => ({ message: 'Choisissez une réponse.' }) })

// Seul cast : forme dérivée de la config au runtime ; le type statique (ReponsesAssistant) est
// couvert par les tests (tests/unit/assistant-content.test.ts).
export const reponsesAssistantSchema = z
  .object(Object.fromEntries(ETAPES_ASSISTANT.map((e) => [e.cle, enumEtape(e.options)])))
  .strict() as unknown as z.ZodType<ReponsesAssistant, z.ZodTypeDef, Record<string, unknown>>

export const assistantFormSchema = z
  .object({
    nom: nomContactSchema,
    email: emailContactSchema,
    entreprise: z.preprocess(videEnUndefined, texteCourtSchema(CONTACT_LIMITS.entrepriseMax).optional()),
    telephone: z.preprocess(videEnUndefined, telephoneContactSchema.optional()),
    website: honeypotSchema,
  })
  .strict()

export const assistantBodySchema = assistantFormSchema.extend({
  formulaire: z.literal('assistant'),
  reponses: reponsesAssistantSchema,
})

export type AssistantFormValues = z.input<typeof assistantFormSchema>

/** Corps de POST /api/public/contact — une variante par formulaire (DEC-12). */
export const contactBodySchema = z.discriminatedUnion('formulaire', [
  holdingContactBodySchema,
  varianteFiliale('entretien'),
  varianteFiliale('transport'),
  varianteFiliale('comptable'),
  varianteFiliale('placement'),
  varianteFiliale('cdpaa'),
  varianteFiliale('boissons'),
  suggestionBodySchema,
  assistantBodySchema,
])

export type HoldingContactFormValues = z.input<typeof holdingContactFormSchema>
export type FilialeContactFormValues = z.input<ReturnType<typeof filialeContactFormSchema>>
export type SuggestionFormValues = z.input<typeof suggestionFormSchema>
export type ContactBody = z.infer<typeof contactBodySchema>
export type ContactFormulaire = ContactBody['formulaire']
