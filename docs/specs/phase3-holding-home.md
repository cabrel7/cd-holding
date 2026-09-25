# Spec phase 3 : conversion de la route Holding `/` (accueil)

Rédigée par l’agent architect le 2026-09-25 (lecture seule).

**Sources lues**
- Règles et état : CLAUDE.md, PROJECT_STATE.md, CONVERSION_INVENTORY.md (Partie 1 `/`, DEC-03/04/07/08/39, Q-02/03), docs/specs/phase2-foundations.md, PROJECT_CONTEXT.md §6 et §9.
- Prototype : `routes/index.tsx`, `components/holding/{Hero,Companies,Stats}.tsx`, captures `conversion-captures/home/{375x812,768x1024,1440x900}.png`.
- Code existant : `shared/content/sections/{catalog,types}.ts`, `prisma/seed-data/sections.ts`, `prisma/seed/{sections,contenu}.ts`, `server/services/{public,admin}/sites.ts`, `shared/validation/sites.ts`, `shared/types/public.ts`, `app/pages/a-propos.vue`, `app/layouts/default.vue`, `app/components/site/*`, `app/composables/*`, `app/assets/css/main.css`, `app/components/cms/CmsFieldInput.vue`, `tests/unit/sections-catalog.test.ts`.

---

## 0. CHALLENGE

**Hypothèses implicites du brief**
- « Vérifier ce qui existe dans le catalogue » laisse supposer que tout reste à créer. C'est faux : le catalogue et le seed couvrent déjà `ACCUEIL` holding (`seo`, `hero`, `filiales:section`, `chiffres`, `cta`). **Aucune nouvelle clé n'est nécessaire.**
- En revanche, 3 des 5 valeurs par défaut semées **ne sont pas celles du prototype** :
  - `filiales` : titre « Nos filiales » au lieu de « Six métiers, un même standard. » ;
  - `chiffres` : 3 items « En bref » au lieu des 4 chiffres « Pourquoi le Groupe CD » ;
  - `cta` : « Un projet, une filiale… » au lieu de « Parlons de votre projet. ».
  Le prototype a été validé par le client, donc on réaligne.
- « Les endpoints publics suffisent-ils ? » Pour la lecture, oui. Mais la page affiche des données `Company` (secteur, description, image de couverture des 6 filiales) **qu'aucun écran admin ne permet de modifier**, et que l'API de réglages n'accepte même pas (`secteur`, `description`). C'est une violation directe de la règle « tout contenu public éditable ».

**Angles morts trouvés dans le code existant (bugs réels)**
1. **Ancre `/#filiales` cassée.** `publicNav` renvoie `hash: '#filiales'` (verrouillé par `tests/unit/sites-config.test.ts:70`), et `SiteHeader.vue:87,132` ajoute encore un `#`. Le lien produit est donc `/##filiales`. Le lien « Nos filiales » du header ne fonctionne pas aujourd'hui.
2. **`hero.legende` n'est pas éditable.** Le champ existe dans `heroSchema` mais pas dans `heroFields`, donc il est absent du formulaire CMS. Ça touche aussi la légende du hero restaurant ccdpaa.
3. **Image du hero holding.** Le seed met `hero.imageKey: null`. La vraie image est dans `Company.heroImageKey` (`prisma/seed/contenu.ts:35`), qui n'est éditable par aucun écran.
4. **`--site-accent-strong` est calculé à la déclaration** (`[data-site]` dans `main.css:69`). Poser `--site-accent` par ligne de filiale ne recalcule pas `-strong`. Le petit texte d'accent (numéro, secteur) resterait donc en navy, ou en accent brut sous le seuil AA (corail, orange, terracotta sur crème).
5. **`SiteImage` force `loading="lazy"`.** L'image du hero (candidate LCP) serait chargée en différé.
6. **Défauts visuels du prototype** (visibles sur les captures) :
   - à 375 et 768 px, le blob navy recouvre le H1 (navy sur navy, illisible) ;
   - à 1440 px, le blob passe sous « Contact » et « Nous joindre » du header transparent ;
   - la carte « 06 Filiales actives » masque « Montréal » dans la légende ;
   - la vague du bas du hero est crème sur crème, donc invisible.
7. **Liens vers des pages qui n'existent pas encore.** `/{filiale}`, `/contact` et `/realisations` ne sont pas convertis : les 6 liens « Découvrir cette filiale » et le CTA final renvoient 404 jusqu'à leur conversion. Acceptable hors production, mais l'e2e ne doit vérifier que les `href`.
8. **Six liens « Découvrir cette filiale » identiques** : non distinguables par un lecteur d'écran (WCAG 2.4.4).

**Meilleure approche retenue**
- Aucune nouvelle clé de catalogue ni de nouvel endpoint public. On **réaligne les valeurs par défaut** de `accueilHolding()` sur le prototype.
- Le badge « 06 » devient **calculé** (nombre de filiales). Seul le libellé reste éditable : un « 06 » écrit en dur deviendrait faux au premier changement.
- Image du hero : `hero.imageKey ?? site.heroImageKey`. C'est une règle générale, réutilisable par les héros filiales. L'aide du champ CMS l'explique.
- **Un seul CTA par section.** On supprime le 2ᵉ bouton du hero « Nous contacter » (en plus il pointait vers `#contact`, qui n'existe pas). Le header porte déjà « Nous joindre » en permanence, et la section finale convertit.
- Corrections a11y/contraste/LCP listées plus haut, appliquées dans les composants (écarts documentés au §4).

**À retirer / simplifier**
- 2ᵉ CTA du hero, vague invisible du hero.
- Blob et cercle masqués sous `lg`, donc plus de chevauchement mobile/tablette.
- Pas de JSON-LD, d'`og:image` ni de canonical ici : c'est une tâche SEO transverse à faire une fois pour les 7 sites (§6).

**Périmètre réel plus large que demandé**
- API de réglages : ajouter `secteur` et `description` (T1).
- **Écran « Site » (fiche de la société) dans `/admin/contenu`** (T3). Sans lui, `/` ne peut pas honorer la règle d'éditabilité. Il débloque aussi les coordonnées du footer, dette déjà notée dans PROJECT_STATE. Recommandé avant de passer `/` à ✅ ; à trancher au §6.
- Fichiers communs touchés, à passer au **regression-checker** : `SiteHeader.vue`, `SiteImage.vue`, `main.css`, `shared/content/sections/types.ts` (le hero est partagé avec les filiales et le restaurant).

---

## 1. Inventaire des sections (ordre du prototype) et source de données

| # | Section prototype | Contenu | Source | État |
|---|---|---|---|---|
| — | Header (layout) | logo, nav, « Nous joindre » | `SiteHeader` (déjà en place) | **bug `##filiales` à corriger** |
| 1 | `Hero` | surtitre, H1 accentué, texte, CTA « Découvrir nos filiales » (`#filiales`), image, légende « Siège social / Montréal · Québec », carte « 06 Filiales actives » | `ACCUEIL:hero` (type `hero`) + `site.heroImageKey` en repli + nombre de filiales = `useSites().length` | clé existante ; valeurs à réaligner (`\n`, `badgeLibelle`) ; `legende` à rendre éditable |
| 2 | `Companies` (`#filiales`) | surtitre, titre sur 2 lignes, texte à droite ; puis 6 lignes alternées : image, barre d'accent, n° 01–06, libellé « Filiale », nom, secteur (accent), description, lien « Découvrir cette filiale » | en-tête : `ACCUEIL:filiales` (type `section`) ; lignes : `GET /api/public/sites` (`PublicSiteSummary` trié par `ordre`) | clé existante, valeurs à réaligner ; `secteur`/`description`/`heroImageKey` **non éditables** (T1 + T3) |
| 3 | `Stats` (fond navy, vague du haut) | surtitre, titre avec 2 accents, texte, 4 chiffres | `ACCUEIL:chiffres` (type `chiffres`, `effectif`/`filiales` résolus côté serveur) | clé existante ; valeurs à réaligner (4 items) |
| 4 | CTA final | titre, texte, bouton → `/contact` | `ACCUEIL:cta` (type `cta`) | clé existante ; valeurs à réaligner |
| — | SEO | title, description, og | `ACCUEIL:seo` | existante ; passage à `{groupe}` + interpolation |
| — | Footer (layout) | — | `SiteFooter` (déjà en place) | inchangé |

Collections services/réalisations/partenaires : **non utilisées par le prototype `/`**. L'ajout d'une preuve de confiance supplémentaire est discuté au §6 (exclue par défaut).

### Cartographie « tout contenu public éditable » (entités affichées sur `/`)

| Donnée affichée | Stockage | Éditable en admin aujourd'hui | Après cette spec |
|---|---|---|---|
| Textes hero/filiales/chiffres/cta/seo | `SectionContenu` ACCUEIL | oui (`/admin/contenu`, Sections), sauf `hero.legende` | oui, y compris la légende (T1) |
| Image du hero | `hero.imageKey` ou `Company(holding).heroImageKey` | `hero.imageKey` oui ; Company non | oui (section) ; Company via T3 |
| Nom des filiales | `Company.nom` | API seulement (SUPER_ADMIN), sans UI | T3 (SUPER_ADMIN) |
| Secteur, description des filiales | `Company.secteur/description` | **non** (absents du schéma de réglages) | T1 (API) + T3 (UI) |
| Image de couverture des filiales | `Company.heroImageKey` | API seulement | T3 |
| Ordre des filiales | `Company.ordre` | API seulement (SUPER_ADMIN) | T3 (SUPER_ADMIN) |
| Accent des filiales | `Company.couleurAccent` | non, **par décision** (§6 non négociable) | inchangé, exclu volontairement |
| Effectif (chiffre calculé) | `Company.effectif` (somme) | API seulement | T3 |
| Footer : piedDePage / coordonnées / réseaux | Section COMMUN / Company | piedDePage oui ; coordonnées API seulement | T3 |
| Libellés « Filiale », « Découvrir cette filiale », « Nous joindre » | code | — | restent des libellés d'interface (exception CLAUDE.md, même statut que la nav `publicNav`) |

---

## 2. Catalogue et seed

### 2.1 Catalogue : aucune nouvelle entrée
`catalog.ts` est inchangé.

### 2.2 `shared/content/sections/types.ts` (T1)
Imports relatifs et zod explicite conservés.

```ts
// heroSchema : légende vide (les 2 champs vides, produits par le formulaire CMS) → absente
const legendeSchema = z.object({ surtitre: z.string().trim().min(1), titre: z.string().trim().min(1) }).strict()
legende: z.preprocess(
  (v) => (v && typeof v === 'object' && Object.values(v).every((x) => typeof x === 'string' && x.trim() === '') ? undefined : v),
  legendeSchema.optional(),
),
```

Dans `heroFields` :
- ajouter, après `imageAlt` :
  ```ts
  { key: 'legende', label: "Légende de l'image", type: 'liste',
    helpText: 'Facultatif — laisser les deux champs vides pour masquer la légende.',
    itemFields: [{ key: 'surtitre', label: 'Surtitre', type: 'text', maxLength: 80 },
                 { key: 'titre', label: 'Titre', type: 'text', maxLength: 80 }] }
  ```
  `CmsFieldInput` gère déjà `liste` en sous-objet quand la valeur n'est pas un tableau.
- sur `imageKey`, ajouter : `helpText: "Facultatif — à défaut, l'image principale du site est utilisée."`

### 2.3 `prisma/seed-data/sections.ts`, `accueilHolding()` (T1)
Source : prototype, avec références de ligne en commentaire. Les autres builders sont inchangés.

```ts
seo: {
  title: '{groupe} — Holding montréalaise, six filiales au Québec',            // index.tsx:12
  description: 'Le {groupe} réunit six entreprises de services au Québec : entretien, transport, comptabilité, placement, import-export et distribution de boissons.', // index.tsx:13 (≤160)
},
hero: {
  surtitre: 'Holding — Montréal, Québec',                                      // Hero.tsx:34
  titre: 'Six entreprises.\n*Une seule* exigence.',                            // Hero.tsx:43-46 (<br/> conservé)
  texte: '(inchangé)',
  ctaLibelle: 'Découvrir nos filiales',
  imageKey: null,                                                              // repli Company.heroImageKey
  imageAlt: 'Vue sur Montréal, siège du {groupe}',
  legende: { surtitre: 'Siège social', titre: 'Montréal · Québec' },           // Hero.tsx:98-101
  badgeLibelle: 'Filiales actives',                                            // nombre calculé, voir §4
},
filiales: {                                                                    // Companies.tsx:12-22
  surtitre: 'Nos filiales',
  titre: 'Six métiers,\nun même standard.',
  texte: 'Chaque filiale du {groupe} est indépendante dans son opération, mais partage la même culture : proximité avec le client, exigence sur la qualité, engagement à long terme.',
},
chiffres: {                                                                    // Stats.tsx:3-31
  surtitre: 'Pourquoi le {groupe}',
  titre: 'Un ancrage *montréalais*, une vision de *groupe*.',
  texte: 'Fondé et opéré depuis Montréal, le {groupe} s’est bâti secteur par secteur, en acquérant l’expertise nécessaire pour livrer à chaque fois le même niveau de service — quel que soit le métier.',
  items: [
    { type: 'libre', valeur: '12+', libelle: 'années d’existence' },          // À VALIDER CLIENT (Q-12)
    { type: 'effectif', libelle: 'employés à travers le groupe', arrondi: true }, // Q-03 : source unique
    { type: 'filiales', libelle: 'secteurs d’activité couverts' },
    { type: 'libre', valeur: '100%', libelle: 'opéré depuis Montréal' },
  ],
},
cta: {                                                                         // index.tsx:31-41
  titre: 'Parlons de votre projet.',
  texte: 'Notre bureau de Montréal reçoit vos demandes et les redirige vers la filiale concernée.',
  ctaLibelle: 'Nous joindre',
},
```

**Seed en amorçage uniquement** : ces nouvelles valeurs ne s'appliquent **pas** à une base déjà semée. Deux options pour la base de dev (le thread principal choisit avec l'utilisateur, aucun agent ne lance la commande destructive de lui-même) :
- `pnpm prisma migrate reset --force && SEED_DEMO_DATA=true pnpm db:seed` (démo seulement, précédent en phase 2) ;
- ou éditer les 5 sections à la main dans `/admin/contenu`.

---

## 3. API

**Lecture publique** : les endpoints existants suffisent, aucune nouvelle route.

| Appel (côté page) | Endpoint | Remarque |
|---|---|---|
| `useSite('holding')` | `GET /api/public/sites/holding` | déjà chargé par le layout (clé partagée `site:holding`) |
| `useSites()` | `GET /api/public/sites` | déjà chargé par le layout (clé `sites`), pas de 2ᵉ requête |
| `useSiteSections('holding','ACCUEIL')` | `GET /api/public/sites/holding/sections?page=ACCUEIL` | chiffres résolus côté serveur |
| images | `GET /api/files/[key]` | existant |

**Admin (T1) : `PATCH /api/admin/sites/[uuid]`, contrat étendu**

| Champ ajouté | Zod (`shared/validation/sites.ts`, dans `siteReglagesFilialeShape`, donc AF sur sa filiale et SUPER_ADMIN) | Prisma |
|---|---|---|
| `secteur` | `z.string().trim().min(2).max(160).nullable().optional()` | `Company.secteur` |
| `description` | `z.string().trim().min(10).max(600).nullable().optional()` | `Company.description` |

- `GET /api/admin/sites/[uuid]` et `PATCH` renvoient en plus `secteur` et `description` : `DETAIL_SELECT`, `DetailRow`, `toReglagesDto`, `AdminSiteReglages` dans `shared/types/admin.ts`.
- Succès 200 ; erreurs inchangées : 400 (zod, champ inconnu dont `couleurAccent`), 401, 403, 404.
- `invalidatePublicPages()` est déjà appelé par `update`.
- Aucun SQL brut, `select` explicite, `uuid` seul exposé.

---

## 4. Découpage frontend

### 4.1 Fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `app/pages/index.vue` | **réécrire** | Orchestration : `useSite`, `useSites`, `useSiteSections(HOLDING_SLUG,'ACCUEIL')`, SEO, erreur de page (même motif que `a-propos.vue:61-64`), composition des 4 sections |
| `app/components/site/accueil/HoldingHero.vue` | créer | props `{ hero: HeroData \| undefined; fallbackImageKey: string \| null; nombreFiliales: number; groupe: string }` |
| `app/components/site/accueil/HoldingFiliales.vue` | créer | props `{ heading: SectionData \| undefined; filiales: readonly PublicSiteSummary[] \| null; pending: boolean; error: boolean }` ; emit `retry` |
| `app/components/site/accueil/HoldingChiffres.vue` | créer | props `{ chiffres: ChiffresData }` |
| `app/components/site/SectionCta.vue` | créer (réutilisable par les accueils et pages services des filiales, type `cta`) | props `{ cta: CtaData; to: string; tone?: 'clair' \| 'sombre' }` |
| `app/composables/useSiteSections.ts` | modifier (types seulement) | + `HeroData` (miroir de `heroSchema`, `legende?`, `badgeLibelle?`, `imageKey?: string \| null`), + `CtaData` |
| `app/components/site/SiteImage.vue` | modifier | + prop `priority?: boolean` (défaut false) → `loading="eager"` + `fetchpriority="high"` ; sinon `lazy` inchangé |
| `app/components/site/SiteHeader.vue` | modifier | **correctif** `hash: item.hash` (ne plus préfixer `#`) aux lignes 87 et 132 ; `contactTo` via `contactPath(site.slug)` (§5, T0) au lieu du lookup par libellé `'Contact'` |
| `app/assets/css/main.css` | modifier | `[data-site], [data-accent-scope] { --site-accent-strong: color-mix(in oklab, var(--site-accent) 72%, black); }` (recalcul par ligne de filiale, sans dupliquer `data-site` que l'e2e cible) |

### 4.2 Détail par section (classes indicatives, tokens uniquement, aucun hex)

**Page (`index.vue`)**
- `vars = { groupe }`.
- `useSeoMeta` : `title`, `description`, `ogTitle`, `ogDescription`, `ogType: 'website'`, tous passés par `interpoler(…, vars)` (`#shared/utils/texte`). Replis : `groupe` et `site.description`.
- Erreur des sections : bloc « Impossible de charger cette page » + Réessayer.
- Si `hero` est absent (ligne invalide omise par le serveur) : H1 de repli = `groupe`, pour que la page ait toujours un H1.

**HoldingHero**
- `section.relative.overflow-hidden.pt-32.pb-20.lg:pt-40.lg:pb-32`.
- Formes : blob navy et cercle or en SVG `aria-hidden`, `fill-navy`/`fill-gold`, **`hidden lg:block`**, ancrés `top-24` (sous le header) pour que la nav ne passe jamais sur le navy.
- Grille `lg:grid-cols-12` : texte `lg:col-span-7`, image `lg:col-span-5`. **Une seule colonne sous `lg`**, image sous le texte en `aspect-[4/3]`, puis `lg:aspect-[4/5]`.
- Surtitre : `TexteAccentue as="p"`, `text-gold-deep`, uppercase tracking.
- H1 : `TexteAccentue as="h1"`, `text-4xl sm:text-5xl lg:text-7xl text-navy [&_em]:text-ink`.
- Texte : `text-lg text-ink/80`.
- CTA **unique** : `NuxtLink :to="{ hash: '#filiales' }"`, `bg-navy text-cream rounded-full px-7 py-4` (hauteur ≥ 44 px), icône `ArrowDownRight` `aria-hidden`.
- Image : `SiteImage :file-key="hero.imageKey ?? fallbackImageKey" :alt="interpoler(hero.imageAlt ?? '', vars)" fallback="aplat" priority`.
- Légende (si `hero.legende`) : overlay `bg-navy/85` en aplat (pas de dégradé), surtitre `text-gold`, titre `text-cream`.
- Carte chiffre (si `badgeLibelle`) : `hidden lg:block absolute -top-6 -left-6` (**en haut**, pour ne plus masquer la légende), valeur `String(nombreFiliales).padStart(NUMERO_PAD, '0')`, libellé `text-ink/70`.
- Animation :
  - **pas de `v-motion` sur le H1 ni sur l'image** (LCP, contenu visible au SSR sans JS) ;
  - entrée CSS `motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3` (tw-animate-css) sur surtitre, texte et CTA ;
  - la règle `prefers-reduced-motion` globale est déjà en place.

**HoldingFiliales**
- `section#filiales.scroll-mt-24.py-24.md:py-32`. Le scroll du router Nuxt respecte `scroll-margin-top`, donc le header fixe ne masque pas le titre.
- En-tête :
  - grille `md:grid-cols-12`, `SectionHeading` avec `{surtitre, titre}` à gauche (`md:col-span-7`) et `TexteAccentue` du `texte` à droite (`md:col-span-5`, `text-ink/75`) ;
  - wrapper `style="--site-accent: var(--gold); --site-accent-strong: var(--gold-deep)"`, même motif que `a-propos.vue:168`.
- `EtatCollection` (pending, erreur avec retry, vide « Aucune filiale à afficher pour le moment. ») autour de `<ol class="mt-20 space-y-24">`.
- Chaque `<li>` :
  - `data-accent-scope` + `:style="{ '--site-accent': f.couleurAccent }"`. La valeur est revalidée `^#[0-9A-F]{6}$` côté serveur, et le binding objet Vue échappe.
  - `v-motion v-bind="reveal()"` ; grille `md:grid-cols-12`, ordre alterné `index % 2 === 1 → md:order-2`.
- Image : `SiteImage :file-key="f.heroImageKey" :alt="f.nom" fallback="aplat" :initiales`, `aspect-[4/3] rounded-[1.5rem]`, zoom au survol `transition-transform duration-[900ms] hover:scale-105`. Barre `h-2 bg-site-accent` en bas (élément non textuel).
- Ligne méta :
  - numéro `String(index + 1).padStart(NUMERO_PAD, '0')` (index, **jamais un id**) en `text-site-accent-strong` ;
  - filet `bg-site-accent/40` ;
  - libellé « Filiale » en `text-ink/70` (le prototype utilisait `/50`, sous le seuil AA).
- Nom : `h3.text-navy`. Secteur : `text-site-accent-strong` (masqué si null). Description : `text-ink/75` (masquée si null).
- Lien unique : `NuxtLink :to="`/${f.slug}`"`, souligné `border-site-accent`, avec « Découvrir cette filiale » + `<span class="sr-only"> : {{ f.nom }}</span>` pour des noms de liens distincts. Icône `ArrowUpRight` `aria-hidden`.
- Filiale en maintenance : toujours listée, son lien mène à la page de maintenance (phase 2, point ouvert 9 tranché).

**HoldingChiffres**
- `section.relative.bg-navy.text-cream.py-24.md:py-32`, vague du haut en SVG `fill-cream` `aria-hidden` (conservée : une courbe, pas un dégradé).
- En-tête : `SectionHeading tone="sombre"` dans un wrapper `[&_em]:text-gold` (or sur navy ≈ 6:1).
- Liste :
  - `<dl class="grid grid-cols-2 gap-x-8 gap-y-14">` ;
  - chaque item en `div.flex.flex-col-reverse.border-t.border-cream/20.pt-6` avec `<dt>` = libellé (`text-sm uppercase tracking-widest text-cream/90`) et `<dd>` = valeur (`font-display text-5xl md:text-7xl`) : sémantique dt/dd correcte, ordre visuel du prototype ;
  - `v-motion` + `reveal(index)`.

**SectionCta**
- Centré, `h2` `TexteAccentue` `text-navy`, texte `text-ink/75`.
- Bouton `NuxtLink :to` `bg-navy text-cream rounded-full px-8 py-4` + `ArrowRight` `aria-hidden`. La page passe `contactPath(HOLDING_SLUG)`.

Constante locale `NUMERO_PAD = 2` (zéro magic value). Aucun `v-html`, aucun dégradé, aucun badge décoratif (la carte « 06 » affiche une vraie donnée calculée), aucun emoji.

### 4.3 Écarts assumés par rapport au prototype

| Écart | Raison |
|---|---|
| 2ᵉ CTA du hero « Nous contacter » supprimé | un CTA net par section ; lien cassé (`#contact`) ; le header et la section finale couvrent le contact |
| Blob et cercle masqués sous `lg`, ancrés sous le header | le prototype rend le H1 illisible à 375/768 et la nav illisible à 1440 |
| Hero sur une colonne sous `lg` (le prototype passe en 2 colonnes à `md`) | H1 tronqué à 768 sur les captures |
| Carte « 06 » en haut à gauche (au lieu du bas) | elle masquait la légende « Montréal » |
| Vague du bas du hero supprimée | crème sur crème, sans effet visible |
| « 06 » calculé ; chiffre `filiales` du bandeau affiché « 6 » (non paddé) | source unique (`resolveChiffres`), cohérent avec `/a-propos` |
| Deux accents du titre des chiffres en or (prototype : or + crème) | `TexteAccentue` n'a qu'un style d'accent |
| Surtitre des chiffres en `cream/90` (prototype : or) | convention `SectionHeading tone="sombre"`, identique à `/a-propos` |
| Petit texte d'accent en `-strong`, « Filiale » en `ink/70` | WCAG AA |
| « Découvrir cette filiale » + nom en `sr-only` | liens distincts (2.4.4) |
| Chiffres 150+ → effectif calculé (≈ « 130+ » selon le seed) | Q-03 : source unique éditable |

---

## 5. Plan d'implémentation (périmètres DISJOINTS)

**T0, thread principal, avant T1/T2 (S)** : fichier partagé nécessaire au frontend.
- `shared/config/sites.ts` : `export function contactPath(slug: SiteSlug): string` (holding → `/contact`, filiale → `/${slug}/contact`), dérivé de la même base que `publicNav` ; import relatif.
- `tests/unit/sites-config.test.ts` : + cas `contactPath`.

| # | Agent (+skill) | Taille | Dépend de | Fichiers (touche UNIQUEMENT) | Critère de fin |
|---|---|---|---|---|---|
| **T1** | backend (`nitro`) | M | T0 | `shared/content/sections/types.ts` (légende + helpText), `prisma/seed-data/sections.ts` (`accueilHolding()` seulement), `shared/validation/sites.ts`, `shared/types/admin.ts`, `server/services/admin/sites.ts`, `tests/unit/sites-validation.test.ts`, `tests/unit/sections-types.test.ts` (nouveau) | `pnpm typecheck` ; `pnpm test:unit` (dont `sections-catalog` vert sur les nouvelles valeurs) ; PATCH `secteur`/`description` vérifié à la main (200, 400 si `couleurAccent`, 403 AF sur une autre filiale) |
| **T2** | frontend (`vue3` + `ui-ux`) | L | T0 (T1 seulement pour l'intégration) | `app/pages/index.vue`, `app/components/site/accueil/**`, `app/components/site/SectionCta.vue`, `app/components/site/SiteImage.vue`, `app/components/site/SiteHeader.vue`, `app/composables/useSiteSections.ts`, `app/assets/css/main.css` | `pnpm typecheck` ; page rendue en dev puis en build prod ; aucun dégradé, `v-html` ni texte public en dur |
| **T3** (recommandé, commit séparé) | frontend (`vue3`) | M | T1 | `app/pages/admin/contenu/site.vue` (nouveau), `app/pages/admin/contenu.vue` (onglet « Site »), `app/config/cms-site-fields.ts` (nouveau) | fiche société éditable (voir ci-dessous) ; toasts ; e2e T4 |
| **T4** | tester (`testing` + `playwright`) | M | T1, T2 (+T3) | `tests/e2e/home.spec.ts` (nouveau), `tests/e2e/admin-site.spec.ts` (si T3) | verts contre `.output` |
| **T5** | regression-checker, puis reviewer + ux-reviewer | S | T4 | aucun (corrections renvoyées aux propriétaires) | CRITICAL/MAJOR corrigés ; captures 3 breakpoints comparées |

T1 et T2 tournent en parallèle après T0 (fichiers disjoints). T3 démarre après T1 (types admin).

**T3, contenu minimal**
- Sélecteur de site : même motif que l'onglet Sections, `GET /api/admin/sites`.
- `GET /api/admin/sites/[uuid]`, puis `CmsFormDialog` avec les champs `nomCourt`, `secteur`, `description` (textarea), `heroImageKey` (image), `effectif`, `email`, `telephone`, `adresse`, `linkedinUrl`, `facebookUrl`, `instagramUrl` ; pour SUPER_ADMIN seulement : `nom`, `ordre`.
- `statutSite` : hors T3 (déjà piloté par l'API, UI avec `/admin/filiales`).
- Pièges :
  - chaînes vides → `null` avant PATCH (sinon 400 sur `email`/URL) ;
  - `effectif` et `ordre` : pas de `CmsFieldType` numérique, donc champ `text` + `z.coerce.number()` dans un schéma de formulaire local qui mappe vers `siteReglages*Schema` ;
  - uuid validé avant l'URL ;
  - toasts « Fiche mise à jour. » / erreur générique ; aucun `confirm` ni `alert`.

**Commits** : `feat(home): …` (T2), `feat(cms): editable hero caption + site sector/description` (T1), `fix(site): header hash anchor` (peut aller avec T2), `feat(admin): site settings tab` (T3).

---

## 6. Critères d'acceptation, tests, points ouverts

### Critères d'acceptation
1. `GET /` renvoie 200 en build de production ; un seul `<h1>`, dont le texte vient de `ACCUEIL:hero.titre` (accent rendu en `<em>`, `\n` rendu en `<br>`).
2. 6 lignes de filiales dans l'ordre de `GET /api/public/sites`, numérotées 01–06 ; `href` = `/{slug}` ; `--site-accent` de chaque `<li>` = accent attendu (fixture `tests/e2e/fixtures/accents.ts`) ; couleur calculée du secteur ≠ accent brut (le `-strong` est bien appliqué).
3. « Nos filiales » (header) a `href="/#filiales"` (plus de `##`). Le clic sur le CTA du hero fait défiler vers `#filiales` avec le haut de la section sous le header (top ≥ hauteur du header).
4. Le bandeau des chiffres affiche 4 items ; la valeur de l'effectif correspond à `^\d+\+$` ; la valeur des filiales vaut « 6 ». La carte du hero affiche « 06 » (≥ lg).
5. Le CTA final pointe vers `/contact`.
6. **Édition, puis publication immédiate** : un SUPER_ADMIN modifie `ACCUEIL:hero.titre` et `ACCUEIL:filiales.titre` par l'API admin, et `/` reflète les deux sans attendre le TTL ISR. Restauration en `afterAll`.
7. À 375 px : `scrollWidth ≤ 375`, blob invisible, H1 entièrement visible. Aucune requête vers un hôte externe.
8. Aucun élément avec un `background-image` calculé contenant `gradient` ; aucun `v-html` dans les fichiers de T2 (grep).
9. `prefers-reduced-motion: reduce` : tout le contenu est visible sans scroll (pas d'opacité 0 résiduelle).
10. Image du hero : `<img src="/api/files/…" loading="eager" fetchpriority="high">`. Les images des filiales sont en `lazy`.
11. (T3) Modifier le `secteur` d'entretien dans l'onglet « Site » met à jour `/` immédiatement ; un ADMIN_FILIALE ne voit que sa filiale.

### Tests
- **Unitaires**
  - `sections-types.test.ts` : `heroSchema` accepte l'absence de légende, transforme `{surtitre:'', titre:''}` en `undefined`, et rejette `{surtitre:'x', titre:''}`.
  - `sites-validation.test.ts` : bornes de `secteur`/`description`, `null` accepté, `couleurAccent` toujours rejeté.
  - `sites-config.test.ts` : `contactPath`.
  - `sections-catalog.test.ts` : existant, couvre les nouvelles valeurs automatiquement.
- **E2E** `tests/e2e/home.spec.ts` : critères 1 à 10. Projets desktop + mobile ; utiliser `page.emulateMedia({ reducedMotion: 'reduce' })` pour la vérification de visibilité ; assertions tirées de l'API publique, pas du texte en dur.
- **Vérification visuelle** : captures Playwright 375/768/1440 en scroll pas à pas (le `v-motion` masque les sections en fullPage, cf. PROJECT_STATE), comparées à `conversion-captures/home/`. Courte vidéo ffmpeg du reveal des lignes et du scroll vers l'ancre.

### Points d'attention
- **Sécurité** : `couleurAccent` injectée en style uniquement après la revalidation serveur ; aucune donnée de la base en `v-html` ; les liens sont construits depuis `slug` (`SiteSlug` typé), jamais depuis une chaîne libre.
- **Performance** :
  - 3 fetchs SSR, dont 2 dédupliqués avec le layout ; ISR 3600 s et invalidation explicite déjà en place ;
  - les images sont servies en 1600 px JPEG sans variantes responsives : 6 images différées d'environ 200–400 Ko. Point à traiter globalement plus tard (redimensionnement à l'upload ou `@nuxt/image`), pas dans cette route.
- **Régression** : la modification de `heroSchema` touche les héros filiales et le restaurant (légende « Ouverture »). Le préprocess ne retire que les légendes entièrement vides. `SiteHeader` et `SiteImage` sont utilisés par `/a-propos` et `/[filiale]/a-propos` : relancer `layout-accent.spec.ts` et `a-propos.spec.ts`.

### Exclus volontairement (et pourquoi)
- JSON-LD `Organization`/`LocalBusiness`, `og:image`, canonical : transverses aux 7 sites. Ils demandent une URL de site absolue en `runtimeConfig` et un échappement JSON sûr : **tâche SEO commune à part.**
- Analytics : aucune pile décidée.
- Interpolation `{groupe}` dans le SEO de `/a-propos` : à faire au même format, en suivi.

### Points ouverts à trancher (valeur retenue par défaut)
| # | Point | Défaut |
|---|---|---|
| 1 | Onglet « Site » (T3) maintenant, ou avec `/admin/filiales` | **Maintenant**, commit séparé. Sans lui, `/` affiche 6 × (secteur, description, image) non éditables : règle client violée. `/` reste 👀 tant que T3 n'est pas fait |
| 2 | **Q-12 (nouvelle)** : « 12+ années d'existence » est une affirmation non vérifiée | Semée telle quelle (prototype validé), éditable ; à confirmer par le client avant la mise en production |
| 3 | Mise à jour des valeurs par défaut sur la base de dev (seed en amorçage) | `migrate reset` + seed démo, **sur accord de l'utilisateur** ; sinon édition manuelle des 5 sections |
| 4 | Preuve de confiance supplémentaire (aperçu de 3 réalisations holding, bande de partenaires) | **Exclue.** Réalisations = photos Unsplash présentées comme réelles (risque déjà signalé en phase 2, point 5), partenaires sans logo (initiales seulement), `/realisations` pas encore construite. À ajouter (clé `ACCUEIL:realisations`, type `section`, API existante `?limit=3`) quand de vraies photos existeront |
| 5 | La carte « Filiales actives » compte toutes les filiales, y compris en maintenance | Toutes (`statutSite` concerne le site web, pas l'activité), cohérent avec le chiffre `filiales` |
| 6 | Liens vers `/{filiale}`, `/contact`, `/realisations` en 404 jusqu'à leur conversion | Accepté hors production ; l'e2e ne vérifie que les `href` |
| 7 | Deux sources d'image pour le hero (section, puis Company) | `hero.imageKey ?? site.heroImageKey`, expliqué par le `helpText` ; règle identique pour les héros filiales |

### Fichiers de référence
- Code à modifier ou réutiliser :
  - `/home/cabrel/projects/cd-holding/app/pages/index.vue`
  - `/home/cabrel/projects/cd-holding/app/pages/a-propos.vue`
  - `/home/cabrel/projects/cd-holding/app/components/site/SiteHeader.vue` (bug `##`, l. 87 et 132)
  - `/home/cabrel/projects/cd-holding/app/components/site/SiteImage.vue`
  - `/home/cabrel/projects/cd-holding/app/assets/css/main.css` (l. 69)
  - `/home/cabrel/projects/cd-holding/app/composables/useSiteSections.ts`
  - `/home/cabrel/projects/cd-holding/shared/content/sections/types.ts` (`heroFields`, l. 102-110)
  - `/home/cabrel/projects/cd-holding/prisma/seed-data/sections.ts` (`accueilHolding`, l. 356-393)
  - `/home/cabrel/projects/cd-holding/shared/validation/sites.ts`
  - `/home/cabrel/projects/cd-holding/server/services/admin/sites.ts`
  - `/home/cabrel/projects/cd-holding/shared/config/sites.ts`
- Prototype :
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/routes/index.tsx`
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/holding/Hero.tsx`
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/holding/Companies.tsx`
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/holding/Stats.tsx`
- Captures : `/home/cabrel/projects/cd-holding/conversion-captures/home/{375x812,768x1024,1440x900}.png`
