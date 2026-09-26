// Validation des formulaires de contact publics (spec docs/specs/phase3-holding-contact.md §3.1).
// Source unique client (VeeValidate) + serveur (POST /api/public/contact). Imports relatifs et
// zod explicite : ce fichier doit rester importable par tsx (seed, scripts).
import { z } from 'zod'
import { SITE_SLUGS } from '../config/sites'

export const CONTACT_LIMITS = {
  nomMin: 2,
  nomMax: 120,
  emailMax: 254,
  messageMin: 10,
  messageMax: 5000,
  honeypotMax: 200,
} as const

// Lettres de toutes langues, espaces, apostrophes ' ’, point, trait d'union. Pas de chiffres ni
// de « @ / : » : aucune URL possible dans un nom repris par l'accusé de réception (anti-relais).
const NOM_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u
// Caractères de contrôle refusés (un NUL ferait une 500 Postgres), sauf \t \n \r.
// eslint-disable-next-line no-control-regex
const CONTROLE_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

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

/** Corps de POST /api/public/contact — une variante par formulaire (DEC-12). */
export const contactBodySchema = z.discriminatedUnion('formulaire', [holdingContactBodySchema])

export type HoldingContactFormValues = z.input<typeof holdingContactFormSchema>
export type ContactBody = z.infer<typeof contactBodySchema>
export type ContactFormulaire = ContactBody['formulaire']
