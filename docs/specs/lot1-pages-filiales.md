# Spec lot 1 : accueil, services et réalisations des filiales, `/realisations` et `/confidentialite`

Sources lues : CLAUDE.md, PROJECT_STATE, CONVERSION_INVENTORY (sections des filiales + DEC/Q), spec phase3 §3-4, le prototype (`SubHome`, `SubHero`, `SubServicesPage`, `SubRealisationsPage`, `subConfig`, `placement.index`, `ccdpaa.index`, `ccdpaa.services`), 3 captures à 1440, le catalogue, le seed des sections, `server/services/public/sites.ts`, les composables et les composants `site/`.

## 0. CHALLENGE
- **Bug réel : `useSiteCollection` partage les données entre accueil et pages complètes.** La clé `site-collection:${slug}:${resource}` ignore la query. L'accueil (`misEnAvant`, `limit=3`) et la page complète tombent donc sur la même clé. Conséquence : après une navigation client accueil → `/x/services`, la page affiche 3 services au lieu de tous. Correctif en T0 : la query entre dans la clé.
- **Bug réel : la page réalisations serait tronquée sans le dire.** L'API applique par défaut `DEFAULT_REALISATIONS_LIMIT = 12`, sans pagination. La page complète doit passer `limit=REALISATIONS_MAX` (50, le max zod), une constante partagée. Pas de pagination : au plus 3 réalisations par site aujourd'hui, ce serait inutile.
- **À vérifier : l'ISR de `/entretien` (sans sous-chemin).** La règle `/${s}/**` ne couvre peut-être pas cette URL. On ajoute `/${s}` explicitement en T0 (sans risque).
- **Écarts du prototype à ne pas reproduire :**
  - dégradé et `String(s.id)` dans le visuel des services (« 25 » affiché pour les supermarchés) ;
  - numérotation `0{i+1}` (donne « 010 » au 10ᵉ service) ;
  - `id !== 20` codé en dur sur l'accueil ccdpaa ;
  - grille des réalisations avec `aspect` posé sur l'`<article>` : hauteurs incohérentes et trou de 7 colonnes avec 3 éléments (visible sur la capture entretien) ;
  - blob du hero posé sur le H1 en mobile ;
  - 2 CTA dans le hero.
- **Rien ne manque au catalogue.** ACCUEIL (standard, `audiences` pour placement, `metiers` pour ccdpaa), SERVICES, REALISATIONS (holding comprise, DEC-39) et CONFIDENTIALITE sont déjà déclarés et seedés. Il manque seulement des valeurs par défaut optionnelles (surtitres, sauts de ligne du H1). L'API publique suffit, hormis les 2 bugs ci-dessus.
- **Un seul `index.vue` pour 6 accueils de 3 formes différentes.** Standard, placement (duo audiences) et ccdpaa (duo métiers) se distinguent par les données : on affiche le duo si `sections.audiences ?? sections.metiers` existe. Aucun `if` par slug. Seules les cibles des liens du duo vivent dans une config typée (`FILIALE_DUO_LIENS`), sur le modèle de `SITE_EXTRA_PAGES`.
- **Assistant import-export exclu du lot.** C'est un envoi de lead (DEC-14, `ASSISTANT_IMPORT_EXPORT`) qui a sa ligne propre dans la checklist. `/ccdpaa/services` sort sans l'assistant plutôt qu'avec une façade.
- **`/realisations` holding absente du prototype.** Aucune route ni capture, mais le header la lie et DEC-39 (décision utilisateur) veut une page dédiée. Elle est incluse et réutilise le composant des filiales. Elle ne montre que les réalisations propres à la holding (pas d'agrégat des filiales).

## 1. Sections par page → source

**`/{filiale}` : `app/pages/[filiale]/index.vue`**, page validée par `isFilialeSlug`

| Section du prototype | Source | Variation entre filiales |
|---|---|---|
| Hero (surtitre, H1 accentué, texte, CTA, image) | `ACCUEIL.hero` ; image = `hero.imageKey ?? site.heroImageKey` | Mise en page `image` (4 standards) ou `texte` quand un duo existe (placement, ccdpaa) : pas d'image, pas de CTA, aplat `bg-site-accent/10` à droite sur `lg` |
| Duo (cartes Employeurs/Candidats ; Import-export/Restaurant) | `ACCUEIL.audiences` ou `ACCUEIL.metiers` (type `duo`) + `FILIALE_DUO_LIENS[slug]` | Carte image si `imageKey` (bandeau `bg-navy/85`), sinon aplat (a : `bg-navy`, b : `bg-site-accent-strong`) |
| Aperçu services 01…03 | en-tête `ACCUEIL.services` ; liste `GET …/services?misEnAvant=true` (au plus 3, imposé par le CMS, repli sur les 3 premiers) | Même rangée numérotée pour les 6 (écart placement/ccdpaa, §4) ; supermarchés en tête (Q-05, déjà seedé) |
| Aperçu réalisations (fond navy) | en-tête `ACCUEIL.realisations` ; liste `GET …/realisations?limit=3` | Colonnes selon le nombre d'éléments (1, 2 ou 3) ; placement en a 2 |
| CTA final | `ACCUEIL.cta` → `SectionCta :to="contactPath(slug)"` | Absent pour placement et ccdpaa (pas de clé, comme au prototype) : on rend si la clé existe |
| SEO | `ACCUEIL.seo` | Repli : `site.nom` / `site.description` |

**`/{filiale}/services` : `app/pages/[filiale]/services.vue`**

| Section | Source | Note |
|---|---|---|
| En-tête (H1 à gauche, texte à droite) | `SERVICES.entete` (surtitre, titre → h1, texte) | H1 rendu par la page avec `TexteAccentue as="h1"` (SectionHeading rend un h2) |
| Rangées alternées | `GET …/services` (tous, triés par `ordre`) | Numéro `String(i+1).padStart(2,'0')`. Visuel : `SiteImage :file-key="s.imageKey"`, repli aplat affichant le numéro, **décoratif**. Entretien : 5 services dont supermarchés. Comptable : états financiers, T1, T2, création, régularisation (déjà seedés) |
| Encadré CTA navy | `SERVICES.cta` → `SectionCta variant="encadre"` | Bouton `bg-cream text-navy` sur navy (AA) |
| Assistant (ccdpaa) | `SERVICES.assistant` | **Hors lot** (voir §0) |

**`/{filiale}/realisations` et `/realisations` : `[filiale]/realisations.vue`, `realisations.vue`** (pages minces, contenu dans `RealisationsListe`)

| Section | Source | Note |
|---|---|---|
| Surtitre + H1 | `REALISATIONS.entete` | Holding comprise |
| Grille éditoriale | `GET …/realisations?limit=REALISATIONS_MAX` | Motif par paires 8/4, 5/7, 6/6 ; un dernier élément seul sur sa ligne prend `col-span-12`. `aspect` sur le conteneur de l'image, pas sur l'`<article>`. Date via `formatMoisAnnee` (UTC, DEC-06) si non nulle |
| SEO | `REALISATIONS.seo` | |

**`/confidentialite` : `app/pages/confidentialite.vue`**, layout holding, `definePageMeta({ bypassMaintenance: true })` (la politique doit rester lisible : Loi 25, liens depuis les formulaires)

| Section | Source |
|---|---|
| H1, « Dernière mise à jour » (`<time datetime>` + `formatDateLongue`), introduction, sections h2 + paragraphes | `CONFIDENTIALITE.politique` (type `legal`) → `TexteLegal` (réutilisable plus tard pour les mentions légales boissons) |
| SEO | `CONFIDENTIALITE.seo` |

## 2. Catalogue et seed (T1)
- **Catalogue : aucune entrée à ajouter.**
- Valeurs par défaut à ajouter dans `prisma/seed-data/sections.ts` (toutes optionnelles pour le schéma) :

| Entrée | Ajout |
|---|---|
| `ACCUEIL.services` | `surtitre: 'Nos services'` |
| `ACCUEIL.realisations` | `surtitre: 'Nos réalisations'` |
| `SERVICES.entete` | `surtitre: 'Nos services'` |
| `REALISATIONS.entete` | `surtitre: 'Portfolio'` (6 filiales + holding) |

- `heroTitre` : ajouter les sauts de ligne du prototype (ex. `'Des espaces\n*impeccables,*\nsans y penser.'`, de même pour les 5 autres).
- **Rappel : le seed n'agit qu'à l'amorçage.** Il crée ce qui manque et ne met jamais à jour une entrée existante. Les bases déjà seedées ne recevront donc pas ces ajouts : il faudra les saisir dans `/admin/contenu` (à noter dans PROJECT_STATE). Le test existant qui valide les valeurs par défaut contre leur schéma doit continuer de passer.

## 3. API
- Endpoints existants suffisants : `GET /api/public/sites/[slug]`, `…/sections?page=ACCUEIL|SERVICES|REALISATIONS|CONFIDENTIALITE`, `…/services[?misEnAvant=true]`, `…/realisations[?limit=1..50]`.
- T1 : `server/services/public/sites.ts`, `realisationsQuerySchema.max(REALISATIONS_MAX)`, importé de `#shared/config/public`. Pas d'autre changement de contrat. Aucune nouvelle route.

## 4. Frontend : fichiers, réutilisation, écarts
**Réutilisés sans modification** : `TexteAccentue`, `SectionHeading`, `EtatCollection`, `useSite`, `useSiteSections`, `useReveal` (`v-motion`, jamais sur le H1 ni l'image LCP), `contactPath`, `formatMoisAnnee`, `formatDateLongue`, `interpoler`.

| Fichier | Tâche | Rôle / props |
|---|---|---|
| `components/site/filiale/FilialeHero.vue` | T2a | `{ hero: HeroData \| undefined; fallbackImageKey: string \| null; nomCourt: string; slug: FilialeSlug; layout: 'image' \| 'texte' }` ; blob `hidden lg:block` ; CTA unique `bg-navy text-cream` vers `contactPath` ; H1 de repli `nomCourt` |
| `components/site/filiale/FilialeDuo.vue` | T2a | `{ duo: DuoData; liens: { a: string; b: string } }` |
| `components/site/filiale/FilialeServicesApercu.vue` | T2a | `{ heading?: SectionData; services: PublicServiceDto[] \| null; pending; error; slug }`, emit `retry` |
| `components/site/filiale/FilialeRealisationsApercu.vue` | T2a | idem avec `PublicRealisationDto`, `tone="sombre"` |
| `pages/[filiale]/index.vue` | T2a | orchestration + `useSeoMeta` |
| `components/site/services/ServiceRangee.vue` | T2b | `{ service: PublicServiceDto; index: number }` |
| `components/site/realisations/RealisationsListe.vue` | T2b | `{ slug: SiteSlug }` : sections REALISATIONS + collection + états + SEO |
| `app/utils/grilleRealisations.ts` (+ test unitaire) | T2b | `classesRealisation(index, total): { col: string; aspect: string }` (fonction pure) |
| `pages/[filiale]/services.vue`, `pages/[filiale]/realisations.vue`, `pages/realisations.vue` | T2b | pages minces |
| `components/site/legal/TexteLegal.vue`, `pages/confidentialite.vue` | T2b | `{ legal: LegalData }` |
| `components/site/SectionCta.vue` | T2b | + `variant?: 'centre' \| 'encadre'` (défaut `centre`, ajout rétrocompatible) |

Libellés « Voir tous les services », « Voir toutes les réalisations » et « Dernière mise à jour » : libellés d'interface, donc en code.

**Écarts assumés** (à reporter dans le fichier de spec) :
- Aperçus placement/ccdpaa unifiés sur la rangée numérotée et la grille 3 colonnes décalée. Raison : la règle « pas de grilles de cartes génériques » et un seul composant.
- 2ᵉ CTA du hero (« Découvrir nos services ») supprimé : un CTA par section, précédent holding.
- CTA en navy plutôt qu'en accent : AA garanti, cohérent avec `SectionCta`.
- Hero ccdpaa avec paragraphe (le prototype n'en a pas) : proposition de valeur dès le premier écran.
- Photos du duo ccdpaa en aplat tant que l'admin n'a rien uploadé : les Unsplash codées en dur ne sont pas migrées (DEC-05).
- Visuel des services = image CMS ou aplat numéroté : pas de dégradé ni d'id.
- Dernière réalisation seule sur sa ligne en pleine largeur.
- Aucune page de conditions ni de mentions légales boissons dans ce lot.

## 5. Tâches (périmètres DISJOINTS)
**T0, thread principal, avant le reste (S)**
- `app/composables/useSiteCollection.ts` : clé `site-collection:${slug}:${resource}:${JSON.stringify(query)}`.
- `shared/config/public.ts` (nouveau, imports relatifs) : `APERCU_COLLECTION = 3`, `REALISATIONS_MAX = 50`.
- `shared/config/sites.ts` : `FILIALE_DUO_LIENS: Partial<Record<FilialeSlug, { cle: 'audiences' | 'metiers'; a: string; b: string }>>`, avec placement `{ a: contactPath('placement'), b: '/placement/offres' }` et ccdpaa `{ a: '/ccdpaa/services', b: '/ccdpaa/restaurant' }`.
- `nuxt.config.ts` : règle `/${s}` en ISR.
- `SiteImage.vue` : prop `decorative?: boolean` → `alt=""`, et le repli perd `role="img"`/`aria-label` au profit de `aria-hidden="true"`.
- `useSiteSections.ts` : types `DuoData` et `LegalData`.
- `tests/unit/sites-config.test.ts` : cas `FILIALE_DUO_LIENS`.

**T1 backend (S)** : `prisma/seed-data/sections.ts` (§2) et `server/services/public/sites.ts` (§3). Ne touche aucun fichier `app/`.

**T2a frontend accueil (M)** : les fichiers `filiale/*` et `pages/[filiale]/index.vue`. Ne touche PAS `SectionCta` (import seul), ni les pages services, réalisations ou confidentialité.

**T2b frontend services, réalisations, confidentialité (M)** : les autres fichiers du tableau §4, `SectionCta` compris. Ne touche PAS `filiale/*` ni `[filiale]/index.vue`.

**T3 e2e (M), après T2** : un fichier par type de page, valeurs attendues lues sur l'API publique, boucle sur les 6 slugs.
- `filiale-accueil.spec.ts` : ordre des titres des services mis en avant et des réalisations = API. Duo présent seulement pour placement et ccdpaa. Un seul H1.
- `filiale-services.spec.ts` : tous les services dans l'ordre de l'API, numéros 01…N. Supermarchés présent pour entretien. Une édition CMS (titre de service) est visible immédiatement après invalidation ISR, puis restaurée dans un try/finally.
- `realisations.spec.ts` : 6 filiales + holding, compte = API, dates formatées.
- `confidentialite.spec.ts` : titre et sections = API ; page en 200 même quand la holding est en maintenance.
- Partout : aucune requête vers un hôte externe ; `/holding` et `/inconnu/services` en 404.

## 6. Critères d'acceptation
1. Les 20 routes répondent 200 : les 18 pages filiales, `/realisations` et `/confidentialite`. Un slug inconnu ou `holding` donne 404.
2. Tout texte affiché vient des sections, des collections ou de `Company`. Aucun texte public en dur hors libellés d'interface, aucun `v-html`.
3. Aucun dégradé, aucun id affiché, numérotation par index sur 2 chiffres.
4. Les listes reflètent l'API : ordre, `misEnAvant`, `limit`. La navigation client accueil → services affiche la liste complète (bug de clé corrigé).
5. Les états chargement, erreur (Réessayer) et vide sont présents sur chaque collection.
6. Un seul H1 par page, un seul CTA par section, contraste AA (petits textes d'accent en `-strong`).
7. Une édition dans l'admin est visible immédiatement (invalidation ISR). `/{filiale}` est bien servie en ISR.
8. `/confidentialite` reste accessible pendant une maintenance de la holding.
9. `pnpm typecheck`, `test:unit` (grille, config) et `build:check` passent. Captures 375/768/1440 comparées pour `entretien`, `placement` et `ccdpaa`, plus 1 vidéo des apparitions au défilement.
10. PROJECT_STATE : 20 lignes 👀 (checklist + « Holding `/realisations` », absente de la checklist, à ajouter), note sur la saisie des surtitres dans les bases déjà seedées, assistant et mentions légales boissons encore ouverts.

**Points ouverts, avec la valeur retenue par défaut**
1. Aperçus unifiés pour placement et ccdpaa → oui.
2. Duo placement, carte a : `contactPath` sans `?audience=`, à fixer lors de la conversion de `/placement/contact`.
3. Liens `/placement/offres`, `/ccdpaa/restaurant` et `/{filiale}/contact` en 404 jusqu'à leur conversion. Accepté, même précédent que l'accueil holding.
4. `/realisations` holding : réalisations propres à la holding uniquement, pas d'agrégat.
5. Pas de pagination des réalisations (plafond 50).
6. Pas de table des matières sur `/confidentialite` (5 sections).
7. Texte légal toujours à faire valider par un juriste (Q-01).

## Fichiers de référence
- /home/cabrel/projects/cd-holding/app/composables/useSiteCollection.ts (bug de clé)
- /home/cabrel/projects/cd-holding/server/services/public/sites.ts (lignes 208-263)
- /home/cabrel/projects/cd-holding/shared/content/sections/catalog.ts
- /home/cabrel/projects/cd-holding/prisma/seed-data/sections.ts
- /home/cabrel/projects/cd-holding/app/pages/[filiale]/a-propos.vue (page modèle)
- /home/cabrel/projects/cd-holding/app/components/site/accueil/HoldingHero.vue (modèle du hero)
- /home/cabrel/projects/cd-holding/nuxt.config.ts (routeRules, ligne 79)
- /home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/pages/{SubHome,SubServicesPage,SubRealisationsPage}.tsx
- /home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/routes/{placement,ccdpaa}.index.tsx
