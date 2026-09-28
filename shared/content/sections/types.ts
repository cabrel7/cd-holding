// Catalogue des sections éditables — types (spec phase 2 §1.4).
// Chaque "type" de contenu expose un schéma zod (validation à l'écriture ET à la lecture,
// voir GET .../sections) et une description de champs pour le formulaire générique du CMS
// (T4, CmsFormDialog / CmsFieldInput). Import explicite de zod (contrainte seed, voir §2).
import { z } from 'zod'
import { STORAGE_KEY_PATTERN } from '../../config/upload'

export type CmsFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'url'
  | 'switch'
  | 'select'
  | 'image'
  | 'paragraphes'
  | 'liste'

export interface CmsFieldOption {
  readonly value: string
  readonly label: string
}

export interface CmsField {
  readonly key: string
  readonly label: string
  readonly type: CmsFieldType
  readonly required?: boolean
  readonly maxLength?: number
  readonly minLength?: number
  readonly helpText?: string
  readonly options?: readonly CmsFieldOption[]
  /** Un seul niveau d'imbrication (type 'liste') : champs de chaque élément. */
  readonly itemFields?: readonly CmsField[]
}

export interface SectionTypeDefinition {
  readonly schema: z.ZodType
  readonly fields: readonly CmsField[]
}

const DATE_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const imageKeySchema = z.string().regex(STORAGE_KEY_PATTERN, 'Clé de fichier invalide').nullish()
const imageAltSchema = z.string().trim().max(160).optional()
const surtitreSchema = z.string().trim().max(80).optional()

// --- seo ---------------------------------------------------------------
export const seoSchema = z
  .object({
    title: z.string().trim().min(10).max(70),
    description: z.string().trim().min(50).max(160),
  })
  .strict()

const seoFields: readonly CmsField[] = [
  { key: 'title', label: 'Titre (SEO)', type: 'text', required: true, minLength: 10, maxLength: 70 },
  { key: 'description', label: 'Description (SEO)', type: 'textarea', required: true, minLength: 50, maxLength: 160 },
]

// --- texte ---------------------------------------------------------------
export const texteSchema = z
  .object({
    texte: z.string().trim().min(1).max(600),
  })
  .strict()

const texteFields: readonly CmsField[] = [{ key: 'texte', label: 'Texte', type: 'textarea', required: true, maxLength: 600 }]

// --- section ---------------------------------------------------------------
export const sectionSchema = z
  .object({
    surtitre: surtitreSchema,
    titre: z.string().trim().min(1).max(160),
    texte: z.string().trim().max(1200).optional(),
  })
  .strict()

const sectionFields: readonly CmsField[] = [
  { key: 'surtitre', label: 'Surtitre', type: 'text', maxLength: 80 },
  { key: 'titre', label: 'Titre', type: 'text', required: true, maxLength: 160 },
  { key: 'texte', label: 'Texte', type: 'textarea', maxLength: 1200 },
]

// --- hero ---------------------------------------------------------------
// `legende` : les 2 champs sont produits ensemble par le formulaire CMS (type 'liste' en
// sous-objet, jamais un tableau). Si l'utilisateur laisse les deux champs vides, le preprocess
// convertit l'objet en `undefined` avant validation — sinon `{surtitre:'', titre:''}` échouerait
// sur les `.min(1)` alors que l'intention est "pas de légende" (spec phase 3 §2.2).
const legendeSchema = z.object({ surtitre: z.string().trim().min(1), titre: z.string().trim().min(1) }).strict()

export const heroSchema = z
  .object({
    surtitre: z.string().trim().min(1),
    titre: z.string().trim().min(1),
    texte: z.string().trim().min(1),
    ctaLibelle: z.string().trim().max(40).optional(),
    imageKey: imageKeySchema,
    imageAlt: imageAltSchema,
    legende: z.preprocess(
      (v) =>
        v && typeof v === 'object' && Object.values(v).every((x) => typeof x === 'string' && x.trim() === '')
          ? undefined
          : v,
      legendeSchema.optional(),
    ),
    badgeLibelle: z.string().trim().max(40).optional(),
  })
  .strict()

const heroFields: readonly CmsField[] = [
  { key: 'surtitre', label: 'Surtitre', type: 'text', required: true },
  { key: 'titre', label: 'Titre', type: 'text', required: true },
  { key: 'texte', label: 'Texte', type: 'textarea', required: true },
  { key: 'ctaLibelle', label: "Libellé de l'appel à l'action", type: 'text', maxLength: 40 },
  { key: 'imageKey', label: 'Image', type: 'image', helpText: "Facultatif — à défaut, l'image principale du site est utilisée." },
  { key: 'imageAlt', label: 'Texte alternatif de l\'image', type: 'text', maxLength: 160 },
  {
    key: 'legende',
    label: "Légende de l'image",
    type: 'liste',
    helpText: 'Facultatif — laisser les deux champs vides pour masquer la légende.',
    itemFields: [
      { key: 'surtitre', label: 'Surtitre', type: 'text', maxLength: 80 },
      { key: 'titre', label: 'Titre', type: 'text', maxLength: 80 },
    ],
  },
  { key: 'badgeLibelle', label: 'Libellé du badge', type: 'text', maxLength: 40 },
]

// --- cta ---------------------------------------------------------------
export const ctaSchema = z
  .object({
    titre: z.string().trim().min(1),
    texte: z.string().trim().max(1200).optional(),
    ctaLibelle: z.string().trim().min(1).max(40),
  })
  .strict()

const ctaFields: readonly CmsField[] = [
  { key: 'titre', label: 'Titre', type: 'text', required: true },
  { key: 'texte', label: 'Texte', type: 'textarea', maxLength: 1200 },
  { key: 'ctaLibelle', label: "Libellé de l'appel à l'action", type: 'text', required: true, maxLength: 40 },
]

// --- chiffres ---------------------------------------------------------------
const chiffreItemLibreSchema = z
  .object({ type: z.literal('libre'), valeur: z.string().trim().min(1).max(12), libelle: z.string().trim().min(1) })
  .strict()
const chiffreItemEffectifSchema = z
  .object({ type: z.literal('effectif'), libelle: z.string().trim().min(1), arrondi: z.boolean() })
  .strict()
const chiffreItemFilialesSchema = z.object({ type: z.literal('filiales'), libelle: z.string().trim().min(1) }).strict()

export const chiffreItemSchema = z.discriminatedUnion('type', [
  chiffreItemLibreSchema,
  chiffreItemEffectifSchema,
  chiffreItemFilialesSchema,
])

export type ChiffreItem = z.infer<typeof chiffreItemSchema>

export const chiffresSchema = z
  .object({
    surtitre: surtitreSchema,
    titre: z.string().trim().max(160).optional(),
    texte: z.string().trim().max(1200).optional(),
    items: z.array(chiffreItemSchema).min(1).max(6),
  })
  .strict()

const chiffresFields: readonly CmsField[] = [
  { key: 'surtitre', label: 'Surtitre', type: 'text', maxLength: 80 },
  { key: 'titre', label: 'Titre', type: 'text', maxLength: 160 },
  { key: 'texte', label: 'Texte', type: 'textarea', maxLength: 1200 },
  {
    key: 'items',
    label: 'Chiffres',
    type: 'liste',
    itemFields: [
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        options: [
          { value: 'libre', label: 'Valeur libre' },
          { value: 'effectif', label: "Effectif (calculé)" },
          { value: 'filiales', label: 'Nombre de filiales (calculé)' },
        ],
      },
      { key: 'valeur', label: 'Valeur', type: 'text', maxLength: 12 },
      { key: 'libelle', label: 'Libellé', type: 'text', required: true },
      { key: 'arrondi', label: 'Arrondi (dizaine inférieure, avec « + »)', type: 'switch' },
    ],
  },
]

// --- histoire ---------------------------------------------------------------
export const histoireSchema = z
  .object({
    surtitre: z.string().trim().min(1),
    titre: z.string().trim().min(1),
    paragraphes: z.array(z.string().trim().min(1).max(1200)).min(1).max(4),
  })
  .strict()

const histoireFields: readonly CmsField[] = [
  { key: 'surtitre', label: 'Surtitre', type: 'text', required: true },
  { key: 'titre', label: 'Titre', type: 'text', required: true },
  { key: 'paragraphes', label: 'Paragraphes', type: 'paragraphes', required: true },
]

// --- formulaire ---------------------------------------------------------------
export const formulaireSchema = z
  .object({
    surtitre: surtitreSchema,
    titre: z.string().trim().min(1),
    texte: z.string().trim().max(1200).optional(),
    messageSucces: z.string().trim().min(1).max(200),
    // Texte de la case de consentement Loi 25 (formulaire de candidature). Optionnel : les
    // autres formulaires n'ont pas de case, et une ligne déjà en base (seed = amorçage seul)
    // peut ne pas l'avoir — le composant garde un repli.
    consentement: z.string().trim().min(1).max(400).optional(),
  })
  .strict()

const formulaireFields: readonly CmsField[] = [
  { key: 'surtitre', label: 'Surtitre', type: 'text', maxLength: 80 },
  { key: 'titre', label: 'Titre', type: 'text', required: true },
  { key: 'texte', label: 'Texte', type: 'textarea', maxLength: 1200 },
  { key: 'messageSucces', label: 'Message de succès', type: 'textarea', required: true, maxLength: 200 },
  { key: 'consentement', label: 'Texte de la case de consentement (candidature)', type: 'textarea', maxLength: 400 },
]

// --- duo ---------------------------------------------------------------
const duoCoteSchema = z
  .object({
    surtitre: surtitreSchema,
    titre: z.string().trim().min(1),
    texte: z.string().trim().max(1200).optional(),
    lienLibelle: z.string().trim().min(1).max(40),
    imageKey: imageKeySchema,
    imageAlt: imageAltSchema,
  })
  .strict()

export const duoSchema = z.object({ a: duoCoteSchema, b: duoCoteSchema }).strict()

const duoCoteFields: readonly CmsField[] = [
  { key: 'surtitre', label: 'Surtitre', type: 'text', maxLength: 80 },
  { key: 'titre', label: 'Titre', type: 'text', required: true },
  { key: 'texte', label: 'Texte', type: 'textarea', maxLength: 1200 },
  { key: 'lienLibelle', label: 'Libellé du lien', type: 'text', required: true, maxLength: 40 },
  { key: 'imageKey', label: 'Image', type: 'image' },
  { key: 'imageAlt', label: "Texte alternatif de l'image", type: 'text', maxLength: 160 },
]

const duoFields: readonly CmsField[] = [
  { key: 'a', label: 'Colonne A', type: 'liste', itemFields: duoCoteFields },
  { key: 'b', label: 'Colonne B', type: 'liste', itemFields: duoCoteFields },
]

// --- galerie ---------------------------------------------------------------
const galerieItemSchema = z
  .object({
    titre: z.string().trim().min(1),
    sousTitre: z.string().trim().max(160).optional(),
    imageKey: imageKeySchema,
    imageAlt: imageAltSchema,
  })
  .strict()

export const galerieSchema = z
  .object({
    surtitre: surtitreSchema,
    titre: z.string().trim().min(1),
    items: z.array(galerieItemSchema).min(1).max(12),
  })
  .strict()

const galerieFields: readonly CmsField[] = [
  { key: 'surtitre', label: 'Surtitre', type: 'text', maxLength: 80 },
  { key: 'titre', label: 'Titre', type: 'text', required: true },
  {
    key: 'items',
    label: 'Éléments',
    type: 'liste',
    itemFields: [
      { key: 'titre', label: 'Titre', type: 'text', required: true },
      { key: 'sousTitre', label: 'Sous-titre', type: 'text', maxLength: 160 },
      { key: 'imageKey', label: 'Image', type: 'image' },
      { key: 'imageAlt', label: "Texte alternatif de l'image", type: 'text', maxLength: 160 },
    ],
  },
]

// --- assistant ---------------------------------------------------------------
export const assistantSchema = z
  .object({
    surtitre: z.string().trim().min(1),
    titre: z.string().trim().min(1),
    recommandations: z
      .object({
        petit: z.string().trim().min(1).max(600),
        moyen: z.string().trim().min(1).max(600),
        grand: z.string().trim().min(1).max(600),
      })
      .strict(),
    mentionDelai: z.string().trim().min(1),
  })
  .strict()

const assistantFields: readonly CmsField[] = [
  { key: 'surtitre', label: 'Surtitre', type: 'text', required: true },
  { key: 'titre', label: 'Titre', type: 'text', required: true },
  {
    key: 'recommandations',
    label: 'Recommandations',
    type: 'liste',
    itemFields: [
      { key: 'petit', label: 'Petit volume', type: 'textarea', required: true, maxLength: 600 },
      { key: 'moyen', label: 'Volume moyen', type: 'textarea', required: true, maxLength: 600 },
      { key: 'grand', label: 'Grand volume', type: 'textarea', required: true, maxLength: 600 },
    ],
  },
  { key: 'mentionDelai', label: 'Mention de délai', type: 'text', required: true },
]

// --- legal ---------------------------------------------------------------
const legalSectionSchema = z
  .object({
    titre: z.string().trim().min(1),
    paragraphes: z.array(z.string().trim().min(1).max(4000)),
  })
  .strict()

export const legalSchema = z
  .object({
    titre: z.string().trim().min(1),
    miseAJour: z.string().regex(DATE_ISO_PATTERN, 'Format attendu : YYYY-MM-DD'),
    introduction: z.string().trim().optional(),
    sections: z.array(legalSectionSchema).min(1).max(40),
  })
  .strict()

const legalFields: readonly CmsField[] = [
  { key: 'titre', label: 'Titre', type: 'text', required: true },
  { key: 'miseAJour', label: 'Dernière mise à jour', type: 'date', required: true },
  { key: 'introduction', label: 'Introduction', type: 'textarea' },
  {
    key: 'sections',
    label: 'Sections',
    type: 'liste',
    itemFields: [
      { key: 'titre', label: 'Titre', type: 'text', required: true },
      { key: 'paragraphes', label: 'Paragraphes', type: 'paragraphes', required: true },
    ],
  },
]

// --- catalogue des types ---------------------------------------------------------------
export const SECTION_TYPES = {
  seo: { schema: seoSchema, fields: seoFields },
  texte: { schema: texteSchema, fields: texteFields },
  section: { schema: sectionSchema, fields: sectionFields },
  hero: { schema: heroSchema, fields: heroFields },
  cta: { schema: ctaSchema, fields: ctaFields },
  chiffres: { schema: chiffresSchema, fields: chiffresFields },
  histoire: { schema: histoireSchema, fields: histoireFields },
  formulaire: { schema: formulaireSchema, fields: formulaireFields },
  duo: { schema: duoSchema, fields: duoFields },
  galerie: { schema: galerieSchema, fields: galerieFields },
  assistant: { schema: assistantSchema, fields: assistantFields },
  legal: { schema: legalSchema, fields: legalFields },
} as const satisfies Record<string, SectionTypeDefinition>

export type SectionTypeKey = keyof typeof SECTION_TYPES

export function sectionTypeDefinition(type: SectionTypeKey): SectionTypeDefinition {
  return SECTION_TYPES[type]
}
