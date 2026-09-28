// Logique pure du pipeline de contact public (spec docs/specs/phase3-holding-contact.md §3.3,
// docs/specs/lot2-contact-filiales.md §2). AUCUN accès à H3 ni à Prisma ici (skill nitro) : ce
// fichier est directement testable (tests/unit/contact-mapping.test.ts) sans booter Nitro.
// `server/api/public/contact.post.ts` orchestre (rate-limit, lecture Prisma, courriels) et n'y
// ajoute aucune règle métier.
import { createHash } from 'node:crypto'
import { CONTACT_FORMS, SUGGESTION_FORM, type FormulaireFilialeSlug } from '#shared/config/contact-forms'
import { HOLDING_SLUG, type SiteSlug } from '#shared/config/sites'
import {
  ASSISTANT_FORM,
  ASSISTANT_SITE,
  palierRecommandation,
  recapReponses,
  type ReponsesAssistant,
} from '#shared/content/ccdpaa/assistant-import-export'
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
  readonly produitSouhaite?: string | null
  readonly paysOrigine?: string | null
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
 * Fabrique unique pour les 6 formulaires de filiale (spec lot 2 §2) : `cible` renvoie le slug
 * lui-même (jamais une valeur du corps), `sujet` vient de la config (DEC-15, jamais du client),
 * `formulaire` est réécrit en dernier dans `details` pour ne jamais être écrasé par le corps
 * (le schéma zod est `.strict()`, donc `body.details` ne peut de toute façon pas contenir cette clé).
 */
function handlerFiliale<S extends FormulaireFilialeSlug>(
  slug: S,
): FormulaireHandler<Extract<ContactBody, { formulaire: S }>> {
  return {
    cible: () => slug,
    construire: (bodyGenerique, cible) => {
      // À l'intérieur d'une fonction générique, TS ne résout pas les propriétés d'un
      // `Extract<Union, { discriminant: S }>` tant que `S` (type paramètre) n'est pas instancié
      // (limitation connue des types conditionnels génériques). Ce recentrage sur le type concret
      // `FormulaireFilialeSlug` (au lieu du `S` générique) est sans effet au runtime — les 6
      // variantes de filiale partagent la même forme pour ces champs — et rend `body.*` lisible.
      const body = bodyGenerique as Extract<ContactBody, { formulaire: FormulaireFilialeSlug }>
      return {
        companyId: cible.id,
        type: 'CONTACT',
        nom: body.nom,
        email: body.email,
        telephone: body.telephone ?? null,
        entreprise: body.entreprise ?? null,
        sujet: CONTACT_FORMS[slug].sujet,
        message: body.message,
        details: { ...body.details, formulaire: slug },
      }
    },
    origine: 'site de la filiale',
    typeLibelle: 'Contact',
  }
}

type SuggestionContactBody = Extract<ContactBody, { formulaire: 'suggestion' }>

const suggestionHandler: FormulaireHandler<SuggestionContactBody> = {
  cible: (body) => body.site,
  construire: (body, cible) => ({
    companyId: cible.id,
    type: 'SUGGESTION_PRODUIT',
    nom: body.nom,
    email: body.email,
    sujet: SUGGESTION_FORM.sujet,
    message: body.message,
    produitSouhaite: body.produitSouhaite,
    paysOrigine: body.paysOrigine,
    details: { formulaire: 'suggestion' },
  }),
  origine: 'formulaire de suggestion',
  typeLibelle: 'Suggestion de produit',
}

type AssistantContactBody = Extract<ContactBody, { formulaire: 'assistant' }>

/** Une ligne « Libellé : valeur » par étape — message lisible pour la notification interne. */
function messageAssistant(reponses: ReponsesAssistant): string {
  return recapReponses(reponses)
    .map((entree) => `${entree.libelle} : ${entree.valeur}`)
    .join('\n')
}

/**
 * Variante de `POST /api/public/contact` pour l'assistant import-export (ccdpaa, spec lot 3 §3) :
 * questionnaire scripté (aucune IA), cible fixe (jamais une valeur du corps), `palier` calculé
 * côté serveur à partir du volume déclaré et stocké dans `details` pour l'admin (lot 5).
 */
const assistantHandler: FormulaireHandler<AssistantContactBody> = {
  cible: () => ASSISTANT_SITE,
  construire: (body, cible) => ({
    companyId: cible.id,
    type: 'ASSISTANT_IMPORT_EXPORT',
    nom: body.nom,
    email: body.email,
    telephone: body.telephone ?? null,
    entreprise: body.entreprise ?? null,
    sujet: ASSISTANT_FORM.sujet,
    message: messageAssistant(body.reponses),
    details: { ...body.reponses, palier: palierRecommandation(body.reponses.volume), formulaire: 'assistant' },
  }),
  origine: 'assistant import-export',
  typeLibelle: 'Assistant import-export',
}

/**
 * Registre serveur : `satisfies` fait échouer le typecheck si une variante zod (`ContactBody`)
 * n'a pas son handler ici, ou si un handler ne traite pas correctement SA propre variante (DEC-12/13).
 */
const REGISTRE = {
  holding: holdingHandler,
  entretien: handlerFiliale('entretien'),
  transport: handlerFiliale('transport'),
  comptable: handlerFiliale('comptable'),
  placement: handlerFiliale('placement'),
  ccdpaa: handlerFiliale('ccdpaa'),
  boissons: handlerFiliale('boissons'),
  suggestion: suggestionHandler,
  assistant: assistantHandler,
} satisfies {
  [K in ContactFormulaire]: FormulaireHandler<Extract<ContactBody, { formulaire: K }>>
}

/**
 * Vue exposée au point d'appel (`FORMULAIRES[body.formulaire]` dans `contact.post.ts`) : indexer
 * un objet par un discriminant (union) ne corrèle pas, pour TS, la valeur retenue au paramètre de
 * la fonction appelée avec le même `body` — limitation connue des tables de handlers sur union
 * discriminée (l'intersection des paramètres se réduit à `never`). `REGISTRE` ci-dessus a déjà
 * validé, via `satisfies`, qu'il existe un handler par variante et que chacun traite bien SA
 * propre variante ; ce cast élargit la vue de consommation sans rien changer au runtime (mêmes
 * objets). Couvert par `tests/unit/contact-mapping.test.ts` (un test par handler).
 */
export const FORMULAIRES: Record<ContactFormulaire, FormulaireHandler<ContactBody>> =
  REGISTRE as Record<ContactFormulaire, FormulaireHandler<ContactBody>>

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
