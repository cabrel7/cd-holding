// Validation des collections CMS (services, réalisations, équipe, partenaires) et des
// sections — source unique client (VeeValidate, T4) + serveur (readValidatedBody, T1),
// voir CLAUDE.md § Backend/API. Tous les objets sont `.strict()` : un champ imprévu est
// une erreur 400, jamais ignoré silencieusement.
import { z } from 'zod'
import { CMS_TEXT_BOUNDS, DATE_ISO_PATTERN, MAX_REORDER_ITEMS } from '../config/cms'
import { siteSlugSchema } from '../config/sites'
import { STORAGE_KEY_PATTERN } from '../config/upload'

const titreSchema = z.string().trim().min(CMS_TEXT_BOUNDS.titre.min).max(CMS_TEXT_BOUNDS.titre.max)
const nomSchema = z.string().trim().min(CMS_TEXT_BOUNDS.nom.min).max(CMS_TEXT_BOUNDS.nom.max)
const posteSchema = z.string().trim().min(CMS_TEXT_BOUNDS.poste.min).max(CMS_TEXT_BOUNDS.poste.max)
const descriptionSchema = z.string().trim().min(CMS_TEXT_BOUNDS.description.min).max(CMS_TEXT_BOUNDS.description.max)
const bioSchema = z.string().trim().max(CMS_TEXT_BOUNDS.bio.max)
const typeRelationSchema = z.string().trim().max(CMS_TEXT_BOUNDS.typeRelation.max)
const imageKeySchema = z.string().regex(STORAGE_KEY_PATTERN, 'Clé de fichier invalide')
const dateISOSchema = z.string().regex(DATE_ISO_PATTERN, 'Format attendu : YYYY-MM-DD')
const httpsUrlSchema = z
  .string()
  .trim()
  .url('URL invalide')
  .refine((value) => value.startsWith('https://'), 'https uniquement')

/** Refuse un objet de mise à jour vide (au moins un champ modifiable requis, `site` exclu). */
function exigerAuMoinsUnChamp<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine(
    (obj) => Object.entries(obj).some(([cle, valeur]) => cle !== 'site' && valeur !== undefined),
    { message: 'Au moins un champ à modifier est requis' },
  )
}

export const listQuerySchema = z.object({ site: siteSlugSchema.optional() }).strict()

// --- Service ---------------------------------------------------------------
export const createServiceSchema = z
  .object({
    site: siteSlugSchema.optional(),
    titre: titreSchema,
    description: descriptionSchema,
    imageKey: imageKeySchema.nullable().optional(),
    misEnAvant: z.boolean().optional(),
  })
  .strict()

export const updateServiceSchema = exigerAuMoinsUnChamp(createServiceSchema.partial())

// --- Réalisation ---------------------------------------------------------------
export const createRealisationSchema = z
  .object({
    site: siteSlugSchema.optional(),
    titre: titreSchema,
    description: descriptionSchema,
    imageKey: imageKeySchema.nullable().optional(),
    dateRealisation: dateISOSchema.nullable().optional(),
  })
  .strict()

export const updateRealisationSchema = exigerAuMoinsUnChamp(createRealisationSchema.partial())

// --- Membre d'équipe ---------------------------------------------------------------
export const createMembreEquipeSchema = z
  .object({
    site: siteSlugSchema.optional(),
    nom: nomSchema,
    poste: posteSchema,
    bio: bioSchema.nullable().optional(),
    photoKey: imageKeySchema.nullable().optional(),
  })
  .strict()

export const updateMembreEquipeSchema = exigerAuMoinsUnChamp(createMembreEquipeSchema.partial())

// --- Partenaire ---------------------------------------------------------------
export const createPartenaireSchema = z
  .object({
    site: siteSlugSchema.optional(),
    nom: nomSchema,
    typeRelation: typeRelationSchema.nullable().optional(),
    siteUrl: httpsUrlSchema.nullable().optional(),
    logoKey: imageKeySchema.nullable().optional(),
  })
  .strict()

export const updatePartenaireSchema = exigerAuMoinsUnChamp(createPartenaireSchema.partial())

// --- Réordonnancement (transaction, ensemble exact du site) -----------------------------
export const reorderSchema = z
  .object({
    site: siteSlugSchema.optional(),
    uuids: z.array(z.string().uuid()).min(1).max(MAX_REORDER_ITEMS),
  })
  .strict()
  .refine((obj) => new Set(obj.uuids).size === obj.uuids.length, { message: 'uuids en double' })

// --- Sections (donnees validées par le schéma du type de la ligne, voir T1) -------------
export const sectionUpdateSchema = z.object({ donnees: z.record(z.string(), z.unknown()) }).strict()

export const sectionsQuerySchema = z.object({ site: siteSlugSchema }).strict()

export type CreateServiceInput = z.infer<typeof createServiceSchema>
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>
export type CreateRealisationInput = z.infer<typeof createRealisationSchema>
export type UpdateRealisationInput = z.infer<typeof updateRealisationSchema>
export type CreateMembreEquipeInput = z.infer<typeof createMembreEquipeSchema>
export type UpdateMembreEquipeInput = z.infer<typeof updateMembreEquipeSchema>
export type CreatePartenaireInput = z.infer<typeof createPartenaireSchema>
export type UpdatePartenaireInput = z.infer<typeof updatePartenaireSchema>
export type ReorderInput = z.infer<typeof reorderSchema>
