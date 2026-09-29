# Spec lot 4 : admin socle (login, shell, messages, clients)

Architect, 2026-09-29 (lecture seule). Sources : `CLAUDE.md`, `PROJECT_STATE.md`, `PROJECT_CONTEXT.md` §5-§7, `CONVERSION_INVENTORY.md` (DEC-11, 12, 31, 32, 35-38), `docs/specs/phase2-foundations.md` §3.4, §4.5-§4.6, `prisma/schema.prisma`, `server/utils/{auth,site-scope}.ts`, `server/policies/site-access.ts`, `server/services/admin/sites.ts`, `server/api/admin/messages/index.get.ts`, `server/lib/contact.ts`, `shared/config/{contact-forms,modules,sites}.ts`, `shared/types/admin.ts`, `shared/validation/{cms,contact}.ts`, `app/pages/admin/{index,login,contenu}.vue`, `app/middleware/admin.ts`, `app/stores/auth.ts`, `app/composables/useAdminResource.ts`, `app/components/cms/{CmsFormDialog,CmsDeleteDialog}.vue`, prototype `admin.tsx`, `admin.login.tsx`, `admin.messages.tsx`, `admin.clients.tsx`, `AdminSidebar.tsx`, `AdminHeader.tsx`.

Hypothèses : `'/admin/**': { ssr: false }` conservé ; comptes démo (SA, AF entretien, AF ccdpaa, EMPLOYE) semés.

## Écarts par rapport au brief

1. Pas de lu/non lu booléen : `StatutMessage` NOUVEAU / EN_COURS / TRAITE (DEC-11). « Non lu » = `NOUVEAU`, seul compteur de la sidebar.
2. Pas de filtre « formulaire » (doublon de `type` + `site`, filtre JSON sans index) : filtre `type` (DEC-38) ; l'origine est affichée.
3. Pas d'archivage (migration) : `TRAITE` en tient lieu. Suppression incluse (effacement Loi 25, spam).
4. Réservations hors Messages : route dédiée au lot 5 (DEC-35), pas de `Tabs`.
5. `details` jamais renvoyé brut : traduit serveur en `champs: {libelle, valeur}[]` depuis `CONTACT_FORMS` / assistant.
6. Navigation limitée aux routes converties (pas de façade). Lot 5 ajoute Planning, Comptabilité, Placement, Réservations, Filiales, Paramètres, Mon planning.
7. Login sans nom de groupe en dur ni comptes démo : panneau navy « Console d'administration. ».

## 0. CHALLENGE

- Priorité réelle : le bloquant prod « personne ne lit les messages » → lister, voir les `details`, changer le statut, convertir en client. Tableau de bord riche secondaire.
- Changement de contrat : `GET /api/admin/messages` passe d'un tableau à `{items,total,…}` → adapter `tests/e2e/{contact,contact-filiales,ccdpaa-assistant}.spec.ts` et `scripts/api-check.mjs` (T3).
- Dates : `formatDateLongue` formate en UTC → helper fuseau Québec (T0).
- Clients : unicité `(companyId, email)` sensible à la casse → normaliser en minuscules. Supprimer un client supprime son `DossierComptable` (cascade) → le dire dans l'AlertDialog.
- EMPLOYE : `/admin/mon-planning` au lot 5 (DEC-36) ; ce lot : shell sans module, état « Aucun module disponible pour votre compte », aucun appel API de données.
- Bloquant prod hors lot : pas de changement de mot de passe ni de gestion des comptes (DEC-37).

## 1. Écrans

| Écran | Données | États |
|---|---|---|
| `/admin/login` (`layout:false`) | `POST /api/auth/login` (existant) | Bouton « Connexion en cours… » désactivé. Erreur inline `role="alert"` : 401 « Identifiants invalides. Vérifiez votre courriel et votre mot de passe. », 429 « Trop de tentatives… ». Déjà connecté → `safeRedirect()` |
| Shell `app/layouts/admin.vue` | session, `GET /api/admin/sites`, `GET /api/admin/messages/compteurs` | Sidebar repliable, Sheet < 768 px. En-tête : nom du site, utilisateur, Badge rôle, Déconnexion (AlertDialog + toast « Vous avez été déconnecté. »). Pied : « Voir le site public ». Compteurs en échec → pas de badge, pas de toast |
| `/admin` | `GET /api/admin/dashboard` (SA, AF) ; EMPLOYE aucun appel | Squelette ; erreur + « Réessayer ». SA : table 7 sites (pastille accent, nom, Badge `statutSite`, messages nouveaux, clients). AF : sa ligne. « Derniers messages » (5) → `/admin/messages?statut=NOUVEAU`. Vide : « Aucun message reçu pour l'instant. » |
| `/admin/messages` | `GET /api/admin/messages` (URL : `site,type,statut,q,page`) | Squelette 3 articles. Vide filtré : « Aucun message ne correspond à ces filtres. » + « Réinitialiser ». Vide : « Aucun message. » Erreur + « Réessayer ». Article : sujet, nom · courriel · téléphone · entreprise · site · origine, Badge statut, message (`whitespace-pre-line`, jamais `v-html`), `dl` des `champs`, suggestion (produit, pays), Select statut, « Ajouter aux clients », « Supprimer », date/heure Québec |
| `/admin/clients` | `GET /api/admin/clients` (URL : `site,statut,q,page`) | Table ≥ md, liste empilée < md. « Ajouter un client » (Dialog). Modifier / Supprimer (AlertDialog). États comme Messages |
| `/admin/contenu/*` | inchangé | Dans le shell : retirer `min-h-svh`, fond et lien « ← Tableau de bord » ; onglets conservés |

## 2. Schéma

Aucune migration. `MessageContact` (statut, type, details), `Client` (`@@unique([companyId,email])`, `derniereInteraction`, `dateAjout`), `Company`. Écartés (accord utilisateur requis si besoin) : `MessageContact.archiveLe`, lien `Client ← MessageContact`, index trigramme.

## 3. API

Règles communes : `requireRole` → scoping → Prisma ; `select` explicite avec `uuid` (jamais `id`/`companyId`) ; `cache-control: no-store` ; `[uuid]` validé `z.string().uuid()` ; query `getValidatedQuery`, body `readValidatedBody` ; SA + AF, EMPLOYE → 403 ; lecture scopée `resolveReadScope(ctx, site)` (AF + site étranger → 403) ; ressource d'une autre filiale → `assertCompanyAccess` → 404 ; pagination offset `ADMIN_PAGE_SIZE = 20`, `count` + `findMany` en `prisma.$transaction([...])`, tri `[{createdAt:'desc'},{id:'desc'}]` (`dateAjout` pour clients) ; page hors bornes → `items: []` + vrai `total`.

| Route | Entrée | Succès | Erreurs |
|---|---|---|---|
| GET `/api/admin/messages` | `messagesQuerySchema` | 200 `AdminPage<AdminMessageDto>` | 400, 401, 403 |
| GET `/api/admin/messages/compteurs` | — | 200 `{ nouveaux }` scopé | 401, 403 |
| PATCH `/api/admin/messages/[uuid]` | `messageUpdateSchema` `{statut}` | 200 `AdminMessageDto` | 400, 404 |
| DELETE `/api/admin/messages/[uuid]` | — | 204 | 404 |
| POST `/api/admin/messages/[uuid]/client` | — | 201 `AdminClientDto` `{nom, email lowercase, telephone, entreprise, statut PROSPECT, notes: sujet, derniereInteraction: createdAt}`, filiale du message | 404 ; 409 « Ce contact figure déjà dans les clients. » (recherche insensible à la casse + repli P2002) |
| GET `/api/admin/clients` | `clientsQuerySchema` | 200 `AdminPage<AdminClientDto>` | 400, 403 |
| POST `/api/admin/clients` | `clientCreateSchema` ; filiale `resolveWriteCompany(ctx, site)` (SA sans `site` → 400 « Le site cible est requis ») | 201 | 400, 403, 409 « Ce courriel existe déjà pour cette filiale. » |
| PATCH `/api/admin/clients/[uuid]` | `clientUpdateSchema` (filiale immuable) | 200 | 400, 404, 409 |
| DELETE `/api/admin/clients/[uuid]` | — | 204 (cascade `DossierComptable`) | 404 |
| GET `/api/admin/dashboard` | — | 200 `AdminDashboardDto` (`groupBy` companyId → uuid/slug) | 401, 403 |

Recherche `q` : `OR` `contains` + `mode:'insensitive'` — messages : `nom, email, sujet, message, entreprise` ; clients : `nom, entreprise, email, telephone`. Pas d'`invalidatePublicPages()` (aucun contenu public).

Traduction `details` : `server/lib/admin/message-details.ts`, pure, testée. `champsDetails(details: unknown, type): { formulaire: ContactFormulaire | null; champs: ChampAffiche[] }`. Filiale : parcours `CONTACT_FORMS[slug].champs.filter(estChampDetail)` dans l'ordre ; `select` → libellé d'option (valeur brute si option retirée) ; `date-future` → date longue ; `entier` → `String` ; clé absente ou inconnue → ignorée. Assistant : `reponsesAssistantSchema.safeParse` → `recapReponses` → palier (libellé si config, sinon omis). `details` null/invalide → `{formulaire:null, champs:[]}`.

`server/api/admin/messages/index.get.ts` réécrit en handler fin sur `server/services/admin/messages.ts` (modèle `services/admin/sites.ts`).

## 4. Frontend

shadcn-vue copiés du registre `new-york-v4` (CLI en échec réseau) : `badge`, `table` (T0) ; `sidebar` + `sheet`, `tooltip`, `separator` (T2a).

T2a — shell et login :
- `app/layouts/admin.vue` : `SidebarProvider`, `AdminSidebar`, `AdminHeader`, `<slot/>` dans `<main>`, pied de page ; transition de page 0,2 s (opacité + y), off si `prefers-reduced-motion`.
- `AdminSidebar.vue` : items de `app/config/admin-nav.ts` `{ to; label | labelParRole; icon; roles: readonly AppRole[]; module?: ModuleKey; compteur?: 'messagesNouveaux' }`, filtrés par rôle et `sites[].modules`. Badge `NOUVEAU` sur Messages (`aria-label` « n messages non lus »). Cibles ≥ 44 px mobile.
- `AdminHeader.vue` : `SidebarTrigger`, nom du site, utilisateur, Badge `ROLE_LABELS[role]`, AlertDialog déconnexion.
- `useAdminShell.ts` : `useFetch` `/api/admin/sites` (clé `admin-sites`), compteurs (clé `admin-compteurs`), `refreshCompteurs()` via `refreshNuxtData('admin-compteurs')` ; EMPLOYE aucun appel. **Signature fixée** : `useAdminShell(): { sites: Readonly<Ref<readonly AdminSiteSummary[]>>; compteurs: Readonly<Ref<{nouveaux:number} | null>>; refreshCompteurs(): Promise<void> }`.
- `stores/auth.ts` : `logout()` try/catch + toast erreur. `login.vue` : écran scindé du prototype, VeeValidate + `loginSchema`, erreur inline, redirection si connecté. `contenu.vue` : `layout:'admin'`, chrome allégé. `middleware/admin.ts` inchangé sauf besoin.

T2b — pages :
- `index.vue`, `messages.vue`, `clients.vue` : `definePageMeta({ middleware:'admin', layout:'admin', roles })` (SA + AF pour messages/clients ; aucun pour index).
- `useAdminPagedList.ts` : `<TItem extends {uuid:string}, TQuery>({ endpoint, query })` → `{ items, total, page, pageCount, status, error, refresh }` ; `useFetch` `server:false`, watch query ; erreurs `toAdminError` sans toast ; 401 → login avec `redirect`.
- `useAdminListQuery.ts` : filtres ↔ `route.query`, validés zod (`safeParse`, repli défauts) ; changement de filtre → `page=1` ; recherche debounce 300 ms.
- `app/components/admin/` : `AdminPageHeader.vue`, `AdminListState.vue`, `AdminPagination.vue` (« 21–40 sur 57 »), `messages/MessagesFilters.vue`, `messages/MessageItem.vue`, `clients/ClientsFilters.vue`, `clients/ClientsTable.vue`.
- Formulaire client : `CmsFormDialog` + `app/config/admin-client-fields.ts` ; Select site seulement à la création par un SA (défaut : filtre, sinon 1er site).
- Suppression : `CmsDeleteDialog` ; client avec dossier : « Le dossier comptable associé sera aussi supprimé. » ; message : « Ce message sera définitivement supprimé. ».
- Toasts : « Statut mis à jour. », « {nom} a été ajouté aux clients. », `toast.info` sur 409 conversion, « Message supprimé. », « Client ajouté. », « Client mis à jour. », « Client supprimé. ». Erreurs via `toAdminError`. Après mutation message : `refresh()` + `refreshCompteurs()`.

## 5. Tâches (périmètres disjoints)

**T0 (avant T1/T2, S)** :
- `shared/types/admin.ts` (ajouts) : `AdminPage<T>`, `AdminSiteRef`, `StatutMessageDto`, `TypeMessageDto`, `StatutClientDto`, `ChampAffiche`, `AdminMessageDto`, `AdminClientDto`, `AdminDashboardDto` (champs : voir §3 et §4 ; `activite.type` extensible au lot 5).
- `shared/config/admin.ts` : `ADMIN_PAGE_SIZE = 20`, `ADMIN_SEARCH_MAX = 100`, `ADMIN_ACTIVITE_MAX = 5`, `STATUT_MESSAGE_LABELS`, `TYPE_MESSAGE_LABELS`, `ORIGINE_FORMULAIRE_LABELS` (holding « Site du groupe », filiales « Site de la filiale », suggestion, assistant), `STATUT_CLIENT_LABELS` (Prospect, Actif, Inactif), `ROLE_LABELS`, `CLIENT_TEXT_BOUNDS`. Imports relatifs.
- `shared/validation/admin.ts` : `messagesQuerySchema`, `clientsQuerySchema` (`.strict()`, `page` coerce 1..10000 défaut 1, `q` trim ≤ `ADMIN_SEARCH_MAX`, vide → undefined) ; `messageUpdateSchema` ; `clientCreateSchema` (`site?`, `nom` 1-120, `entreprise?` ≤ 160, `email` trim + lowercase + email ≤ 254 requis, `telephone?` = `telephoneContactSchema`, `statut` défaut PROSPECT, `notes?` ≤ 2000, texte optionnel vide → null) ; `clientUpdateSchema = exigerAuMoinsUnChamp(create.omit({site}).partial())`.
- `shared/validation/cms.ts` : exporter `exigerAuMoinsUnChamp`.
- `shared/utils/dates.ts` : `formatDateHeureQuebec`, `formatDateQuebec` (`timeZone: FUSEAU_QUEBEC`).
- `app/components/ui/{badge,table}/**`.

**T1 backend (M)** : `server/services/admin/{messages,clients,dashboard}.ts`, `server/lib/admin/message-details.ts`, `server/api/admin/messages/{index.get,compteurs.get,[uuid].patch,[uuid].delete}.ts`, `server/api/admin/messages/[uuid]/client.post.ts`, `server/api/admin/clients/{index.get,index.post,[uuid].patch,[uuid].delete}.ts`, `server/api/admin/dashboard.get.ts`, `tests/unit/{admin-validation,message-details}.test.ts`. Ne touche pas `shared/**`, `app/**`, `tests/e2e/**`, `scripts/**`.

**T2a frontend shell (M)** : `app/layouts/admin.vue`, `app/components/admin/{AdminSidebar,AdminHeader}.vue`, `app/config/admin-nav.ts`, `app/composables/useAdminShell.ts`, `app/components/ui/{sidebar,sheet,tooltip,separator}/**`, `app/pages/admin/{login,contenu}.vue`, `app/stores/auth.ts`, `app/middleware/admin.ts`.

**T2b frontend pages (L)** : `app/pages/admin/{index,messages,clients}.vue`, `app/components/admin/{AdminPageHeader,AdminListState,AdminPagination}.vue`, `app/components/admin/{messages,clients}/**`, `app/composables/{useAdminPagedList,useAdminListQuery}.ts`, `app/config/admin-client-fields.ts`, `tests/nuxt/use-admin-paged-list.nuxt.test.ts`. Importe `useAdminShell` (stub de même signature si T2a pas fini ; T2a l'écrase).

**T3 e2e (M)** : `tests/e2e/{admin-shell,admin-messages,admin-clients}.spec.ts`, fixture `tests/e2e/fixtures/admin-data.ts` (25 messages via Prisma + nettoyage), adaptation au format paginé de `tests/e2e/{contact,contact-filiales,ccdpaa-assistant}.spec.ts` et `scripts/api-check.mjs` (type `AdminMessageDto` importé de `#shared/types/admin`).

**T4 revue** : reviewer + ux-reviewer en parallèle, un build prod, captures 375/768/1440 des 4 routes, vidéos : déconnexion (AlertDialog + toast), Sheet mobile, Dialog client, transition de route.

## 6. Critères d'acceptation

1. `pnpm typecheck`, `pnpm test:unit` (schémas admin ; `champsDetails` pour 6 filiales + assistant + null + option retirée), `pnpm build:check` passent.
2. AF entretien : ne voit que entretien ; `?site=ccdpaa` → 403 ; PATCH/DELETE uuid ccdpaa → 404. EMPLOYE : APIs du lot → 403, `/admin/messages` → redirection `/admin`, aucun appel de données depuis `/admin`.
3. Aucune réponse avec `id`, `companyId` ni `details` brut (`api-check`).
4. Message transport : « Type de transport : Déménagement commercial », « Date souhaitée : 12 novembre 2026 ». Holding : origine « Site du groupe ». Suggestions via filtre `type`.
5. Changer le statut → toast, badge à jour, compteur sidebar décrémenté.
6. « Ajouter aux clients » → 201 puis 409 `toast.info`. Client en minuscules, PROSPECT, filiale du message.
7. Clients : doublon même filiale → 409 ; autre filiale → 201 ; AF + `site` étranger → 403 ; PATCH `{}` → 400 ; suppression avec dossier → avertissement cascade.
8. Pagination : 25 messages → 2 pages ; filtres et page survivent au rechargement et au retour.
9. Login : erreur inline accessible ; `?redirect=//evil` ignoré ; connecté sur `/admin/login` → `/admin`.
10. Aucun `alert`, `confirm`, `console.log`, `v-html`, dégradé, badge décoratif. AA. Cibles ≥ 44 px mobile.

## 7. Points d'attention

- Sécurité : `no-store` ; `q` jamais loggé (vérifier `server/plugins/error-handler.ts`) ; `statusMessage` générique ; filiale d'un client converti = celle du message, jamais du body.
- Performance : ILIKE sans index acceptable ≲ 10 000 lignes/table ; au-delà trigramme (migration) ou plein texte.
- Cas limites : `sujet` null → « Sans objet » ; `details` démo null ; option retirée → valeur brute ; page au-delà du total après suppression → dernière page ; session expirée → login + `redirect`.
- Non vérifié par l'architect : libellé du palier (`shared/content/ccdpaa/assistant-import-export.ts`), format de `details` dans `prisma/seed/demo.ts`.

## Points ouverts (défaut retenu)

| # | Question | Défaut |
|---|---|---|
| 1 | Ouvrir un message → EN_COURS automatiquement ? | Non, manuel (prototype) |
| 2 | Filiale d'un client modifiable ? | Non (immuable, lien `DossierComptable`) |
| 3 | Courriel client obligatoire ? | Oui à la création ; client existant sans courriel reste éditable |
| 4 | EMPLOYE au lot 4 | Shell sans module + « Aucun module disponible » ; `/admin/mon-planning` au lot 5 |
| 5 | Compteurs réservations/candidatures au tableau de bord | Exclus jusqu'au lot 5 ; DTO `activite` extensible |
| 6 | Profil / mot de passe (`/admin/parametres`, DEC-37) | Hors lot ; bloquant prod dans PROJECT_STATE |
| 7 | Transition de route du prototype | Portée (0,2 s), off si `prefers-reduced-motion` |
| 8 | Sidebar shadcn portée (4 composants) vs `aside` maison | Portage (fidélité prototype) |
