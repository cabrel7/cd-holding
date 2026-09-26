// Logique pure du pipeline de contact public (spec docs/specs/phase3-holding-contact.md §3.3).
// AUCUN accès à H3 ni à Prisma ici (skill nitro) : ce fichier est directement testable
// (tests/unit/contact-mapping.test.ts) sans booter Nitro. `server/api/public/contact.post.ts`
// orchestre (rate-limit, lecture Prisma, courriels) et n'y ajoute aucune règle métier.
import { createHash } from 'node:crypto'
import { HOLDING_SLUG, type SiteSlug } from '#shared/config/sites'
import type { ContactBody, ContactFormulaire } from '#shared/validation/contact'

/** Société résolue depuis Prisma (select explicite, jamais l'objet brut) — cible ou holding. */
export interface CibleContact {
  readonly id: number
  readonly slug: SiteSlug
  readonly nom: string
  readonly email: string | null
}

export type TypeMessageContact = 'CONTACT' | 'SUGGESTION_PRODUIT' | 'ASSISTANT_IMPORT_EXPORT'

/** Données prêtes pour `prisma.messageContact.create({ data })`. */
export interface MessageContactData {
  readonly companyId: number
  readonly type: TypeMessageContact
  readonly nom: string
  readonly email: string
  readonly sujet: string
  readonly message: string
  readonly details: { readonly formulaire: ContactFormulaire } & Record<string, unknown>
  readonly telephone?: string | null
  readonly entreprise?: string | null
}

export interface FormulaireHandler<B extends ContactBody> {
  readonly cible: (body: B) => SiteSlug
  readonly construire: (body: B, cible: CibleContact, holding: CibleContact) => MessageContactData
  /** Repris dans la notification interne (`{ origine }`). */
  readonly origine: string
  /** « Contact », « Suggestion de produit »… — repris dans la notification interne. */
  readonly typeLibelle: string
}

/** Sujet du message quand la cible choisie est la holding elle-même (formulaire holding). */
export const SUJET_DEMANDE_GENERALE = 'Demande générale (site du groupe)'

function sujetHolding(cible: CibleContact): string {
  return cible.slug === HOLDING_SLUG ? SUJET_DEMANDE_GENERALE : `Demande — ${cible.nom} (via le site du groupe)`
}

type HoldingContactBody = Extract<ContactBody, { formulaire: 'holding' }>

const holdingHandler: FormulaireHandler<HoldingContactBody> = {
  cible: (body) => body.cible,
  construire: (body, cible) => ({
    companyId: cible.id,
    type: 'CONTACT',
    nom: body.nom,
    email: body.email,
    sujet: sujetHolding(cible),
    message: body.message,
    details: { formulaire: 'holding' },
  }),
  origine: 'site du groupe',
  typeLibelle: 'Contact',
}

/**
 * Registre serveur : `satisfies` fait échouer le typecheck si une variante zod (`ContactBody`)
 * n'a pas son handler ici (DEC-12/13). Une seule entrée livrée pour l'instant (`holding`).
 */
export const FORMULAIRES = { holding: holdingHandler } satisfies {
  [K in ContactFormulaire]: FormulaireHandler<Extract<ContactBody, { formulaire: K }>>
}

/** Adresse de notification interne : la cible d'abord, la holding en repli, sinon aucun envoi. */
export function destinataireInterne(cible: CibleContact, holding: CibleContact): string | null {
  return cible.email ?? holding.email ?? null
}

/**
 * Clé de rate-limit de l'accusé de réception, par destinataire — jamais l'adresse en clair
 * (CLAUDE.md « logs sans donnée personnelle » ; cette clé peut vivre longtemps en mémoire).
 * Déterministe : la même adresse produit toujours la même clé.
 */
export function cleAccuseReception(email: string): string {
  return `accuse:${createHash('sha256').update(email).digest('hex')}`
}
