// Champs, valeurs initiales et schémas du formulaire client (/admin/clients), consommés par
// CmsFormDialog. La validation finale reste celle des schémas zod partagés (une seule source
// de vérité avec le serveur) ; le wrapper `enFrancais` ne fait que traduire les messages.
import { z, type ZodErrorMap, type ZodType } from 'zod'
import type { CmsField } from '#shared/content/sections/types'
import { CLIENT_TEXT_BOUNDS, STATUT_CLIENT_LABELS } from '#shared/config/admin'
import { SITE_SLUGS } from '#shared/config/sites'
import type { AdminClientDto, AdminSiteSummary } from '#shared/types/admin'
import { clientCreateSchema, clientUpdateSchema } from '#shared/validation/admin'

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

export interface ClientFieldsOptions {
  /** Champ « Site » : création par le super administrateur uniquement (filiale immuable ensuite). */
  readonly withSite: boolean
  readonly sites: readonly AdminSiteSummary[]
  /** Édition d'un client sans courriel (hérité) : le courriel n'est pas exigé. */
  readonly emailOptionnel?: boolean
}

export function clientFields({ withSite, sites, emailOptionnel = false }: ClientFieldsOptions): readonly CmsField[] {
  const fields: CmsField[] = []
  if (withSite) {
    fields.push({
      key: 'site',
      label: 'Site',
      type: 'select',
      required: true,
      options: sites.map((s) => ({ value: s.slug, label: s.nomCourt ?? s.nom })),
      helpText: 'La filiale ne pourra plus être modifiée ensuite.',
    })
  }
  fields.push(
    { key: 'nom', label: 'Nom', type: 'text', required: true, maxLength: CLIENT_TEXT_BOUNDS.nom.max },
    { key: 'entreprise', label: 'Entreprise', type: 'text', maxLength: CLIENT_TEXT_BOUNDS.entreprise.max },
    { key: 'email', label: 'Courriel', type: 'text', required: !emailOptionnel, maxLength: CLIENT_TEXT_BOUNDS.email.max },
    { key: 'telephone', label: 'Téléphone', type: 'text' },
    {
      key: 'statut',
      label: 'Statut',
      type: 'select',
      required: true,
      options: Object.entries(STATUT_CLIENT_LABELS).map(([value, label]) => ({ value, label })),
    },
    { key: 'notes', label: 'Notes', type: 'textarea', maxLength: CLIENT_TEXT_BOUNDS.notes.max },
  )
  return fields
}

/** Valeurs initiales (jamais `null` dans un champ) : vide pour une création, client pour une édition. */
export function clientInitialValues(client: AdminClientDto | null, withSite: boolean): Record<string, unknown> {
  const values: Record<string, unknown> = {
    nom: client?.nom ?? '',
    entreprise: client?.entreprise ?? '',
    email: client?.email ?? '',
    telephone: client?.telephone ?? '',
    statut: client?.statut ?? 'PROSPECT',
    notes: client?.notes ?? '',
  }
  if (withSite) values.site = ''
  return values
}

const siteRequisSchema = z.enum(SITE_SLUGS, { errorMap: () => ({ message: 'Choisissez un site.' }) })

export function clientCreateFormSchema(withSite: boolean): ZodType {
  return enFrancais(withSite ? clientCreateSchema.extend({ site: siteRequisSchema }) : clientCreateSchema)
}

export function clientEditFormSchema(emailOptionnel: boolean): ZodType {
  if (!emailOptionnel) return enFrancais(clientUpdateSchema)
  // Client hérité sans courriel : un courriel laissé vide n'est pas envoyé (et reste sans courriel).
  return enFrancais(
    z.preprocess((value) => {
      if (typeof value !== 'object' || value === null) return value
      const { email, ...rest } = value as Record<string, unknown>
      return typeof email === 'string' && email.trim() === '' ? rest : value
    }, clientUpdateSchema),
  )
}
