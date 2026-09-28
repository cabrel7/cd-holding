// Formulaires de contact des filiales (spec docs/specs/lot2-contact-filiales.md §1) — source
// unique : variantes zod (shared/validation/contact.ts), rendu (FilialeContactForm), mapping
// serveur (server/lib/contact.ts). Aucun `if (slug === …)` ailleurs. Les valeurs d'options sont
// des clés stables stockées en base ; les libellés peuvent changer sans migration.
// Imports relatifs uniquement (importable par tsx).
import type { FilialeSlug } from './sites'

export interface OptionChamp {
  readonly value: string
  readonly label: string
}
type Options = readonly [OptionChamp, ...OptionChamp[]]

interface ChampBase {
  readonly label: string
  readonly placeholder?: string
  readonly pleineLargeur?: boolean
}

export type ChampContact =
  | (ChampBase & { readonly type: 'nom' | 'email' | 'telephone' | 'entreprise' })
  | (ChampBase & { readonly type: 'message'; readonly lignes: number })
  | (ChampBase & { readonly type: 'texte' | 'date-future'; readonly cle: string })
  | (ChampBase & { readonly type: 'select'; readonly cle: string; readonly options: Options })
  | (ChampBase & { readonly type: 'entier'; readonly cle: string; readonly min: number; readonly max: number })

/** Champ stocké dans `MessageContact.details` (identifié par sa `cle`). */
export type ChampDetail = Extract<ChampContact, { readonly cle: string }>

export interface ConfigFormulaireContact {
  /** Sujet du message, fixé côté serveur (DEC-15) : jamais fourni par le client. */
  readonly sujet: string
  readonly bouton: string
  readonly toastTitre: string
  readonly champs: readonly ChampContact[]
}

export const FORMULAIRES_FILIALES = [
  'entretien',
  'transport',
  'comptable',
  'placement',
  'ccdpaa',
  'boissons',
] as const satisfies readonly FilialeSlug[]
export type FormulaireFilialeSlug = (typeof FORMULAIRES_FILIALES)[number]

export function estFormulaireFiliale(value: string): value is FormulaireFilialeSlug {
  return (FORMULAIRES_FILIALES as readonly string[]).includes(value)
}

export function estChampDetail(champ: ChampContact): champ is ChampDetail {
  return 'cle' in champ
}

const o = (value: string, label: string): OptionChamp => ({ value, label })
const COMMUN = { bouton: 'Envoyer la demande', toastTitre: 'Demande reçue' } as const
const nom = (label = 'Nom'): ChampContact => ({ type: 'nom', label, placeholder: 'Jean Tremblay' })
const email = (pleineLargeur = false): ChampContact => ({
  type: 'email',
  label: 'Courriel',
  placeholder: 'vous@exemple.ca',
  pleineLargeur,
})
const telephone: ChampContact = { type: 'telephone', label: 'Téléphone', placeholder: '514-000-0000' }
const message = (label: string, placeholder: string, lignes: number): ChampContact => ({
  type: 'message',
  label,
  placeholder,
  lignes,
  pleineLargeur: true,
})

export const CONTACT_FORMS = {
  entretien: {
    ...COMMUN,
    sujet: 'Demande de soumission — entretien',
    champs: [
      nom('Nom complet'),
      telephone,
      email(true),
      {
        type: 'select',
        cle: 'typePropriete',
        label: 'Type de propriété',
        options: [
          o('bureau-commerce', 'Bureau / commerce'),
          o('residence', 'Résidence / condo'),
          o('supermarche', 'Supermarché / commerce alimentaire'),
          o('chantier', 'Chantier / rénovation'),
          o('autre', 'Autre'),
        ],
      },
      {
        type: 'select',
        cle: 'frequence',
        label: 'Fréquence souhaitée',
        options: [
          o('unique', 'Unique'),
          o('hebdomadaire', 'Hebdomadaire'),
          o('aux-deux-semaines', 'Aux deux semaines'),
          o('mensuelle', 'Mensuelle'),
        ],
      },
      message('Détails', 'Superficie, contraintes d’accès, dates…', 4),
    ],
  },
  transport: {
    ...COMMUN,
    sujet: 'Demande de devis — transport',
    champs: [
      nom(),
      telephone,
      email(true),
      {
        type: 'select',
        cle: 'typeTransport',
        label: 'Type de transport',
        options: [
          o('demenagement-residentiel', 'Déménagement résidentiel'),
          o('demenagement-commercial', 'Déménagement commercial'),
          o('marchandises', 'Transport de marchandises'),
          o('dernier-kilometre', 'Livraison du dernier kilomètre'),
        ],
      },
      { type: 'date-future', cle: 'dateSouhaitee', label: 'Date souhaitée' },
      { type: 'texte', cle: 'origine', label: 'Origine', placeholder: 'Ville / code postal' },
      { type: 'texte', cle: 'destination', label: 'Destination', placeholder: 'Ville / code postal' },
      message('Détails', 'Volume, contraintes d’accès, étages…', 4),
    ],
  },
  comptable: {
    ...COMMUN,
    sujet: 'Demande de consultation',
    champs: [
      nom('Nom complet'),
      { type: 'entreprise', label: 'Nom d’entreprise' },
      email(),
      telephone,
      {
        type: 'select',
        cle: 'structure',
        label: 'Structure',
        options: [
          o('travailleur-autonome', 'Travailleur autonome'),
          o('societe-incorporee', 'Société incorporée'),
          o('obnl', 'OBNL'),
          o('autre', 'Autre'),
        ],
      },
      {
        type: 'select',
        cle: 'besoin',
        label: 'Besoin principal',
        options: [
          o('tenue-livres', 'Tenue de livres régulière'),
          o('paie', 'Paie'),
          o('tps-tvq', 'TPS / TVQ'),
          o('etats-financiers', 'États financiers'),
          o('impot', 'Déclarations d’impôt (T1 / T2)'),
          o('creation', 'Création d’entreprise'),
          o('regularisation', 'Régularisation ou dossier en retard'),
        ],
      },
      message('Contexte', 'Chiffre d’affaires approximatif, nombre d’employés, logiciel utilisé…', 4),
    ],
  },
  placement: {
    ...COMMUN,
    sujet: 'Besoin de personnel',
    champs: [
      nom(),
      { type: 'entreprise', label: 'Entreprise' },
      email(),
      telephone,
      {
        type: 'select',
        cle: 'poste',
        label: 'Type de poste',
        options: [
          o('manutention', 'Manutention'),
          o('chauffeur-classe-1', 'Chauffeur classe 1'),
          o('chauffeur-classe-3-5', 'Chauffeur classe 3 / 5'),
          o('recrutement-international', 'Recrutement international (PTET)'),
          o('autre', 'Autre'),
        ],
      },
      { type: 'entier', cle: 'nombrePostes', label: 'Nombre de postes', placeholder: 'Ex. 5', min: 1, max: 500 },
      message('Contexte', 'Lieu, horaires, urgence…', 4),
    ],
  },
  ccdpaa: {
    ...COMMUN,
    sujet: 'Demande de catalogue (distribution B2B)',
    champs: [
      nom(),
      { type: 'entreprise', label: 'Entreprise' },
      email(),
      telephone,
      {
        type: 'select',
        cle: 'categorie',
        label: 'Catégorie',
        options: [
          o('fruits-legumes', 'Fruits et légumes'),
          o('epices-condiments', 'Épices et condiments'),
          o('produits-transformes', 'Produits transformés'),
          o('catalogue-complet', 'Tout le catalogue'),
        ],
      },
      { type: 'texte', cle: 'volume', label: 'Volume estimé', placeholder: 'Ex. 500 kg / mois' },
      message('Détails', 'Produits recherchés, fréquence, région de livraison…', 3),
    ],
  },
  boissons: {
    ...COMMUN,
    sujet: 'Demande de point de vente',
    champs: [
      nom(),
      { type: 'entreprise', label: 'Établissement' },
      {
        type: 'select',
        cle: 'typeEtablissement',
        label: 'Type d’établissement',
        options: [
          o('saq-epicerie', 'SAQ agence / épicerie'),
          o('restaurant', 'Restaurant'),
          o('bar-lounge', 'Bar / lounge'),
          o('hotel', 'Hôtel'),
          o('grossiste', 'Grossiste'),
        ],
      },
      email(),
      telephone,
      { type: 'texte', cle: 'ville', label: 'Ville' },
      {
        type: 'select',
        cle: 'marques',
        label: 'Marques d’intérêt',
        options: [
          o('toutes', 'Toutes nos marques'),
          o('alcoolisees', 'Boissons alcoolisées'),
          o('non-alcoolisees', 'Boissons non alcoolisées'),
          o('sodas', 'Sodas et rafraîchissements'),
        ],
      },
      message('Détails', 'Volume estimé, type de clientèle…', 3),
    ],
  },
} as const satisfies Record<FormulaireFilialeSlug, ConfigFormulaireContact>

export const SITES_SUGGESTION = ['ccdpaa', 'boissons'] as const satisfies readonly FilialeSlug[]
export type SiteSuggestion = (typeof SITES_SUGGESTION)[number]

export function estSiteSuggestion(value: string): value is SiteSuggestion {
  return (SITES_SUGGESTION as readonly string[]).includes(value)
}

export const SUGGESTION_FORM = {
  sujet: 'Suggestion de produit',
  bouton: 'Proposer ce produit',
  toastTitre: 'Suggestion envoyée',
  placeholdersProduit: { ccdpaa: 'Ex. Fonio précuit', boissons: 'Ex. Bissap pétillant' },
} as const satisfies Omit<ConfigFormulaireContact, 'champs'> & {
  readonly placeholdersProduit: Record<SiteSuggestion, string>
}
