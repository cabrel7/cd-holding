# Spec lot 2 : `/{filiale}/contact` (6 filiales) et suggestion de produit

Rédigée par l'architect le 2026-09-28, en lecture seule. À enregistrer dans `docs/specs/lot2-contact-filiales.md`.

**Sources lues** : `docs/specs/phase3-holding-contact.md` (§3, §4.4), `shared/validation/contact.ts`, `server/lib/contact.ts`, `server/api/public/contact.post.ts`, `server/api/admin/messages/index.get.ts`, `app/pages/{contact,[filiale]/a-propos}.vue`, `app/components/site/contact/{ContactIntro,HoldingContactForm}.vue`, `app/components/ui/form/index.ts`, `shared/config/sites.ts`, `shared/content/sections/catalog.ts`, `prisma/seed-data/sections.ts` (FILIALES, `contactFiliale`, placement `audiences`), `prisma/schema.prisma` (MessageContact).
Prototype : `subConfig.ts`, `GenericContactForm.tsx`, `SubContactPage.tsx`, `SuggestionProduitForm.tsx`, `routes/{placement,ccdpaa,entretien}.contact.tsx`, capture `conversion-captures/ccdpaa__contact/1440x900.png`.
Autres : `CONVERSION_INVENTORY.md` (DEC-12 à 15, DEC-38, Q-04, Q-05, Q-11, sections contact), `PROJECT_CONTEXT.md` §2, `PROJECT_STATE.md`.

## Changements par rapport au brief
1. **Placement : un formulaire employeur, sans onglets.** Le lot 1 a déjà envoyé les « Employeurs » vers `/placement/contact` et les « Candidats » vers `/placement/offres` (`FILIALE_DUO_LIENS`, seed `audiences`). Les onglets du prototype deviennent donc inutiles. La candidature spontanée ira sur `/offres` au lot 3.
2. **Demande employeur enregistrée dans `MessageContact`, pas dans `DemandeClient`.** On garde une seule boîte de réception, triée avant toute création dans le CRM. C'est le même raisonnement que « Ajouter au vivier » (inventaire l. 1076).
3. **La valeur d'une option de liste est une clé stable**, et son libellé vit dans la config. Le libellé n'est jamais stocké.
4. **Côté admin, `GET /api/admin/messages` expose en plus `entreprise`, `paysOrigine` et `details`.** C'est nécessaire pour vérifier les tests e2e depuis l'API ; ce n'est pas une nouvelle interface.

## 0. CHALLENGE
- **Bugs du prototype à ne pas reproduire**
  - Validation « non vide » seulement, signalée par un toast « Formulaire incomplet » qui ne nomme qu'un seul champ. Pas de contrôle de format (courriel, téléphone).
  - Les champs structurés sont collés dans `message` sous forme `k: v · …`.
  - Le `sujet` vient du client et vaut `contactIntro`, un texte éditorial.
- **Suggestion** : le prototype demande `commentaire` ≥ 5 caractères alors que le serveur exige ≥ 10, ce qui garantit un 400 (DEC-13). On aligne sur 10. `produit` et `origine` n'ont aucune borne haute.
- **Transport** : `date` sans minimum, donc des dates passées sont acceptées. Correction : aujourd'hui ≤ date ≤ aujourd'hui + 365 jours, fuseau America/Toronto. Attention au `min` rendu côté serveur par l'ISR (voir §4).
- **Écarts visuels du prototype à ne pas reproduire**
  - coordonnées fictives en dur (« Montréal, Québec ») ;
  - accent passé en `style` inline ;
  - option « Sélectionner » sélectionnable ;
  - icône `Lightbulb` décorative ;
  - toast « Merci {nom}, … « {produit} » », qui renvoie la saisie de l'utilisateur ;
  - téléphone placement sans `type=tel` ;
  - « Bi-mensuelle » ambigu (deux fois par mois ou toutes les deux semaines ?).
- **Q-04 (comptable)** : les options de « Besoin » ne couvrent pas T1/T2, la création ni la régularisation (PROJECT_CONTEXT §2 et services du seed). Complétées.
- **Q-05 (entretien)** : l'option « Supermarché » manque alors que le seed la met déjà en avant. Ajoutée.
- **`ContactIntro` : le surtitre n'est pas interpolé** (`{{ section.surtitre }}`). Un `{nomCourt}` saisi dans l'admin s'afficherait tel quel. À corriger (touche aussi la holding, sans risque).
- **Ce qui manque, bloquant pour la production** (déjà listé dans PROJECT_STATE) : `/admin/messages` ne lit ni `details` ni les suggestions (DEC-38), et `Company.email` vaut null. Les demandes des filiales ne sont vues par personne hors de la base.

## 1. Champs par filiale → stockage

La colonne est dans `MessageContact`. `d.` signifie une clé de `details`. Tous les champs sont requis. `nom`, `email` et `message` utilisent les briques existantes.

| Filiale | nom | entreprise (col.) | telephone (col.) | details (clé : type) | message |
|---|---|---|---|---|---|
| entretien | « Nom complet » | — | requis | `typePropriete` : select, `frequence` : select | « Détails », 4 lignes |
| transport | « Nom » | — | requis | `typeTransport` : select, `dateSouhaitee` : date future, `origine` : texte, `destination` : texte | « Détails », 4 lignes |
| comptable | « Nom complet » | « Nom d'entreprise » | requis | `structure` : select, `besoin` : select | « Contexte », 4 lignes |
| placement | « Nom » | « Entreprise » | requis | `poste` : select, `nombrePostes` : entier de 1 à 500 | « Contexte », 4 lignes |
| ccdpaa | « Nom » | « Entreprise » | requis | `categorie` : select, `volume` : texte | « Détails », 3 lignes |
| boissons | « Nom » | « Établissement » | requis | `typeEtablissement` : select, `ville` : texte, `marques` : select | « Détails », 3 lignes |
| suggestion (ccdpaa, boissons) | « Nom » | — | — | `details = { formulaire }` seulement ; `produitSouhaite` (col., 2 à 120) ; `paysOrigine` (col., 2 à 80) | « Pourquoi ce produit ? », 3 lignes |

**Validation**
- `telephone` : 7 à 30 caractères parmi `[0-9+().\s-]`, avec au moins 7 chiffres.
- `texte` : de 2 à 120 caractères, sans caractère de contrôle.
- `entreprise` : de 2 à 160 caractères.
- `select` : `z.enum` des clés, message « Sélectionnez une option. ».
- `entier` : `z.coerce.number().int()` avec des bornes.
- `date` : format `YYYY-MM-DD` vérifié par aller-retour, entre aujourd'hui et aujourd'hui + 365 jours (Toronto).
- `details` est `.strict()`, comme l'objet entier.

**Représentation : une seule source.** `shared/config/contact-forms.ts` (T0) contient l'ordre des champs, les libellés, les placeholders, la largeur, les options, le `sujet`, le libellé du bouton et le titre du toast. Les variantes zod, le rendu, le mapping serveur et le futur affichage admin en dérivent. Aucun `if (slug === …)` dans un composant.

## 2. Union, handlers, endpoint

- **Union** : `holding` | 6 variantes dont le discriminant `formulaire` vaut le slug de la filiale | `suggestion`, avec `site: z.enum(['ccdpaa','boissons'])`.
- **Handler filiale** (T1, `server/lib/contact.ts`). Une seule fabrique, `handlerFiliale(slug)`, typée sur `Extract<ContactBody, { formulaire: FormulaireFilialeSlug }>` :
  - `cible` : `() => slug` ;
  - données produites :
    - `type: 'CONTACT'` et `sujet: CONTACT_FORMS[slug].sujet` (DEC-15) ;
    - `telephone` et `entreprise` valent `?? null` ;
    - `details: { ...body.details, formulaire: slug }` (`formulaire` écrit en dernier) ;
  - `origine: 'site de la filiale'`, `typeLibelle: 'Contact'`.
- **Handler suggestion** :
  - `cible` : `body.site` ;
  - données : `type: 'SUGGESTION_PRODUIT'`, `sujet: SUGGESTION_FORM.sujet`, `produitSouhaite`, `paysOrigine`, `details: { formulaire: 'suggestion' }` ;
  - `typeLibelle: 'Suggestion de produit'`, `origine: 'formulaire de suggestion'`.
- **`MessageContactData`** : ajouter `produitSouhaite?` et `paysOrigine?` (`string | null`). Le `satisfies` existant casse le typecheck si une variante n'a pas de handler.
- **`contact.post.ts`** : **aucun changement de logique**, seul le commentaire d'en-tête change. Les gardes 415/411/413, le rate-limit (bucket `contact` partagé par les deux formulaires d'une page), le honeypot, la persistance et les courriels restent tels quels.

## 3. Catalogue et seed

- **Catalogue : rien à ajouter.** `CONTACT:seo` et `CONTACT:contact` existent pour tous les sites, et `CONTACT:suggestion` existe pour ccdpaa et boissons (type `formulaire`, titre « Vous ne trouvez pas ce que vous cherchez ? », Q-11).
- **Seed (T1), réalignements.**
  - (a) **Placement** : le texte actuel, « Employeurs et\ncandidats, à vous la parole », ne correspond plus à un formulaire réservé aux employeurs. Nouvelles valeurs proposées :

    | Champ | Valeur |
    |---|---|
    | `contactSurtitre` | « Vous recrutez » |
    | `contactTitre` | « Parlez-nous de\nvos besoins en personnel. » |
    | `contactTexte` | « Manutention, transport, recrutement international : décrivez le poste, notre équipe vous rappelle rapidement. » |

  - (b) **`suggestion.texte` par site**, repris du prototype :
    - ccdpaa : « Dites-nous ce que vous aimeriez retrouver sur nos étals. Chaque suggestion est étudiée par notre équipe d'approvisionnement. » ;
    - boissons : même phrase avec « dans notre portefeuille de marques ».
- **Amorçage** : ces valeurs ne s'appliquent qu'à une base neuve. Sur la base de dev, on les édite dans `/admin/contenu` (ou reset avec l'accord de l'utilisateur).

## 4. Frontend (T2)

| Fichier | Rôle |
|---|---|
| `app/pages/[filiale]/contact.vue` (nouveau) | Reprend le modèle de `a-propos.vue` et `contact.vue` (voir le détail sous le tableau). |
| `app/components/site/contact/FilialeContactForm.vue` (nouveau) | Props `{ slug: FormulaireFilialeSlug; vars: TexteVars; messageSucces: string \| null; mention: string \| null; emailSecours: string \| null }`. Le détail est sous le tableau. |
| `app/components/site/contact/ChampContact.vue` (nouveau) | Props `{ champ: ChampContact }`. Un `FormField :name` avec `v-slot="{ componentField }"` et un rendu par `type` : Input, `tel` avec `inputmode`, email, `<select>` natif (`FormControl` directement sur le `<select>`, invite `value="" disabled`), date (`:min` fixé **après `onMounted`** pour éviter un `min` périmé servi par l'ISR), `number`, Textarea. |
| `app/components/site/contact/SuggestionProduitForm.vue` (nouveau) | Props `{ site: SiteSuggestion; section: FormulaireData \| undefined; vars; mention; emailSecours }`. H2 et texte tirés de la section, carte `max-w-5xl`, placeholder produit tiré de `SUGGESTION_FORM.placeholdersProduit[site]`, **sans icône**. |
| `app/composables/usePublicFormFeedback.ts` (nouveau) | `notifierResultat(resultat, { titreSucces, messageSucces, vars, emailSecours }): boolean` : la logique de toasts de `HoldingContactForm` extraite (429 en minutes, 5xx avec courriel de secours). Évite 3 copies. |
| `HoldingContactForm.vue` (modifié) | Utilise `notifierResultat`. Aucun autre changement ; passe par le regression-checker. |
| `ContactIntro.vue` (modifié) | Le surtitre passe par `TexteAccentue as="p"`. |

Détail de la page `[filiale]/contact.vue` :
- `validate: isFilialeSlug` ;
- `useSite(slug)` et `useSiteSections(slug, 'CONTACT')` ;
- `useSeoMeta` interpolé, avec repli `Contact — {nomCourt}` ;
- grille `lg:grid-cols-12` : `ContactIntro` sans wrapper or (l'accent de la filiale s'applique) + `FilialeContactForm :key="slug"` ;
- puis, si `estSiteSuggestion(slug) && sections.suggestion`, une section `SuggestionProduitForm`.

Détail de `FilialeContactForm.vue` :
- `useForm` + `toTypedSchema(filialeContactFormSchema(slug))` ;
- `initialValues` construits depuis la config (`''` partout, `telephone`/`entreprise` seulement s'ils sont présents) ;
- rendu par `v-for` de `ChampContact` ;
- invalide → `nextTick` puis focus sur `form.querySelector('[aria-invalid="true"]')` (l'ordre du DOM suit la config, sans refs) ;
- envoi `{ formulaire: slug, ...values }` ;
- honeypot, `MentionConfidentialite`, bouton `bg-site-accent` désactivé avant hydratation, `method="post"` ;
- machine d'états identique à celle de la holding.

**Écarts assumés par rapport au prototype**
- 2 colonnes seulement à partir de `lg`.
- Coordonnées lues sur `Company`, masquées si null.
- Placement sans onglets (lot 1).
- Invite des listes non sélectionnable.
- Pas d'icône Lightbulb.
- Toasts sans reprendre la saisie (titre = `cfg.toastTitre` ; description = `messageSucces` interpolé).
- Mention Loi 25 sous les deux formulaires.
- Borne de date.

## 5. Tâches (périmètres disjoints)

### T0 : thread principal, avant T1 et T2 (M)
Fichiers :
- `shared/config/contact-forms.ts` (nouveau) ;
- `shared/validation/contact.ts` ;
- `shared/utils/dates.ts` : `FUSEAU_QUEBEC`, `dateDuJourQuebec`, `ajouterJoursIso` ;
- `tests/unit/contact-validation.test.ts` ;
- `tests/unit/contact-forms.test.ts` (nouveau).

```ts
// shared/config/contact-forms.ts — imports relatifs uniquement (tsx/seed)
import type { FilialeSlug } from './sites'
export interface OptionChamp { readonly value: string; readonly label: string }
type Options = readonly [OptionChamp, ...OptionChamp[]]
interface Base { readonly label: string; readonly placeholder?: string; readonly pleineLargeur?: boolean }
export type ChampContact =
  | (Base & { readonly type: 'nom' | 'email' | 'telephone' | 'entreprise' })
  | (Base & { readonly type: 'message'; readonly lignes: number })
  | (Base & { readonly type: 'texte' | 'date-future'; readonly cle: string })
  | (Base & { readonly type: 'select'; readonly cle: string; readonly options: Options })
  | (Base & { readonly type: 'entier'; readonly cle: string; readonly min: number; readonly max: number })
export type ChampDetail = Extract<ChampContact, { readonly cle: string }>
export interface ConfigFormulaireContact { readonly sujet: string; readonly bouton: string; readonly toastTitre: string; readonly champs: readonly ChampContact[] }
export const FORMULAIRES_FILIALES = ['entretien','transport','comptable','placement','ccdpaa','boissons'] as const satisfies readonly FilialeSlug[]
export type FormulaireFilialeSlug = (typeof FORMULAIRES_FILIALES)[number]
export const estChampDetail = (c: ChampContact): c is ChampDetail => 'cle' in c
const o = (value: string, label: string): OptionChamp => ({ value, label })
const COMMUN = { bouton: 'Envoyer la demande', toastTitre: 'Demande reçue' } as const
const nom = (label = 'Nom'): ChampContact => ({ type: 'nom', label, placeholder: 'Jean Tremblay' })
const email = (pleineLargeur = false): ChampContact => ({ type: 'email', label: 'Courriel', placeholder: 'vous@exemple.ca', pleineLargeur })
const tel: ChampContact = { type: 'telephone', label: 'Téléphone', placeholder: '514-000-0000' }
const msg = (label: string, placeholder: string, lignes: number): ChampContact => ({ type: 'message', label, placeholder, lignes, pleineLargeur: true })

export const CONTACT_FORMS = {
  entretien: { ...COMMUN, sujet: 'Demande de soumission — entretien', champs: [
    nom('Nom complet'), tel, email(true),
    { type: 'select', cle: 'typePropriete', label: 'Type de propriété', options: [o('bureau-commerce','Bureau / commerce'), o('residence','Résidence / condo'), o('supermarche','Supermarché / commerce alimentaire'), o('chantier','Chantier / rénovation'), o('autre','Autre')] },
    { type: 'select', cle: 'frequence', label: 'Fréquence souhaitée', options: [o('unique','Unique'), o('hebdomadaire','Hebdomadaire'), o('aux-deux-semaines','Aux deux semaines'), o('mensuelle','Mensuelle')] },
    msg('Détails', 'Superficie, contraintes d’accès, dates…', 4) ] },
  transport: { ...COMMUN, sujet: 'Demande de devis — transport', champs: [
    nom(), tel, email(true),
    { type: 'select', cle: 'typeTransport', label: 'Type de transport', options: [o('demenagement-residentiel','Déménagement résidentiel'), o('demenagement-commercial','Déménagement commercial'), o('marchandises','Transport de marchandises'), o('dernier-kilometre','Livraison du dernier kilomètre')] },
    { type: 'date-future', cle: 'dateSouhaitee', label: 'Date souhaitée' },
    { type: 'texte', cle: 'origine', label: 'Origine', placeholder: 'Ville / code postal' },
    { type: 'texte', cle: 'destination', label: 'Destination', placeholder: 'Ville / code postal' },
    msg('Détails', 'Volume, contraintes d’accès, étages…', 4) ] },
  comptable: { ...COMMUN, sujet: 'Demande de consultation', champs: [
    nom('Nom complet'), { type: 'entreprise', label: 'Nom d’entreprise' }, email(), tel,
    { type: 'select', cle: 'structure', label: 'Structure', options: [o('travailleur-autonome','Travailleur autonome'), o('societe-incorporee','Société incorporée'), o('obnl','OBNL'), o('autre','Autre')] },
    { type: 'select', cle: 'besoin', label: 'Besoin principal', options: [o('tenue-livres','Tenue de livres régulière'), o('paie','Paie'), o('tps-tvq','TPS / TVQ'), o('etats-financiers','États financiers'), o('impot','Déclarations d’impôt (T1 / T2)'), o('creation','Création d’entreprise'), o('regularisation','Régularisation ou dossier en retard')] },
    msg('Contexte', 'Chiffre d’affaires approximatif, nombre d’employés, logiciel utilisé…', 4) ] },
  placement: { ...COMMUN, sujet: 'Besoin de personnel', champs: [
    nom(), { type: 'entreprise', label: 'Entreprise' }, email(), tel,
    { type: 'select', cle: 'poste', label: 'Type de poste', options: [o('manutention','Manutention'), o('chauffeur-classe-1','Chauffeur classe 1'), o('chauffeur-classe-3-5','Chauffeur classe 3 / 5'), o('recrutement-international','Recrutement international (PTET)'), o('autre','Autre')] },
    { type: 'entier', cle: 'nombrePostes', label: 'Nombre de postes', placeholder: 'Ex. 5', min: 1, max: 500 },
    msg('Contexte', 'Lieu, horaires, urgence…', 4) ] },
  ccdpaa: { ...COMMUN, sujet: 'Demande de catalogue (distribution B2B)', champs: [
    nom(), { type: 'entreprise', label: 'Entreprise' }, email(), tel,
    { type: 'select', cle: 'categorie', label: 'Catégorie', options: [o('fruits-legumes','Fruits et légumes'), o('epices-condiments','Épices et condiments'), o('produits-transformes','Produits transformés'), o('catalogue-complet','Tout le catalogue')] },
    { type: 'texte', cle: 'volume', label: 'Volume estimé', placeholder: 'Ex. 500 kg / mois' },
    msg('Détails', 'Produits recherchés, fréquence, région de livraison…', 3) ] },
  boissons: { ...COMMUN, sujet: 'Demande de point de vente', champs: [
    nom(), { type: 'entreprise', label: 'Établissement' },
    { type: 'select', cle: 'typeEtablissement', label: 'Type d’établissement', options: [o('saq-epicerie','SAQ agence / épicerie'), o('restaurant','Restaurant'), o('bar-lounge','Bar / lounge'), o('hotel','Hôtel'), o('grossiste','Grossiste')] },
    email(), tel, { type: 'texte', cle: 'ville', label: 'Ville' },
    { type: 'select', cle: 'marques', label: 'Marques d’intérêt', options: [o('toutes','Toutes nos marques'), o('alcoolisees','Boissons alcoolisées'), o('non-alcoolisees','Boissons non alcoolisées'), o('sodas','Sodas et rafraîchissements')] },
    msg('Détails', 'Volume estimé, type de clientèle…', 3) ] },
} as const satisfies Record<FormulaireFilialeSlug, ConfigFormulaireContact>

export const SITES_SUGGESTION = ['ccdpaa', 'boissons'] as const satisfies readonly FilialeSlug[]
export type SiteSuggestion = (typeof SITES_SUGGESTION)[number]
export const estSiteSuggestion = (s: string): s is SiteSuggestion => (SITES_SUGGESTION as readonly string[]).includes(s)
export const SUGGESTION_FORM = { sujet: 'Suggestion de produit', bouton: 'Proposer ce produit', toastTitre: 'Suggestion envoyée',
  placeholdersProduit: { ccdpaa: 'Ex. Fonio précuit', boissons: 'Ex. Bissap pétillant' } } as const satisfies { placeholdersProduit: Record<SiteSuggestion, string> } & Record<string, unknown>
```

```ts
// shared/validation/contact.ts — ajouts (holding inchangé)
// CONTACT_LIMITS += telephoneMin: 7, telephoneMax: 30, telephoneChiffresMin: 7, texteCourtMin: 2, texteCourtMax: 120, entrepriseMax: 160, paysMax: 80, dateMaxJours: 365
export const telephoneContactSchema = z.string({ required_error: CHAMP_REQUIS }).trim()
  .min(CONTACT_LIMITS.telephoneMin, TEL_INVALIDE).max(CONTACT_LIMITS.telephoneMax, TEL_INVALIDE)
  .regex(/^[0-9+().\s-]+$/, TEL_INVALIDE)
  .refine((s) => (s.match(/\d/g)?.length ?? 0) >= CONTACT_LIMITS.telephoneChiffresMin, TEL_INVALIDE)
export const texteCourtSchema = (max: number = CONTACT_LIMITS.texteCourtMax) => z.string({ required_error: CHAMP_REQUIS }).trim()
  .min(CONTACT_LIMITS.texteCourtMin, 'Ce champ est requis (2 caractères minimum).').max(max, `${max} caractères au maximum.`)
  .refine((s) => !CONTROLE_PATTERN.test(s), 'Caractères non autorisés.')
export const dateFutureSchema = z.string({ required_error: CHAMP_REQUIS }).superRefine((d, ctx) => {
  const valide = /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d) // attention : toISOString lève sur Invalid Date → garder derrière un try ou tester isNaN d'abord
  const today = dateDuJourQuebec()
  if (!valide) ctx.addIssue({ code: 'custom', message: 'Choisissez une date valide.' })
  else if (d < today) ctx.addIssue({ code: 'custom', message: 'La date doit être aujourd’hui ou plus tard.' })
  else if (d > ajouterJoursIso(today, CONTACT_LIMITS.dateMaxJours)) ctx.addIssue({ code: 'custom', message: 'Date trop éloignée.' })
})
function schemaDetail(c: ChampDetail): z.ZodTypeAny {
  switch (c.type) {
    case 'texte': return texteCourtSchema()
    case 'date-future': return dateFutureSchema
    case 'entier': return z.coerce.number({ invalid_type_error: 'Indiquez un nombre.' }).int('Nombre entier attendu.')
      .min(c.min, `Entre ${c.min} et ${c.max}.`).max(c.max, `Entre ${c.min} et ${c.max}.`)
    case 'select': return z.enum(c.options.map((x) => x.value) as [string, ...string[]], { errorMap: () => ({ message: 'Sélectionnez une option.' }) })
  }
}
export type DetailsContact = Readonly<Record<string, string | number>>
type DetailsSchema = z.ZodType<DetailsContact, z.ZodTypeDef, Record<string, unknown>>
function detailsSchema(cfg: ConfigFormulaireContact): DetailsSchema {
  const shape = Object.fromEntries(cfg.champs.filter(estChampDetail).map((c) => [c.cle, schemaDetail(c)]))
  // Seul cast du fichier : forme exacte = runtime (config) ; type statique = enveloppe commune, couverte par tests.
  return z.object(shape).strict() as unknown as DetailsSchema
}
const aChamp = (cfg: ConfigFormulaireContact, t: ChampContact['type']) => cfg.champs.some((c) => c.type === t)
function formSchemaFiliale(cfg: ConfigFormulaireContact) {
  return z.object({
    nom: nomContactSchema, email: emailContactSchema, message: messageContactSchema, website: honeypotSchema,
    telephone: aChamp(cfg, 'telephone') ? telephoneContactSchema : z.undefined(),
    entreprise: aChamp(cfg, 'entreprise') ? texteCourtSchema(CONTACT_LIMITS.entrepriseMax) : z.undefined(),
    details: detailsSchema(cfg),
  }).strict()
}
export const filialeContactFormSchema = (slug: FormulaireFilialeSlug) => formSchemaFiliale(CONTACT_FORMS[slug])
const varianteFiliale = <S extends FormulaireFilialeSlug>(slug: S) => filialeContactFormSchema(slug).extend({ formulaire: z.literal(slug) })
export const suggestionFormSchema = z.object({ nom: nomContactSchema, email: emailContactSchema,
  produitSouhaite: texteCourtSchema(), paysOrigine: texteCourtSchema(CONTACT_LIMITS.paysMax),
  message: messageContactSchema, website: honeypotSchema }).strict()
export const suggestionBodySchema = suggestionFormSchema.extend({ formulaire: z.literal('suggestion'), site: z.enum(SITES_SUGGESTION) })
export const contactBodySchema = z.discriminatedUnion('formulaire', [holdingContactBodySchema,
  varianteFiliale('entretien'), varianteFiliale('transport'), varianteFiliale('comptable'),
  varianteFiliale('placement'), varianteFiliale('ccdpaa'), varianteFiliale('boissons'), suggestionBodySchema])
export type FilialeContactFormValues = z.input<ReturnType<typeof filialeContactFormSchema>>
export type SuggestionFormValues = z.input<typeof suggestionFormSchema>
```

Tests unitaires T0 :
- **Config** : chaque config contient exactement un `nom`, un `email`, un `message` et un `telephone` ; les `cle` sont uniques et aucune ne vaut `formulaire` ; les valeurs d'options sont uniques et en kebab-case ; `contactBodySchema.optionsMap` couvre exactement `holding` + `FORMULAIRES_FILIALES` + `suggestion`.
- **Validation** :
  - chaque filiale : un corps valide généré depuis la config est accepté ;
  - sont rejetés : une clé `details` inconnue, `details.formulaire`, `telephone` absent ou `------`, une option inconnue, `entreprise` envoyée à entretien ;
  - date : hier refusé, aujourd'hui accepté, +366 jours refusé, `2026-02-30` refusé (`vi.setSystemTime` près de minuit UTC) ;
  - `nombrePostes` : `"0"` et `501` refusés, `"5"` devient 5 ;
  - suggestion : `site: 'entretien'` refusé, message de 9 caractères refusé.

### T1 à T4

| # | Agent (+ skill) | Taille | Fichiers (uniquement ceux-ci) | Fin |
|---|---|---|---|---|
| T1 | backend (nitro + security) | S | `server/lib/contact.ts` (`handlerFiliale`, suggestion, `MessageContactData`), `server/api/public/contact.post.ts` (commentaire), `server/api/admin/messages/index.get.ts` (+`entreprise`, `paysOrigine`, `details` dans le select), `prisma/seed-data/sections.ts` (placement contact, suggestion.texte), `tests/unit/contact-mapping.test.ts` | typecheck + unitaires ; curl : 201 filiale, 201 suggestion, 400 sur les cas de T0 |
| T2 | frontend (vue3 + ui-ux) | L | `app/pages/[filiale]/contact.vue`, `app/components/site/contact/{FilialeContactForm,ChampContact,SuggestionProduitForm,ContactIntro,HoldingContactForm}.vue`, `app/composables/usePublicFormFeedback.ts`, `tests/nuxt/use-public-form-feedback.nuxt.test.ts` | typecheck, test nuxt, rendu des 6 pages en build prod ; aucun dégradé, `v-html` ni texte public en dur |
| T3 | e2e-tester (playwright) | M | `tests/e2e/contact-filiales.spec.ts` | vert contre `.output` ; `contact.spec.ts` (holding) toujours vert |
| T4 | regression-checker, puis reviewer + ux-reviewer | S | aucun | captures 375/768/1440 × 6 ; vidéo : erreurs + toast (une filiale) et suggestion |

**T3, détail**
- `for (const slug of FORMULAIRES_FILIALES)` ; les valeurs valides sont générées depuis `CONTACT_FORMS` ; les attentes (H1, surtitre, `messageSucces`) viennent de l'API des sections CONTACT (même endpoint que `contact.spec.ts`) ;
- envoi vide : autant d'erreurs que de champs, focus sur le 1er, 0 requête ;
- envoi valide : toast, puis `GET /api/admin/messages` ⇒ `company.slug`, `type`, `sujet`, `telephone`, `entreprise` et `details` identiques à la config ;
- ccdpaa et boissons : suggestion ⇒ `SUGGESTION_PRODUIT`, `produitSouhaite`, `paysOrigine` ;
- API directe : les 400 de T0 (`site`, `details`, date passée) ;
- isolation : un XFF `203.0.113.x` et un courriel unique par test (le quota d'accusés est de 3 par destinataire) ; nettoyage en `afterAll` via `cleanup-test-data.ts --contact-email`.

## 6. Critères d'acceptation
1. Les 6 routes `/{slug}/contact` répondent 200 en build prod : un seul H1 (`CONTACT:contact.titre`, `\n` respecté), surtitre interpolé, SEO interpolé ; `/inconnu/contact` → 404.
2. Les champs affichés, leur ordre, leurs libellés et leurs options correspondent à `CONTACT_FORMS[slug]` ; l'invite des listes n'est pas sélectionnable.
3. Envoi vide : erreurs sous chaque champ, `aria-invalid`, focus sur le 1er champ invalide, aucune requête.
4. Succès : toast `toastTitre` + `messageSucces` ; formulaire vidé ; message conforme au §2 (sujet serveur, colonnes, `details` en clés stables).
5. ccdpaa et boissons affichent la suggestion (section éditable) ; les 4 autres ne l'affichent pas ; message enregistré en `SUGGESTION_PRODUIT` avec produit et pays.
6. Rejets serveur (400) : `details` inconnu, `formulaire` dans `details`, suggestion pour une autre filiale, date passée, téléphone sans chiffres ; jamais de 500.
7. 429 et 5xx (mockés) : toast, valeurs conservées. La refonte de `HoldingContactForm` laisse `contact.spec.ts` vert.
8. À 375 px, pas de défilement horizontal et contrôles ≥ 44 px ; à 768 px, formulaire sur une colonne.
9. Mention Loi 25 et lien `/confidentialite` sous chacun des deux formulaires.

## Points ouverts (valeur retenue par défaut)

| # | Point | Défaut |
|---|---|---|
| 1 | Placement : onglets employeur/candidat | Pas d'onglets ; formulaire employeur seul ; la candidature spontanée va sur `/offres` (lot 3) |
| 2 | Demande employeur : `DemandeClient` ou `MessageContact` | `MessageContact` + future action admin « Convertir en demande » |
| 3 | Q-04 : options comptables | Liste du §5 (paie et TPS/TVQ conservées, PROJECT_CONTEXT §2) |
| 4 | Q-05 : supermarché dans le formulaire entretien | Ajouté |
| 5 | Libellés d'options modifiés plus tard | Les clés sont stables ; une clé supprimée s'affiche brute dans l'admin |
| 6 | Seed réaligné (placement, suggestion) | Base neuve seulement ; base de dev : édition dans `/admin/contenu` |
| 7 | Rate-limit partagé contact + suggestion (5 / 10 min / IP) | Conservé |

## Fichiers clés
- `/home/cabrel/projects/cd-holding/shared/validation/contact.ts`
- `/home/cabrel/projects/cd-holding/server/lib/contact.ts`
- `/home/cabrel/projects/cd-holding/server/api/admin/messages/index.get.ts`
- `/home/cabrel/projects/cd-holding/prisma/seed-data/sections.ts` (FILIALES.placement l. 212-214 ; `contactFiliale` l. 574-609)
- `/home/cabrel/projects/cd-holding/app/components/site/contact/{ContactIntro,HoldingContactForm}.vue`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/{subConfig.ts,SuggestionProduitForm.tsx}`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/routes/placement.contact.tsx`

**Note pour T0** : dans `dateFutureSchema`, `toISOString()` lève sur une date invalide. Il faut tester `Number.isNaN(date.getTime())` avant l'aller-retour ; le brouillon ci-dessus le signale en commentaire.
