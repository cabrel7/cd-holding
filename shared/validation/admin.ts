// Validation des routes admin du lot 4 (messages, clients). Source unique client + serveur.
// Imports relatifs et zod explicite (importable par tsx). Tous les objets sont `.strict()`.
import { z } from 'zod'
import { ADMIN_PAGE_MAX, ADMIN_SEARCH_MAX, CLIENT_TEXT_BOUNDS } from '../config/admin'
import { siteSlugSchema } from '../config/sites'
import { telephoneContactSchema } from './contact'
import { exigerAuMoinsUnChamp } from './cms'

const vide = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const videEnNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

export const statutMessageSchema = z.enum(['NOUVEAU', 'EN_COURS', 'TRAITE'])
export const typeMessageSchema = z.enum(['CONTACT', 'SUGGESTION_PRODUIT', 'ASSISTANT_IMPORT_EXPORT'])
export const statutClientSchema = z.enum(['PROSPECT', 'CLIENT_ACTIF', 'INACTIF'])

const pageSchema = z.coerce.number().int().min(1).max(ADMIN_PAGE_MAX).default(1)
const rechercheSchema = z.preprocess(vide, z.string().trim().max(ADMIN_SEARCH_MAX).optional())

export const messagesQuerySchema = z
  .object({
    site: siteSlugSchema.optional(),
    type: typeMessageSchema.optional(),
    statut: statutMessageSchema.optional(),
    q: rechercheSchema,
    page: pageSchema,
  })
  .strict()

export const clientsQuerySchema = z
  .object({
    site: siteSlugSchema.optional(),
    statut: statutClientSchema.optional(),
    q: rechercheSchema,
    page: pageSchema,
  })
  .strict()

export const messageUpdateSchema = z.object({ statut: statutMessageSchema }).strict()

export const clientCreateSchema = z
  .object({
    site: siteSlugSchema.optional(),
    nom: z.string().trim().min(CLIENT_TEXT_BOUNDS.nom.min).max(CLIENT_TEXT_BOUNDS.nom.max),
    entreprise: z.preprocess(videEnNull, z.string().trim().max(CLIENT_TEXT_BOUNDS.entreprise.max).nullable().optional()),
    email: z.string().trim().toLowerCase().max(CLIENT_TEXT_BOUNDS.email.max).email(),
    telephone: z.preprocess(videEnNull, telephoneContactSchema.nullable().optional()),
    statut: statutClientSchema.default('PROSPECT'),
    notes: z.preprocess(videEnNull, z.string().trim().max(CLIENT_TEXT_BOUNDS.notes.max).nullable().optional()),
  })
  .strict()

export const clientUpdateSchema = exigerAuMoinsUnChamp(clientCreateSchema.omit({ site: true }).partial())

export type MessagesQuery = z.infer<typeof messagesQuerySchema>
export type ClientsQuery = z.infer<typeof clientsQuerySchema>
export type MessageUpdateInput = z.infer<typeof messageUpdateSchema>
export type ClientCreateInput = z.infer<typeof clientCreateSchema>
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>
