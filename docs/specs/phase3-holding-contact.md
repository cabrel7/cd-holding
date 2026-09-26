# Spec phase 3 : conversion de la route Holding `/contact`

Rédigée par l'agent architect le 2026-09-26, en lecture seule.

**Sources lues**
- Règles et état : CLAUDE.md, PROJECT_STATE.md (dette `contact.post.ts`, décisions verrouillées), CONVERSION_INVENTORY.md (Partie 1 `/contact`, E7/E8, DEC-11 à 15, DEC-38, Q-01, Q-10, écarts 9/11/17 de la Partie 2, écarts 1 à 5 et 22 de la Partie 4), docs/specs/phase2-foundations.md (§1.4, §4.2, §4.7), docs/specs/phase3-holding-home.md (format), PROJECT_CONTEXT.md §5 à §10.
- Prototype : `routes/contact.tsx`, `components/holding/Contact.tsx`, `components/subsidiary/{GenericContactForm,pages/SubContactPage}.tsx`, `subConfig.ts` (champs des filiales), captures `conversion-captures/contact/{375x812,768x1024,1440x900}.png`.
- Code : `server/api/public/contact.post.ts`, `server/utils/{rate-limit,mailer}.ts`, `server/lib/mail/**`, `server/api/admin/messages/index.get.ts`, `server/services/public/sites.ts`, `server/error.ts`, `prisma/schema.prisma` (`MessageContact`, `Company`, `Client`), `shared/content/sections/{catalog,types}.ts`, `prisma/seed-data/sections.ts` (`contactFiliale`, `commun`), `shared/config/sites.ts`, `shared/types/public.ts`, `shared/utils/texte.ts`, `app/pages/{index,a-propos}.vue`, `app/pages/admin/login.vue` (motif VeeValidate), `app/components/site/{SectionHeading,SiteFooter}.vue`, `app/components/ui/form/*`, `app/composables/{useSites,useSiteSections}.ts`, `nuxt.config.ts` (routeRules), `scripts/{api-check.mjs,cleanup-test-data.ts}`.

---

## Changements par rapport au brief littéral (résumé)

1. **Pas de formulaire générique configurable maintenant.** Le formulaire holding reste un composant dédié. Ce qui est générique : l'API (union discriminée sur `formulaire`), le pipeline serveur, les schémas de champs de base, et les briques UI (intro, champ honeypot, mention Loi 25, composable d'envoi). Raison : le formulaire holding (sélecteur de cible dynamique, 4 champs) n'a rien de commun structurellement avec les 5 formulaires filiales. Les abstraire maintenant, ce serait deviner une API sans avoir ses vrais cas. La configuration des filiales se construira avec la première page `/{filiale}/contact`.
2. **Mention Loi 25 ajoutée** (Q-01, « sous chaque formulaire public ») : une seule entrée éditable au niveau du groupe, pas une par site.
3. **Site d'origine tracé sans migration** (E8) : `details = { formulaire: 'holding' }` et un sujet serveur qui porte « via le site du groupe ».
4. **Courriels branchés** (Q-10) : notification interne et accusé de réception. L'accusé est limité par destinataire, sinon le formulaire devient un relais de spam.
5. **Correctifs de sécurité et de robustesse** sur `contact.post.ts` (§0, bugs 1 à 6).
6. Écarts visuels et d'accessibilité assumés (§4.3) : un vrai H1, 2 colonnes seulement à partir de `lg`, surtitre lisible.

---

## 0. CHALLENGE

**Hypothèses implicites du brief**
- « Aligner `contact.post.ts` sur DEC-12/13/15 » laisse croire que toutes les variantes filiales doivent être livrées maintenant. Non : seule la variante `holding` a un consommateur. Livrer les 5 variantes filiales sans page bloquerait sur des options encore ouvertes : besoins du comptable (Q-04), option supermarchés d'entretien (Q-05), catégories ccdpaa/boissons. On livre le **squelette extensible** (union discriminée + registre typé qui casse à la compilation si une variante n'a pas de handler) et la variante `holding`.
- « Même formulaire, routage vers la filiale » : faux pour les filiales. Chacune a ses propres champs (`subConfig.ts:50-175`) et sa cible est implicite (le site lui-même). Seule la holding a un sélecteur de cible. Voir §4.4 pour ce qui est réellement réutilisable.
- Le brief suppose qu'un message envoyé sera lu. Or **`/admin/messages` n'est pas converti** et `Company.email` vaut `null` pour les 7 sociétés dans le seed. Aujourd'hui, un message envoyé n'est vu **par personne** hors base de données. Ça ne bloque pas le ✅ de la route, mais **ça bloque la mise en production** (§6, point 3).

**Bugs réels dans le code existant**

`server/api/public/contact.post.ts` :
1. **Contrat contraire à DEC-12/13/15** :
   - `sujet` est fourni par le client ;
   - `companySlug` est une chaîne libre ;
   - `type` est libre (`SUGGESTION_PRODUIT` accepté pour n'importe quelle société) ;
   - l'objet n'est pas `.strict()`.
2. **Honeypot → 400** (`website: z.string().max(0)`) : le bot apprend qu'il a été détecté. Cible : 201 simulé, sans écriture ni courriel.
3. **Un octet NUL dans `message` ou `nom` donne une 500.** Postgres refuse `\u0000` dans un `text`, Prisma lève une erreur, et la 5xx est loggée. Le zod doit rejeter les caractères de contrôle (sauf `\t\n\r`) → 400.
4. **`content-length` absent → 413 « trop volumineuse »** (message faux ; le bon code est 411). Aucun contrôle du `content-type` : `readBody` d'h3 accepte aussi du `x-www-form-urlencoded`, c'est-à-dire des POST de formulaires HTML depuis n'importe quel site. Cible : 415 si ce n'est pas du JSON.
5. `email` sans borne de longueur (RFC : 254).
6. Aucun courriel envoyé, alors que la valeur semée `messageSucces` promet « Un courriel de confirmation vous est envoyé » : **promesse fausse aujourd'hui.**

Ailleurs :
7. `server/lib/mail/templates/accuse-reception.ts` recopie `nomDestinataire` (saisi par l'utilisateur) dans un courriel envoyé à une **adresse saisie par l'utilisateur**. Sans garde, c'est un relais de spam (« nom » = « Gagnez 1000 $ sur exemple.com », courriel = victime). Parades :
   - regex de nom (lettres, espaces, `'’.-`, donc ni URL, ni `@`, ni chiffres) ;
   - limite d'accusés par destinataire.
8. `prisma/seed-data/sections.ts:566-584` (`contactFiliale`, branche holding) :
   - SEO « Contact — Groupe CD » écrit en dur au lieu de `{groupe}` ;
   - surtitre « Nous joindre » et texte qui **ne sont pas ceux du prototype** (`Contact.tsx:60,66-67`).
9. `scripts/api-check.mjs:235-253` (A.5) poste l'ancien contrat (`companySlug: 'entretien'`, sans cible). **Il échouera** après la modification et doit suivre.
10. `SiteFooter.vue:130` pointe déjà vers `/confidentialite`, **route absente de la checklist et non convertie** : 404 aujourd'hui (Q-01 demandait l'ajout à la checklist Holding).
11. Défauts du prototype, visibles sur les captures :
    - **aucun `<h1>`** (le titre est un `h2`) ;
    - surtitre en or sur crème (≈ 2,2:1) ;
    - à 768 px, grille à 2 colonnes trop serrée : placeholder « vous@exemple » tronqué, nom et courriel à environ 140 px chacun ;
    - validation qui passe par un toast « Formulaire incomplet » pour les formulaires filiales (écart 17).
12. Soumission native **avant hydratation** : un `<form>` sans `method` fait un GET `/contact?nom=…&email=…`. Les données personnelles finissent dans l'URL, l'historique et les logs d'accès nginx (règle « jamais de query string dans un log »).

**Meilleure approche retenue**
- **Un seul endpoint** `POST /api/public/contact` avec `z.discriminatedUnion('formulaire', [...])`. `formulaire` identifie à la fois la variante zod et le handler serveur (société cible, type, sujet, `details`). Variante livrée : `holding`.
- **Registre serveur** `FORMULAIRES satisfies Record<ContactFormulaire, FormulaireHandler>` : ajouter une variante sans son handler provoque une erreur de typecheck.
- **Routage** : `companyId` = société choisie. `ADMIN_FILIALE` voit donc directement les messages qui lui sont adressés via le site du groupe (`companyScope` existant) ; `SUPER_ADMIN` voit tout. C'est la vraie valeur du sélecteur ; un routage manuel par la holding serait plus simple mais retirerait ce bénéfice.
- **Origine** : `details.formulaire = 'holding'` (lisible par machine, futur filtre de `/admin/messages`) et un sujet serveur lisible. **Aucune migration.**
- **Mention Loi 25 unique pour le groupe** (`COMMUN:mentionFormulaires`, portée holding), exposée dans `PublicSite.groupe` pour que toutes les pages, filiales comprises, la reçoivent sans duplication : une seule politique de confidentialité, une seule mention à faire valider par un juriste.
- **Formulaire** : composants `ui/form` de shadcn-vue (déjà présents, jamais utilisés) sur VeeValidate. Le câblage `id`, `aria-describedby` et `aria-invalid` vient gratuitement.

**À retirer / simplifier**
- Pas de captcha tiers (script externe, CSP, Loi 25). Honeypot + rate-limit + regex de nom ; à réévaluer si du spam est observé.
- Pas de jeton de délai minimal, pas de pré-sélection `?cible=` (variantes de clé ISR, besoin non exprimé), pas de champ téléphone (absent du prototype validé).
- Pas de mapping champ par champ des 400 serveur : le schéma est partagé, un 400 serveur signifie une falsification ou une divergence de version. Un toast générique suffit.

**Périmètre réel plus large que demandé**
- Serveur :
  - `server/utils/rate-limit.ts` : `consumeRateLimit`, non levant, par clé ;
  - gabarit `notification-interne` : ajout d'une `origine` ;
  - `server/services/public/sites.ts` : `groupe.mentionFormulaires`.
- Catalogue et seed : `shared/content/sections/catalog.ts` (COMMUN), `prisma/seed-data/sections.ts`.
- Partagé : `shared/types/public.ts`.
- Outillage : `scripts/api-check.mjs`.
- Checklist `PROJECT_STATE.md` : ajouter `/confidentialite` (Holding).
- Pour le regression-checker : `PublicSite` est consommé par le layout, `SiteHeader`, `SiteFooter` et les pages à-propos et accueil (champ ajouté, non cassant).

---

## 1. Inventaire des sections (prototype) et source de données

| # | Section prototype | Contenu | Source | État |
|---|---|---|---|---|
| — | Header, footer (layout) | — | `SiteHeader`, `SiteFooter` en place | inchangés |
| 1 | Colonne texte (`Contact.tsx:52-74`) | surtitre « Contact », titre « Parlons de votre projet. », texte, coordonnées (e-mail, tél., adresse) | `CONTACT:contact` (type `formulaire` : `surtitre`, `titre`, `texte`) + `Company(holding).{email,telephone,adresse}` via `useSite` | clé existante, **valeurs à réaligner** ; coordonnées déjà éditables (onglet Site) |
| 2 | Carte formulaire (`Contact.tsx:76-131`) | Nom complet, Courriel, Filiale concernée (général + 6), Votre message, bouton « Envoyer le message » | libellés = interface (code) ; options = `GET /api/public/sites` (`useSites`, déjà chargé par le layout) + « Le {groupe} (général) » | à construire |
| 3 | Toast de succès | « Message envoyé » + description | titre = libellé d'interface ; description = `CONTACT:contact.messageSucces` | clé existante |
| 4 | *(nouveau)* Mention Loi 25 sous le bouton | texte + lien « Politique de confidentialité » | `COMMUN:mentionFormulaires` (holding) → `PublicSite.groupe.mentionFormulaires` ; libellé du lien = interface | **nouvelle clé** |
| — | SEO | title, description, og | `CONTACT:seo` | existante, `{groupe}` à mettre |

### Cartographie « tout contenu public éditable »

| Donnée affichée | Stockage | Éditable aujourd'hui | Après cette spec |
|---|---|---|---|
| Surtitre, H1, texte, message de succès, SEO | `SectionContenu` CONTACT (holding) | oui (Sections) | oui |
| Coordonnées holding | `Company.email/telephone/adresse` | oui (onglet Site) | oui ; **masquées si null**, aucun repli en dur (ne pas recopier la dette de `SiteFooter.vue:58`) |
| Noms des filiales (options) | `Company.nom` | oui (SUPER_ADMIN, onglet Site) | oui |
| Nom du groupe (option « général », textes) | `Company(holding).nom` | oui | oui |
| Mention Loi 25 | — | **absente** | `COMMUN:mentionFormulaires` (holding) |
| Libellés des champs, placeholders, bouton, titres de toasts, messages d'erreur | code | — | libellés d'interface, exception CLAUDE.md (structure de formulaire couplée au zod) |
| Contenu des courriels | code (`server/lib/mail/templates`) | non | inchangé, point ouvert 7 de la phase 2 |

**Cartographie transversale (formulaires publics).** Le pipeline de cette route sert à tous les formulaires qui écrivent dans `MessageContact`.

| Formulaire | Endpoint | Variante `formulaire` | Livré ici |
|---|---|---|---|
| Contact holding | `POST /api/public/contact` | `holding` | oui |
| Contact entretien, transport, comptable, ccdpaa, boissons | idem | `entretien`, `transport`, … (cible = le site) | non, avec chaque page |
| Suggestion de produit (ccdpaa, boissons) | idem | `suggestion` (+ `site`) | non |
| Assistant import-export | idem | `assistant-import-export` | non |
| Placement employeur / candidat, réservation | endpoints dédiés (inventaire Partie 3/4) | hors union | non ; réutilisent honeypot, mention Loi 25 et `usePublicFormSubmit` |

---

## 2. Catalogue et seed

### 2.1 `shared/content/sections/catalog.ts` (T1)

```ts
// COMMUN — après mentionAlcool
{ page: PAGE_SITE.COMMUN, cle: 'mentionFormulaires', type: 'texte', portee: 'holding' },
```

Mention unique pour le groupe : la politique `/confidentialite` est celle de la holding.

### 2.2 `prisma/seed-data/sections.ts` (T1)

Dans `commun(slug)`, holding seulement :

```ts
mentionFormulaires: {
  // Brouillon Loi 25 — À FAIRE VALIDER PAR UN JURISTE (même statut que CONFIDENTIALITE.politique)
  texte: 'Le {groupe} utilise les renseignements transmis par ce formulaire uniquement pour traiter votre demande et vous recontacter. Ils ne sont jamais vendus ni cédés.',
},
```

Dans `contactFiliale(slug)`, branche holding, réalignée sur le prototype :

```ts
seo: {
  title: 'Contact — {groupe}',                                                            // contact.tsx:9
  description: 'Écrivez au {groupe} à Montréal : nous vous redirigeons vers la bonne filiale.', // contact.tsx:10
},
contact: {
  surtitre: 'Contact',                                                                    // Contact.tsx:60
  titre: 'Parlons de votre projet.',                                                      // Contact.tsx:63
  texte: 'Une question sur l’une de nos filiales, un partenariat, un mandat ? Écrivez-nous. Nous vous mettrons directement en lien avec la bonne équipe.', // Contact.tsx:66-67
  messageSucces: 'Merci, votre message a bien été reçu. Notre équipe vous répondra rapidement. Un courriel de confirmation vous est envoyé.', // Contact.tsx:43 + Q-10
},
```

**Amorçage** :
- la nouvelle clé `mentionFormulaires` est créée par un simple `pnpm db:seed` (clé absente), **sans reset** ;
- les valeurs réalignées de `CONTACT:seo` et `CONTACT:contact` ne s'appliquent **pas** à une base déjà semée. Même choix qu'en phase 3 accueil : `migrate reset` + seed démo avec l'accord de l'utilisateur, ou édition manuelle des 2 sections dans `/admin/contenu`.

### 2.3 Types publics (T0, partagé)

`shared/types/public.ts` :

```ts
export interface PublicSite {
  // …
  readonly groupe: { readonly nom: string; readonly mentionFormulaires: string | null }
}
```

---

## 3. API

### 3.1 `shared/validation/contact.ts` (T0, source unique client et serveur, zod v3)

Import relatif de `../config/sites` et `zod` explicite (le fichier pourra être importé par le seed ou par tsx).

```ts
export const CONTACT_LIMITS = {
  nomMin: 2, nomMax: 120, emailMax: 254, messageMin: 10, messageMax: 5000, honeypotMax: 200,
} as const

// Lettres de toutes langues, espaces, apostrophes ' ’, point, trait d'union.
// Pas de chiffres ni de « @ / : » → aucune URL dans un nom repris par l'accusé de réception.
const NOM_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’. -]*$/u
// Caractères de contrôle refusés (NUL = 500 Postgres), sauf \t \n \r.
const CONTROLE_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

export const nomContactSchema = z.string().trim()
  .min(CONTACT_LIMITS.nomMin, 'Veuillez saisir votre nom.')
  .max(CONTACT_LIMITS.nomMax, '120 caractères au maximum.')
  .regex(NOM_PATTERN, 'Utilisez uniquement des lettres, espaces, apostrophes ou traits d’union.')

export const emailContactSchema = z.string().trim().toLowerCase()
  .max(CONTACT_LIMITS.emailMax, 'Adresse courriel trop longue.')
  .email('Adresse courriel invalide.')

export const messageContactSchema = z.string().trim()
  .min(CONTACT_LIMITS.messageMin, 'Votre message doit contenir au moins 10 caractères.')
  .max(CONTACT_LIMITS.messageMax, 'Votre message ne peut dépasser 5 000 caractères.')
  .refine((s) => !CONTROLE_PATTERN.test(s), 'Votre message contient des caractères non autorisés.')

// Jamais rejeté quand il est rempli : le serveur simule un succès (§3.2, étape 5).
export const honeypotSchema = z.string().max(CONTACT_LIMITS.honeypotMax).optional()

const cibleSchema = z.enum(SITE_SLUGS, { errorMap: () => ({ message: 'Sélectionnez une filiale.' }) })

/** Valeurs du formulaire holding (VeeValidate, toTypedSchema). */
export const holdingContactFormSchema = z.object({
  nom: nomContactSchema, email: emailContactSchema, cible: cibleSchema,
  message: messageContactSchema, website: honeypotSchema,
}).strict()

export const holdingContactBodySchema = holdingContactFormSchema.extend({ formulaire: z.literal('holding') })

/** Corps de POST /api/public/contact — une variante par formulaire (DEC-12). */
export const contactBodySchema = z.discriminatedUnion('formulaire', [holdingContactBodySchema])

export type HoldingContactFormValues = z.input<typeof holdingContactFormSchema>
export type ContactBody = z.infer<typeof contactBodySchema>
export type ContactFormulaire = ContactBody['formulaire']
```

Les briques `nom`, `email`, `message` et `honeypot` (et plus tard `telephoneContactSchema`, 7–30 caractères, `[0-9+().\s-]`) sont **exportées pour les variantes filiales**. Les minimums sont alignés en un seul endroit (DEC-13).

### 3.2 `POST /api/public/contact` : contrat

Route **publique, sans session.** Fichier : `server/api/public/contact.post.ts` (mince). Logique pure dans `server/lib/contact.ts`.

**Requête** : `Content-Type: application/json`, corps ≤ 32 Ko.

```json
{ "formulaire": "holding", "cible": "entretien", "nom": "Jean Tremblay",
  "email": "jean@exemple.ca", "message": "…", "website": "" }
```

**Pipeline, dans l'ordre**
1. `assertRateLimit(event, CONTACT_RATE_LIMIT)`, scope `contact`, 5 requêtes / 10 min / IP (inchangé, bucket partagé par toutes les futures variantes). Le rate-limit passe en premier pour que les requêtes malformées comptent aussi.
2. `content-type` ne contient pas `application/json` → **415** « Format de requête non pris en charge ».
3. `content-length` absent ou non numérique → **411** « Longueur de requête requise » ; > `MAX_CONTACT_BODY_BYTES` (32 Ko) → **413** « Requête trop volumineuse ».
4. `readValidatedBody(event, contactBodySchema.parse)` → **400** en cas d'échec (clé inconnue, dont l'ancien `sujet`, `type` ou `companySlug`).
5. `website` non vide → `consola.info('[contact] honeypot', { formulaire })`, **201 `{ ok: true }`**, aucune écriture, aucun courriel.
6. `handler = FORMULAIRES[body.formulaire]` ; `cibleSlug = handler.cible(body)` (holding : `body.cible`).
7. Une seule requête : `prisma.company.findMany({ where: { slug: { in: [cibleSlug, HOLDING_SLUG] } }, select: { id: true, slug: true, nom: true, email: true } })`. Cible absente → **404** « Site introuvable ».
8. `prisma.messageContact.create({ data: handler.construire(body, cible, holding), select: { uuid: true } })` ; l'uuid n'est pas renvoyé. Données produites pour `holding` :
   - `companyId` = cible.id, `type: 'CONTACT'`, `nom`, `email`, `message` ;
   - `sujet` : si la cible est la holding, `'Demande générale (site du groupe)'` ; sinon `` `Demande — ${cible.nom} (via le site du groupe)` `` ;
   - `details: { formulaire: 'holding' }` ;
   - `telephone`, `entreprise`, `paysOrigine`, `produitSouhaite` à null ; `statut` = défaut `NOUVEAU`.
9. Courriels, via `queueMail` (non bloquant, ne lève jamais) :
   - **notification interne** : `to` = `destinataireInterne(cible, holding)` = `cible.email ?? holding.email ?? null` (null → pas d'envoi) ; `replyTo` = e-mail du demandeur ; gabarit `notification-interne` avec `{ nomEntreprise: cible.nom, typeMessage: 'Contact', nomExpediteur: nom, origine: 'site du groupe' }` ;
   - **accusé de réception** : `to` = e-mail du demandeur, envoyé **seulement si** `consumeRateLimit(cleAccuseReception(email), ACCUSE_RECEPTION_LIMIT)` renvoie `true` (3 envois / 24 h / destinataire ; clé = `'accuse:' + sha256(email)`, jamais l'adresse en clair) ; gabarit `accuse-reception` avec `{ nomDestinataire: nom, nomEntreprise: cible.nom }`.
10. **201 `{ ok: true }`**.

**Réponses**

| Code | Corps / `statusMessage` | Quand |
|---|---|---|
| 201 | `{ ok: true }` | succès, **ou honeypot rempli** |
| 400 | « Validation Error » (h3) | zod : champ invalide, clé inconnue, `formulaire` ou `cible` inconnus, caractère de contrôle |
| 404 | « Site introuvable » | slug valide sans ligne `Company` (seed incomplet) |
| 411 / 413 / 415 | génériques ci-dessus | garde de transport |
| 429 | « Trop de tentatives, réessayez plus tard » + `Retry-After` (s) | rate-limit |
| 500 | générique (masqué par `server/error.ts`) | Prisma ou autre ; log central sans PII |

**Logs (aucune PII)**
- Seul log ajouté : `[contact] honeypot { formulaire }`.
- Pas de log de succès, aucun corps, e-mail, nom ni IP.
- Échecs d'envoi : déjà journalisés par `sendMailSafely` (`{ template, code }`).

### 3.3 Fichiers serveur

**`server/lib/contact.ts`** (pur, sans h3 ni Prisma runtime, testable) :

```ts
export interface CibleContact { readonly id: number; readonly slug: SiteSlug; readonly nom: string; readonly email: string | null }
export interface MessageContactData { companyId: number; type: 'CONTACT' | 'SUGGESTION_PRODUIT' | 'ASSISTANT_IMPORT_EXPORT'; nom: string; email: string; sujet: string; message: string; details: { readonly formulaire: ContactFormulaire } & Record<string, unknown>; telephone?: string | null; entreprise?: string | null }
export interface FormulaireHandler<B extends ContactBody> {
  readonly cible: (body: B) => SiteSlug
  readonly construire: (body: B, cible: CibleContact, holding: CibleContact) => MessageContactData
  readonly origine: string          // repris dans la notification interne
  readonly typeLibelle: string      // « Contact », « Suggestion de produit »…
}
export const FORMULAIRES = { holding: { … } } satisfies { [K in ContactFormulaire]: FormulaireHandler<Extract<ContactBody, { formulaire: K }>> }
export function destinataireInterne(cible: CibleContact, holding: CibleContact): string | null
export function cleAccuseReception(email: string): string   // 'accuse:' + sha256 hex (node:crypto)
export const SUJET_DEMANDE_GENERALE = 'Demande générale (site du groupe)'
```

Autres fichiers :
- **`server/utils/rate-limit.ts`** : ajout de `consumeRateLimit(key: string, { max, windowMs }): boolean`. Même `Map`, même purge, **ne lève pas**, ne lit pas l'IP. Extraire la logique de bucket en fonction pure `hitBucket(buckets, key, opts, now): { allowed, retryAfterMs }`, réutilisée par `assertRateLimit` et testée.
- **`server/lib/mail/templates/notification-interne.ts`** : `origine?: string` optionnel, échappé en HTML (rétrocompatible).
- **`server/services/public/sites.ts`** : `resolveGroupeNom` devient `resolveGroupe(slug, company)` → `{ nom, mentionFormulaires }`. La ligne `COMMUN:mentionFormulaires` de la holding est lue via `validateSection` (ligne invalide → `null` + warn existant). Une seule requête supplémentaire, groupée avec la lecture du nom de la holding.
- `server/api/admin/messages/index.get.ts` : **non modifié** (`details` sera exposé avec `/admin/messages`, DEC-38).

**Invalidation ISR** : aucune nouvelle mutation de contenu. L'édition de `mentionFormulaires` passe par le PATCH de sections existant, qui purge déjà toutes les pages.

---

## 4. Découpage frontend

### 4.1 Fichiers

| Fichier | Action | Responsabilité / props |
|---|---|---|
| `app/pages/contact.vue` | créer | Orchestration : `useSite(HOLDING_SLUG)`, `useSites()` (clé `sites` partagée avec le layout), `useSiteSections(HOLDING_SLUG,'CONTACT')` ; `vars = { groupe }` ; `useSeoMeta` interpolé (title, description, ogTitle, ogDescription, `ogType:'website'`) ; bloc d'erreur « Impossible de charger cette page » + Réessayer (motif `index.vue:44-47`) ; grille `lg:grid-cols-12` |
| `app/components/site/contact/ContactIntro.vue` | créer, **réutilisable filiales** | `{ section: FormulaireData \| undefined; coordonnees: { email: string \| null; telephone: string \| null; adresse: string \| null }; vars: TexteVars; titreRepli: string }` ; surtitre `p`, **`h1`**, texte, puis `<address class="not-italic">` avec liens `mailto:` / `tel:` (masqués si null) |
| `app/components/site/contact/HoldingContactForm.vue` | créer, **spécifique holding** | `{ filiales: readonly PublicSiteSummary[] \| null; groupe: string; vars: TexteVars; messageSucces: string \| null; mention: string \| null; emailSecours: string \| null }` ; VeeValidate + `toTypedSchema(holdingContactFormSchema)` |
| `app/components/site/form/HoneypotField.vue` | créer, réutilisable | `v-model: string` ; `id` via `useId()` |
| `app/components/site/form/MentionConfidentialite.vue` | créer, réutilisable | `{ texte: string \| null; vars: TexteVars }` ; `TexteAccentue` + `NuxtLink to="/confidentialite"` « Politique de confidentialité » (le lien reste affiché si le texte est null) |
| `app/composables/usePublicFormSubmit.ts` | créer, réutilisable | voir §4.2 ; **aucun toast** (testable, comme `useAdminResource`) |
| `app/composables/useSiteSections.ts` | modifier (types) | `+ FormulaireData { surtitre?; titre; texte?; messageSucces }` |

Composants shadcn-vue utilisés : `ui/form` (`FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`), `Input`, `Textarea`, `Button`. **Premier usage de `ui/form`** : vérifier que les ids de `FormItem` sont stables entre SSR et hydratation (pas d'avertissement de mismatch en build prod). Sélecteur de filiale : **`<select>` natif** stylé comme les inputs. Le `Select` reka est un bouton ARIA : picker natif perdu sur mobile, rendu SSR sans JS moins sûr.

### 4.2 `usePublicFormSubmit`

```ts
export type PublicSubmitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly raison: 'validation' | 'trop-de-requetes' | 'erreur'; readonly retryAfterSeconds: number | null }

export function usePublicFormSubmit<TBody extends Record<string, unknown>>(endpoint: `/api/public/${string}`): {
  envoyer(body: TBody): Promise<PublicSubmitResult>
  envoiEnCours: Readonly<Ref<boolean>>
}
```

- `$fetch` en POST (JSON).
- `FetchError` → 400/413/415 donnent `validation` ; 429 donne `trop-de-requetes` avec `Retry-After` lu dans `error.response.headers` ; tout le reste, réseau compris, donne `erreur`.
- Jamais de rejet non attrapé.

### 4.3 Rendu et états (tokens uniquement, aucun hex, aucun dégradé, aucun `v-html`, aucun emoji)

**Page**
- `section.pb-24.pt-32.md:pb-32.md:pt-40` (header fixe).
- Grille `grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16` : intro `lg:col-span-5`, carte `lg:col-span-7`.
- Wrapper de l'intro : `style="--site-accent: var(--gold); --site-accent-strong: var(--gold-deep)"` (motif `a-propos.vue:169`). **La carte n'est pas dans ce wrapper**, pour que le bouton garde l'accent du site.

**ContactIntro**
- Surtitre `text-site-accent-strong` uppercase tracking.
- H1 `font-display text-5xl lg:text-6xl font-bold leading-[1.05] text-navy`.
- Texte `text-ink/75`.
- Coordonnées `text-sm text-ink/70`, liens soulignés au survol, cible tactile ≥ 44 px (`py-2`).
- H1 de repli = `titreRepli` (la page passe le libellé nav « Contact ») si la section est invalide ou absente : la page a toujours un H1.
- Entrée en CSS `motion-safe:animate-in fade-in slide-in-from-bottom-3`. **Pas de `v-motion`** : H1 = LCP, et le contenu reste visible sans JS.

**HoldingContactForm**
- Carte `rounded-[1.5rem] bg-white p-6 sm:p-8 md:p-10 shadow-lg ring-1 ring-border`, même entrée CSS avec `delay-100`.
- `<form method="post" novalidate @submit="onSubmit" :aria-busy="envoiEnCours">`. `method="post"` : une soumission native ne met jamais de PII dans l'URL (bug 12).
- `<fieldset :disabled="envoiEnCours">` autour des champs.
- Nom et courriel en `sm:grid-cols-2`.
- Champs :
  - `nom` : `autocomplete="name"`, `maxlength=120` ;
  - `email` : `type="email"`, `autocomplete="email"`, `spellcheck="false"`, `maxlength=254` ;
  - `cible` : `<select>` avec `<option value="" disabled>Sélectionnez une filiale</option>`, `<option value="holding">Le {{ groupe }} (général)</option>`, puis les filiales dans l'ordre de l'API (valeur = `slug`, libellé = `nom`) ; icône `ChevronDown` `aria-hidden` ;
  - `message` : `Textarea rows=5 maxlength=5000 resize-none`.
- Libellés `FormLabel` : `font-display text-xs font-semibold uppercase tracking-widest text-navy`. Contrôles `h-12 rounded-xl bg-white px-4` (≥ 44 px). Erreur `FormMessage` sous le champ (`text-destructive`, ≈ 6:1 sur blanc).
- `HoneypotField` (`website`) dans la même carte.
- Bouton : `Button type="submit"`, `bg-site-accent text-white rounded-full px-7 min-h-12`, libellé « Envoyer le message », puis « Envoi en cours… » pendant l'envoi, icône `Send` `aria-hidden`. `:disabled="!hydrate || envoiEnCours"`, avec `hydrate` = `ref(false)` passé à `true` dans `onMounted`.
- `MentionConfidentialite` sous le bouton, `text-xs text-ink/70`.

**Machine d'états**

| État | Déclencheur | Rendu |
|---|---|---|
| Saisie | — | erreurs affichées au **blur** puis à chaque frappe une fois qu'une erreur existe (option `validateOnModelUpdate` pilotée par l'erreur courante), et à la soumission |
| Invalide à la soumission | `handleSubmit` refuse | erreurs sous chaque champ, `aria-invalid="true"`, **focus sur le premier champ invalide** (ordre nom → email → cible → message), aucune requête |
| Envoi | valide | `envoiEnCours` : fieldset désactivé, bouton « Envoi en cours… », `aria-busy` |
| Succès | `ok: true` | `toast.success('Message envoyé', { description: interpoler(messageSucces, vars) })` (repli description : « Votre message a bien été reçu. ») puis `resetForm()` |
| 400 / 413 / 415 | `validation` | `toast.error('Certaines informations sont invalides. Vérifiez le formulaire.')` ; valeurs conservées |
| 429 | `trop-de-requetes` | `toast.error('Trop d’envois depuis votre connexion.', { description: 'Réessayez dans N minute(s).' })` (N = `ceil(retryAfter/60)`, sinon « dans quelques minutes ») ; valeurs conservées |
| 5xx / réseau | `erreur` | `toast.error('L’envoi a échoué. Réessayez dans un instant.', { description: emailSecours ? 'Vous pouvez aussi nous écrire à ' + emailSecours : undefined })` ; valeurs conservées |

Corps envoyé : `{ formulaire: 'holding', ...values }`, où `values` sont les valeurs **parsées** par zod (trim, e-mail en minuscules).

### 4.4 Réutilisable par `/{filiale}/contact` (sans l'implémenter maintenant)

| Élément | Réutilisation |
|---|---|
| `POST /api/public/contact`, pipeline §3.2 (gardes, rate-limit, honeypot, persistance, courriels, destinataire) | **tel quel**. Ajouter une variante zod + une entrée `FORMULAIRES` ; la cible est le slug du formulaire, le sujet = `CONTACT:contact.surtitre` de la filiale ou une constante |
| `nomContactSchema`, `emailContactSchema`, `messageContactSchema`, `honeypotSchema`, `CONTACT_LIMITS` | tels quels ; ajouter `telephoneContactSchema` (requis au niveau zod, DEC-15) et `details` par filiale |
| `ContactIntro` | tel quel (`SubContactPage.tsx` : surtitre en accent, H1 `pre-line` géré par `\n`, coordonnées de la filiale) ; sans wrapper or, l'accent de la filiale s'applique |
| `HoneypotField`, `MentionConfidentialite`, `usePublicFormSubmit`, machine d'états, style des contrôles, bouton `bg-site-accent` | tels quels |
| `HoldingContactForm` | **non** (sélecteur de cible propre à la holding) |
| À construire alors | `shared/config/contact-forms.ts` (champs typés par filiale : label, type, options, placeholder, pleine largeur, lignes), variantes zod dérivées **du même objet**, `FilialeContactForm.vue` piloté par cette configuration, page `app/pages/[filiale]/contact.vue` (motif `[filiale]/a-propos.vue`), `SuggestionProduitForm` (variante `suggestion`, ccdpaa/boissons) |

### 4.5 Écarts assumés par rapport au prototype

| Écart | Raison |
|---|---|
| `h1` au lieu de `h2` | le prototype n'a aucun H1 (SEO, a11y) |
| 2 colonnes seulement à partir de `lg` (prototype : `md`) | à 768 px, champs d'environ 140 px et placeholder tronqué (capture) |
| Surtitre `gold-deep` au lieu de l'or | contraste AA |
| Coordonnées cliquables (`mailto:`/`tel:`) et masquées si null | le prototype affiche des valeurs fictives en texte brut |
| Mention Loi 25 + lien sous le bouton | Q-01 |
| Toast sans le prénom (« Merci {nom} ») | `{nom}` est déjà la variable du nom de société (`texte.ts`) ; description éditable |
| Option « général » : valeur `holding` (prototype : `groupe`) | slug réel, aucune correspondance à maintenir |
| Bouton désactivé avant hydratation | pas de soumission native |

---

## 5. Plan d'implémentation (périmètres DISJOINTS)

**T0, thread principal, avant T1/T2 (S)** : fichiers partagés.
- `shared/validation/contact.ts` (§3.1).
- `shared/types/public.ts` (`groupe.mentionFormulaires`).
- `tests/unit/contact-validation.test.ts`.
- `PROJECT_STATE.md` : ligne `/confidentialite` ajoutée à la checklist Holding.

| # | Agent (+skill) | Taille | Dépend de | Fichiers (touche UNIQUEMENT) | Critère de fin |
|---|---|---|---|---|---|
| **T1** | backend (`nitro` + `security`) | M | T0 | `server/api/public/contact.post.ts`, `server/lib/contact.ts` (nouveau), `server/utils/rate-limit.ts`, `server/lib/mail/templates/notification-interne.ts`, `server/services/public/sites.ts`, `shared/content/sections/catalog.ts`, `prisma/seed-data/sections.ts` (`commun` holding + branche holding de `contactFiliale` seulement), `scripts/api-check.mjs` (A.5 : nouveau contrat + un cas `sujet` → 400), `tests/unit/{contact-mapping,rate-limit,mailer}.test.ts` | `pnpm typecheck` ; `pnpm test:unit` (dont `sections-catalog` vert) ; `pnpm db:seed` crée `mentionFormulaires` sans toucher l'existant ; contrats §3.2 vérifiés à la main (201, honeypot 201 sans ligne, NUL → 400, 411/413/415, 429 + `Retry-After`) ; un envoi produit 2 logs `[mail] envoi simulé` (transport `log`) |
| **T2** | frontend (`vue3` + `ui-ux`) | L | T0 (T1 pour l'intégration) | `app/pages/contact.vue`, `app/components/site/contact/**`, `app/components/site/form/**`, `app/composables/usePublicFormSubmit.ts`, `app/composables/useSiteSections.ts`, `tests/nuxt/use-public-form-submit.nuxt.test.ts` | typecheck ; test nuxt vert ; page rendue en dev puis en build prod ; aucun dégradé, `v-html`, texte public en dur ou `console.log` |
| **T3** | tester (`testing` + `playwright`) | M | T1, T2 | `tests/e2e/contact.spec.ts` | vert contre `.output` (desktop + mobile) |
| **T4** | regression-checker, puis reviewer + ux-reviewer | S | T3 | aucun (corrections renvoyées aux propriétaires) | CRITICAL/MAJOR corrigés ; relancer `home`, `a-propos`, `layout-accent`, `maintenance` (champ `PublicSite.groupe` étendu) ; captures 375/768/1440 + vidéo (toast succès, erreurs sous les champs) comparées à `conversion-captures/contact/` |

T1 et T2 tournent en parallèle après T0.

**Commits** :
- `feat(contact): discriminated contact endpoint with mail and anti-spam` (T1) ;
- `feat(contact): holding contact page` (T2) ;
- `test(contact): e2e contact` (T3).

---

## 6. Critères d'acceptation, tests, points ouverts

### Critères d'acceptation
1. `GET /contact` → 200 en build prod ; **un seul `<h1>`** = `interpoler(CONTACT:contact.titre)` ; surtitre et texte issus de l'API ; `document.title` = SEO interpolé.
2. Sélecteur : options = placeholder + « Le {groupe} (général) » (`holding`) + filiales dans l'ordre de `GET /api/public/sites`.
3. Soumission vide : 4 erreurs sous les champs, `aria-invalid="true"`, focus sur Nom, **aucune requête** vers `/api/public/contact`.
4. Nom `http://spam.example` refusé côté client, et 400 côté serveur par requête directe.
5. Succès : toast « Message envoyé » + `messageSucces` ; formulaire vidé ; message visible via `GET /api/admin/messages` (SUPER_ADMIN) avec `company.slug` = cible et `sujet` = `Demande — {nom} (via le site du groupe)`.
6. Contrat API :
   - ancien corps `{companySlug,…}` → 400 ; clé `sujet` → 400 ; `cible:'inconnue'` → 400 ;
   - `\u0000` dans `message` → 400 (jamais 500) ;
   - `text/plain` → 415 ; corps > 32 Ko → 413 ;
   - honeypot rempli → 201 **sans** ligne créée ;
   - 6ᵉ envoi depuis la même IP → 429 + `Retry-After`.
7. 429 et 5xx (mockés) : toast d'erreur, **valeurs conservées**.
8. Mention Loi 25 affichée = `groupe.mentionFormulaires` ; lien `href="/confidentialite"`.
9. À 375 px : `scrollWidth ≤ 375`, contrôles et bouton ≥ 44 px de haut. À 768 px : une colonne, placeholder e-mail non tronqué.
10. Aucun `background-image` avec `gradient`, aucun hôte externe, aucun `v-html` (grep T2).
11. Édition immédiate : PATCH admin de `CONTACT:contact.titre` → `/contact` reflète la nouvelle valeur sans attendre le TTL. Restauration en `afterAll`.

### Tests
- **Unitaires**
  - `contact-validation` : trim, e-mail en minuscules, bornes, nom accepté (« Jean-François O’Neil », « Zoë ») ou refusé (URL, chiffres, `@`, NUL), message refusé avec NUL, `\n` accepté, `.strict()` (rejet de `sujet`/`type`), cible inconnue, honeypot quelconque accepté ≤ 200.
  - `contact-mapping` : sujet holding et filiale, `details.formulaire`, `website` jamais copié, `destinataireInterne` (cible, puis holding, puis null), `cleAccuseReception` sans l'e-mail en clair et déterministe.
  - `rate-limit` : `hitBucket` (fenêtre, dépassement, réinitialisation).
  - `mailer` : `origine` échappée.
  - `sections-catalog` : couverture automatique de la nouvelle clé.
- **Nuxt** : `use-public-form-submit` avec `registerEndpoint` (201, 400, 429 avec `Retry-After`, 500, erreur réseau).
- **E2E** `contact.spec.ts` : critères 1 à 11.
  - **Isolation du rate-limit** : chaque test fixe un `x-forwarded-for` distinct (plage TEST-NET `203.0.113.x`), honoré parce que le serveur de test est joint depuis le loopback (proxy de confiance, `rate-limit.ts:30`). Pour l'UI, via `page.setExtraHTTPHeaders`.
  - Assertions tirées de l'API, jamais du texte en dur.
  - Nettoyage en `afterAll` : `tsx scripts/cleanup-test-data.ts --contact-email <e-mails e2e>`.
- **Visuel** : captures aux 3 breakpoints + courte vidéo ffmpeg (erreurs sous les champs, envoi, toast).

### Points d'attention
- **Sécurité**
  - relais de spam neutralisé : regex de nom + 3 accusés / 24 h / destinataire + rate-limit IP ;
  - `replyTo` = e-mail validé par zod ;
  - `select` explicite, uuid non renvoyé ;
  - la cible vient d'un `z.enum`, jamais d'une chaîne libre ;
  - nginx doit écrire `X-Forwarded-For` (dette existante) : sinon le rate-limit en production vise l'IP du proxy.
- **Performance** : ISR 3600 s conservé (formulaire côté client) ; 1 requête Prisma de plus sur `GET /api/public/sites/[slug]` (mise en cache par l'ISR des pages) ; envoi de courriels hors du chemin de la réponse (`waitUntil`).
- **Régression** : `PublicSite.groupe` étendu (non cassant) ; `api-check.mjs` A.5 réécrit ; `mailer.test.ts` à adapter.

### Exclus volontairement (et pourquoi)
- Variantes filiales, suggestion et assistant : avec leurs pages (options clients Q-04/Q-05 ouvertes).
- `details` et filtre `type`/`formulaire` dans `/admin/messages` : conversion de `/admin/messages` (DEC-38).
- Captcha, jeton de délai minimal : complexité et tiers inutiles tant qu'aucun spam n'est observé.
- JSON-LD `ContactPage`/`LocalBusiness` : tâche SEO transverse (déjà exclue sur `/`).
- Conservation et purge des messages (Loi 25) : politique à fixer avec le client.

### Points ouverts (valeur retenue par défaut)

| # | Point | Défaut |
|---|---|---|
| 1 | Honeypot rempli : 201 simulé ou 400 | **201 simulé** + log `[contact] honeypot` (compteur de surveillance) ; risque résiduel d'autoremplissage limité par `autocomplete="off"` + `tabindex=-1` |
| 2 | `messageSucces` promet un courriel alors que `NUXT_MAIL_TRANSPORT=log` par défaut | Conservé (Q-10) ; **checklist de mise en production : SMTP configuré**, sinon retirer la phrase dans l'admin |
| 3 | Aucun destinataire ni écran de lecture aujourd'hui (`Company.email` null, `/admin/messages` ❌) | Accepté pour le ✅ de la route ; **bloquant pour la production** : saisir les e-mails (onglet Site) et convertir `/admin/messages` |
| 4 | Mention Loi 25 : une pour le groupe ou une par site | **Une pour le groupe** (politique unique) ; brouillon **à faire valider par un juriste** |
| 5 | Lien `/confidentialite` en 404 (déjà le cas dans le footer) | Accepté hors production ; route ajoutée à la checklist, à convertir ensuite (petite : rendu du type `legal`) |
| 6 | Valeurs réalignées sur une base déjà semée | `migrate reset` + seed démo **avec l'accord de l'utilisateur**, sinon édition manuelle des 2 sections ; `mentionFormulaires` créée par `db:seed` sans reset |
| 7 | Filiale en maintenance proposée dans le sélecteur | Oui (le statut concerne le site web, pas l'activité), cohérent avec l'accueil |
| 8 | Champ téléphone sur le formulaire holding | Non (prototype validé) ; ajout trivial si le client le demande (brique `telephoneContactSchema` prévue) |
| 9 | Limites : 5 / 10 min / IP ; 3 accusés / 24 h / destinataire | Retenues ; constantes nommées dans leurs fichiers serveur |

### Fichiers de référence
- À modifier ou créer (T1) :
  - `/home/cabrel/projects/cd-holding/server/api/public/contact.post.ts`
  - `/home/cabrel/projects/cd-holding/server/utils/rate-limit.ts`
  - `/home/cabrel/projects/cd-holding/server/lib/mail/templates/notification-interne.ts`
  - `/home/cabrel/projects/cd-holding/server/lib/mail/templates/accuse-reception.ts` (lecture seule, reflète `nom`)
  - `/home/cabrel/projects/cd-holding/server/services/public/sites.ts` (l. 104-135, 147-171)
  - `/home/cabrel/projects/cd-holding/shared/content/sections/catalog.ts` (l. 38-41)
  - `/home/cabrel/projects/cd-holding/prisma/seed-data/sections.ts` (`commun` l. 333, `contactFiliale` l. 566-596)
  - `/home/cabrel/projects/cd-holding/scripts/api-check.mjs` (l. 233-256)
- Partagés (T0) :
  - `/home/cabrel/projects/cd-holding/shared/validation/contact.ts` (nouveau)
  - `/home/cabrel/projects/cd-holding/shared/types/public.ts`
- Frontend (T2), modèles et composants :
  - `/home/cabrel/projects/cd-holding/app/pages/index.vue`
  - `/home/cabrel/projects/cd-holding/app/pages/a-propos.vue`
  - `/home/cabrel/projects/cd-holding/app/pages/admin/login.vue` (motif VeeValidate)
  - `/home/cabrel/projects/cd-holding/app/components/ui/form/`
  - `/home/cabrel/projects/cd-holding/app/composables/useSiteSections.ts`
  - `/home/cabrel/projects/cd-holding/app/components/site/SiteFooter.vue` (dette l. 58, ne pas recopier)
- Prototype :
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/routes/contact.tsx`
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/holding/Contact.tsx`
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/{GenericContactForm.tsx,pages/SubContactPage.tsx,subConfig.ts}`
- Captures : `/home/cabrel/projects/cd-holding/conversion-captures/contact/{375x812,768x1024,1440x900}.png`
