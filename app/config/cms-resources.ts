// Configuration déclarative des collections CMS (services, réalisations, équipe, partenaires) —
// consommée par CmsCollectionEditor.vue (générique, spec phase 2 §4.5). Un objet par ressource :
// aucune logique de composant ici, seulement des données et de petites fonctions pures.
import { CMS_TEXT_BOUNDS, MAX_SERVICES_MIS_EN_AVANT } from '#shared/config/cms'
import type { CmsField } from '#shared/content/sections/types'
import type {
  CmsItemBase,
  CmsMembreEquipeDto,
  CmsPartenaireDto,
  CmsRealisationDto,
  CmsServiceDto,
} from '#shared/types/cms'
import {
  createMembreEquipeSchema,
  createPartenaireSchema,
  createRealisationSchema,
  createServiceSchema,
  updateMembreEquipeSchema,
  updatePartenaireSchema,
  updateRealisationSchema,
  updateServiceSchema,
  type CreateMembreEquipeInput,
  type CreatePartenaireInput,
  type CreateRealisationInput,
  type CreateServiceInput,
} from '#shared/validation/cms'
import type { ZodType } from 'zod'

export interface CmsResourceLibelles {
  readonly titre: string
  readonly description: string
  readonly ajouter: string
  readonly vide: string
}

export interface CmsResourceToggle {
  readonly field: string
  readonly label: string
  readonly max?: number
}

export interface CmsResourceConfig<TItem extends CmsItemBase, TForm extends Record<string, unknown>> {
  readonly key: string
  readonly endpoint: `/api/admin/contenu/${string}`
  readonly libelles: CmsResourceLibelles
  /** false : ressource non applicable à la holding (ex. services). */
  readonly allowHolding: boolean
  readonly fields: readonly CmsField[]
  readonly createSchema: ZodType<TForm>
  readonly updateSchema: ZodType<Partial<TForm>>
  /** `null` : valeurs par défaut d'une nouvelle fiche. */
  toForm(item: TItem | null): TForm
  primary(item: TItem): string
  secondary(item: TItem): string | null
  imageKey(item: TItem): string | null
  readonly reorderable: boolean
  readonly toggle?: CmsResourceToggle
}

// --- Services ---------------------------------------------------------------
const SERVICE_FIELDS: readonly CmsField[] = [
  { key: 'titre', label: 'Titre', type: 'text', required: true, minLength: CMS_TEXT_BOUNDS.titre.min, maxLength: CMS_TEXT_BOUNDS.titre.max },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    required: true,
    minLength: CMS_TEXT_BOUNDS.description.min,
    maxLength: CMS_TEXT_BOUNDS.description.max,
  },
  { key: 'imageKey', label: 'Image', type: 'image' },
]

export const servicesConfig: CmsResourceConfig<CmsServiceDto, CreateServiceInput> = {
  key: 'services',
  endpoint: '/api/admin/contenu/services',
  libelles: {
    titre: 'Services',
    description: 'Les prestations affichées sur la page Services de chaque filiale.',
    ajouter: 'Ajouter un service',
    vide: 'Aucun service pour ce site.',
  },
  allowHolding: false,
  fields: SERVICE_FIELDS,
  createSchema: createServiceSchema,
  updateSchema: updateServiceSchema,
  toForm: (item) => ({ titre: item?.titre ?? '', description: item?.description ?? '', imageKey: item?.imageKey ?? null }),
  primary: (item) => item.titre,
  secondary: (item) => item.description,
  imageKey: (item) => item.imageKey,
  reorderable: true,
  toggle: { field: 'misEnAvant', label: 'Mis en avant', max: MAX_SERVICES_MIS_EN_AVANT },
}

// --- Réalisations ---------------------------------------------------------------
const REALISATION_FIELDS: readonly CmsField[] = [
  { key: 'titre', label: 'Titre', type: 'text', required: true, minLength: CMS_TEXT_BOUNDS.titre.min, maxLength: CMS_TEXT_BOUNDS.titre.max },
  {
    key: 'description',
    label: 'Description',
    type: 'textarea',
    required: true,
    minLength: CMS_TEXT_BOUNDS.description.min,
    maxLength: CMS_TEXT_BOUNDS.description.max,
  },
  { key: 'imageKey', label: 'Image', type: 'image' },
  { key: 'dateRealisation', label: 'Date de réalisation', type: 'date' },
]

export const realisationsConfig: CmsResourceConfig<CmsRealisationDto, CreateRealisationInput> = {
  key: 'realisations',
  endpoint: '/api/admin/contenu/realisations',
  libelles: {
    titre: 'Réalisations',
    description: 'Les projets et mandats mis en avant sur chaque site.',
    ajouter: 'Ajouter une réalisation',
    vide: 'Aucune réalisation pour ce site.',
  },
  allowHolding: true,
  fields: REALISATION_FIELDS,
  createSchema: createRealisationSchema,
  updateSchema: updateRealisationSchema,
  toForm: (item) => ({
    titre: item?.titre ?? '',
    description: item?.description ?? '',
    imageKey: item?.imageKey ?? null,
    dateRealisation: item?.dateRealisation ?? null,
  }),
  primary: (item) => item.titre,
  secondary: (item) => item.description,
  imageKey: (item) => item.imageKey,
  reorderable: true,
}

// --- Équipe ---------------------------------------------------------------
const EQUIPE_FIELDS: readonly CmsField[] = [
  { key: 'nom', label: 'Nom', type: 'text', required: true, minLength: CMS_TEXT_BOUNDS.nom.min, maxLength: CMS_TEXT_BOUNDS.nom.max },
  { key: 'poste', label: 'Poste', type: 'text', required: true, minLength: CMS_TEXT_BOUNDS.poste.min, maxLength: CMS_TEXT_BOUNDS.poste.max },
  { key: 'photoKey', label: 'Photo', type: 'image' },
  { key: 'bio', label: 'Biographie', type: 'textarea', maxLength: CMS_TEXT_BOUNDS.bio.max },
]

export const equipeConfig: CmsResourceConfig<CmsMembreEquipeDto, CreateMembreEquipeInput> = {
  key: 'equipe',
  endpoint: '/api/admin/contenu/equipe',
  libelles: {
    titre: 'Équipe',
    description: 'Les personnes présentées sur la page À propos de chaque site.',
    ajouter: 'Ajouter un membre',
    vide: 'Aucun membre pour ce site.',
  },
  allowHolding: true,
  fields: EQUIPE_FIELDS,
  createSchema: createMembreEquipeSchema,
  updateSchema: updateMembreEquipeSchema,
  toForm: (item) => ({
    nom: item?.nom ?? '',
    poste: item?.poste ?? '',
    photoKey: item?.photoKey ?? null,
    bio: item?.bio ?? null,
  }),
  primary: (item) => item.nom,
  secondary: (item) => item.poste,
  imageKey: (item) => item.photoKey,
  reorderable: true,
}

// --- Partenaires ---------------------------------------------------------------
const PARTENAIRE_FIELDS: readonly CmsField[] = [
  { key: 'nom', label: 'Nom', type: 'text', required: true, minLength: CMS_TEXT_BOUNDS.nom.min, maxLength: CMS_TEXT_BOUNDS.nom.max },
  { key: 'typeRelation', label: 'Type de relation', type: 'text', maxLength: CMS_TEXT_BOUNDS.typeRelation.max },
  { key: 'logoKey', label: 'Logo', type: 'image' },
  { key: 'siteUrl', label: 'Site web', type: 'url' },
]

export const partenairesConfig: CmsResourceConfig<CmsPartenaireDto, CreatePartenaireInput> = {
  key: 'partenaires',
  endpoint: '/api/admin/contenu/partenaires',
  libelles: {
    titre: 'Partenaires',
    description: 'Les organisations partenaires affichées sur les sites.',
    ajouter: 'Ajouter un partenaire',
    vide: 'Aucun partenaire pour ce site.',
  },
  allowHolding: true,
  fields: PARTENAIRE_FIELDS,
  createSchema: createPartenaireSchema,
  updateSchema: updatePartenaireSchema,
  toForm: (item) => ({
    nom: item?.nom ?? '',
    typeRelation: item?.typeRelation ?? null,
    logoKey: item?.logoKey ?? null,
    siteUrl: item?.siteUrl ?? null,
  }),
  primary: (item) => item.nom,
  secondary: (item) => item.typeRelation,
  imageKey: (item) => item.logoKey,
  reorderable: true,
}
