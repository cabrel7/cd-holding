# Lot 6 — Gestion des comptes, sessions et `actif` (spec)

Rédigée par l'architecte le 2026-10-12 (spec uniquement, aucun fichier code modifié). Même format que
`lot5-parametres.md` (sections 0–11, table D1…Dn, découpe T0→T4). Sources lues :
`CLAUDE.md`, `PROJECT_STATE.md:25,158,193-208` (journal paramètres 2026-10-11, D4/D11, décisions
ouvertes, « À faire »), `docs/specs/lot5-parametres.md` (§11 points ouverts 1/2/3/4), 
`lot5-placement.md`, `lot5-dossiers-comptables.md` (modèles de format), `CONVERSION_INVENTORY.md:87,148,707-709,724-735`
(DEC-37, E27, D10), `prisma/schema.prisma:14-23,135-198,380-398`, `server/utils/auth.ts:16-57`,
`server/api/auth/login.post.ts:18-66`, `server/utils/rate-limit.ts:83-106`,
`server/policies/site-access.ts:31-73`, `server/utils/site-scope.ts:118-133`,
`server/services/tasks.ts:1-40`, `server/tasks/anonymisation-loi25.ts`,
`shared/utils/roles.ts:3-12`, `shared/config/admin.ts`, `shared/validation/auth.ts`,
`shared/types/auth.d.ts:1-25`, `shared/config/sites.ts:5-17`, `shared/config/modules.ts`,
`app/config/admin-nav.ts:51-131`, `app/middleware/admin.ts:1-31`, `app/utils/admin-unauthorized.ts`,
`app/composables/useAdminPagedList.ts`, `prisma/seed/accounts.ts:1-67`,
`tests/e2e/helpers/{auth,db}.ts`, `scripts/cleanup-test-data.ts:62-66,465-609`,
`playwright.config.ts:44-58`, `tests/unit/admin-nav.test.ts`, `prototype_react/cd-holding-nexus/src/components/admin/AdminSidebar.tsx:36-58`
+ liste des routes `prototype_react/cd-holding-nexus/src/routes/` (aucune `admin.utilisateurs`),
`PROJECT_CONTEXT.md` §5 (rôles/permissions), `nuxt.config.ts:14,113-121`,
`node_modules/nuxt-auth-utils/dist/runtime/server/{api,utils}` (sémantique de session réelle).

## 0. Résumé, périmètre, routes

Ce lot livre le **dernier bloquant production restant hors conversion** : **D10 / DEC-37 — gestion des
comptes** (`/admin/utilisateurs`), plus les deux mitigations de sécurité qui l'accompagnent et qui sont
dans le même chantier (`PROJECT_STATE.md:158,208`) : **invalidation paresseuse des sessions**
(`User.passwordChangedAt`, fermeture du point ouvert 1 de `lot5-parametres.md` §11) et **enforcement
global de `actif`** (extension du D11 du sous-lot paramètres à toutes les routes `/api/admin/**`).

Prototype : **absent** — ni route `admin.utilisateurs.tsx`, ni item « Utilisateurs » dans
`AdminSidebar.tsx:39-58` (la nav prototype finit sur « Paramètres »). `CONVERSION_INVENTORY.md:148`
confirme : « ni le prototype ni la checklist ne prévoient de gestion des comptes ». Le périmètre est
donc **proposé** (minimum cohérent avec le socle admin existant), §1.

| Page | API | Rôles |
|---|---|---|
| `/admin/utilisateurs` | `GET /api/admin/utilisateurs` | SUPER_ADMIN |
| idem + dialog « Nouveau compte » | `POST /api/admin/utilisateurs` | SUPER_ADMIN |
| idem + dialog « Modifier le compte » | `PATCH /api/admin/utilisateurs/[uuid]` | SUPER_ADMIN |
| idem + réinitialisation de mot de passe | `POST /api/admin/utilisateurs/[uuid]/mot-de-passe` | SUPER_ADMIN |
| — (transverse, toutes les routes admin) | garde dans `requireAuth` | 3 rôles |
| `/admin/parametres` (existant) | `POST /api/admin/profil/mot-de-passe` (modifié : bump de session) | 3 rôles |

- **Inclus** : migration `User.passwordChangedAt`, garde de session centralisée (`requireAuth`),
  enforcement `actif` + rôle/filiale de session, page et 4 routes de gestion des comptes, génération
  serveur du mot de passe temporaire affiché une fois, rate-limit dédié, seed inchangé, tests unitaires
  + e2e (desktop + mobile, build prod), captures 3 breakpoints.
- **Exclus (confirmés)** : mailer/courriel de réinitialisation (Q-10 — un reset n'envoie **rien**),
  expiration/historique de mot de passe, 2FA, politique de complexité élargie (Q-02), suppression
  définitive d'un compte (§1 D5), rattachement `User` ↔ `Employe` (§11 pt. 1), édition de l'email (§11
  pt. 3), délégation de gestion à `ADMIN_FILIALE` (§11 pt. 2), CRUD des employés, tâche planifiée
  (§1 D16), `.env(.example)`, seed, contenu public (aucun appel `invalidatePublicPages`).
- **1 migration** (rédigée ici, **exécutée par l'utilisateur** — décision 2026-09-29) :
  `prisma/migrations/<timestamp>_user_password_changed_at/`. Aucune autre écriture de schéma.

## 1. Décisions tranchées (et pourquoi)

| # | Question | Décision | Justification |
|---|---|---|---|
| D1 | Périmètre de l'écran (prototype muet) | **Liste + création + édition + reset**, **pas de suppression définitive** | Minimum cohérent avec le socle admin (listes paginées + dialogs du lot 4/5) et avec `CONVERSION_INVENTORY.md:709` (« sinon le produit dépend du seed pour tout nouvel employé »). La suppression est remplacée par `actif=false` (D5). |
| D2 | Qui a accès ? | **SUPER_ADMIN seul** : page + 4 routes (`requireRole([SUPER_ADMIN])`), item de nav SA uniquement. AF → 403 + item masqué ; EMPLOYE idem | `PROJECT_CONTEXT.md:53` borne l'AF à « son contenu et son module métier » — la gestion de comptes n'y figure pas ; `CONVERSION_INVENTORY.md:87` (DEC-37) dit explicitement « SUPER_ADMIN ». Une délégation AF (comptes de sa filiale) est un vrai produit en soi (qui crée ? qui promeut ?) : refusée par défaut, ouvrable sur demande client (§11 pt. 2). |
| D3 | Auto-gestion | **Toute mutation ciblant le propre compte est refusée (409)**, y compris le reset (« Utilisez la page Paramètres… ») | Un seul garde couvre auto-désactivation, auto-rétrogradation, auto-`SA→AF`, et supprime le cas « dernier SA = moi » (D4) pour l'acteur. Le propre mot de passe a déjà sa porte dédiée, avec bump de session (D10) : la laisser ouverte ici produirait un 401 auto-infligé si on oubliait le bump. |
| D4 | Anti-lockout du compte seedé | **409 si la cible est le dernier `SUPER_ADMIN` actif et que l'opération ferait passer les actifs SA à zéro** (`actif=false` ou rôle ≠ SA). Interdit aussi : supprimer (jamais) / se supprimer (jamais) | `prisma/seed/accounts.ts:26-33` upserte en `update: {}` : le seed ne répare **jamais** un compte désactivé ni un hash changé — sans garde, un clic peut rendre le dépôt ingérable (verrouillage prod total). Logique **pure** (testée en unit) ; e2e ne peut pas fabriquer un « dernier SA » sans muter le seed (§8). |
| D5 | Suppression définitive | **Non retenue** — désactivation (`actif`) seule | Aucune entité ne référence `User` comme auteur (pas d'historique « qui a fait quoi »), `Employe.userId` passe en `SetNull` (`schema.prisma:386`) et la suppression perdrait le rattachement `mon-planning`. `actif` existe déjà, est vérifié au login (`login.post.ts:45`) et sera vérifié à chaque requête (D8). Écart documenté §11 pt. 4. |
| D6 | Champs éditables | **`nom`, `role`, `site` (filiale), `actif`**. **Email immuable** après création ; `passwordHash` n'est écrit que par les deux routes de mot de passe | Le brief énumère « nom, rôle, filiale, actif ». L'email est l'identifiant de connexion unique (`schema.prisma:185`) : le rendre éditable ajoute un cas « je me suis trompé de touche » avec risque d'erreur de saisie sur l'identifiant — un compte se recrée et l'ancien se désactive. Point ouvert §11 pt. 3 si besoin réel. |
| D7 | Rattachement | **`role = SUPER_ADMIN` ⇒ `companyId` null (forcé)** ; `ADMIN_FILIALE`/`EMPLOYE` ⇒ filiale **obligatoire** parmi `FILIALE_SLUGS` (`sites.ts:7`) — **jamais la holding** | `companyScope` (`auth.ts:42-48`) ignore déjà `companyId` pour un SA : le laisser rempli créait une donnée affichée/fausse (« Filiale rattachée » sur Paramètres). Une holding n'est pas une filiale au sens §5 de `PROJECT_CONTEXT.md` : pas d'AF de holding. |
| D8 | Où vivent les contrôles `actif` / session ? | **Un seul point : `requireAuth`** (`server/utils/auth.ts:16`) — une requête Prisma PK, puis évaluation pure. `requireRole` et `requireModule` héritent automatiquement | Les 64 routes `/api/admin/**` passent **toutes** par `requireRole` (14 directs, 25 `requireModule`, 25 via les factories CMS/sites : `cms-collection.ts:98-160`, `services/cms/sections.ts:26,53`, `services/admin/sites.ts:141-164`) + `server/api/files/[key].get.ts:28` (`requireAuth` direct, PRIVE). Contrôle « dans chaque route » = oubli quasi certain ; plugin Nitro = doublon de la logique de session. Le contrôle est **avant** toute requête métier. |
| D9 | Sémantique exacte de l'invalidation | Voir §2 : **session invalide si `passwordChangedAt` existe ET `passwordChangedAt > loggedInAt`** ; `passwordChangedAt IS NULL` ⇒ session valable (`loggedInAt` **existe déjà**, `login.post.ts:62`) | Aucune claim à ajouter, aucune session existante à migrer : au déploiement, toutes les sessions ont `passwordChangedAt = null` → **personne n'est déconnecté** (grandfathering). La comparaison est faite en millisecondes epoch (JS), pas en SQL. |
| D10 | Changement de mot de passe **par soi** | **Écrit `passwordChangedAt` puis rebombe `loggedInAt` (setUserSession) dans la même requête** : les **autres** sessions meurent, la session courante survit | Sans le bump, le critère d'acceptation du lot 5 (`lot5-parametres.md` §10.5 « session courante intacte » + e2e ligne 429) deviendrait un 401 auto-infligé. Ordre strict : update DB **puis** bump (garantit `loggedInAt >= passwordChangedAt`, égalité au même ms = valable). |
| D11 | Reset **par un admin** déclenche-t-il la même invalidation ? | **Oui** : même colonne, même règle. Toute session de la cible (y compris ses onglets ouverts) reçoit 401 au prochain appel API | C'est l'objectif même d'un reset (session volée / mdp partagé). Pas de chemin parallèle : une seule horloge. |
| D12 | Enforcement `actif` : étendre aussi le rôle/filiale de session ? | **Oui** — le garde compare `session.user.role ↔ compte.role` et `session.secure.companyId ↔ compte.companyId` | Une rétrogradation/passement aujourd'hui reste sans effet jusqu'à l'expiration du cookie (`SESSION_MAX_AGE_SECONDS = 8 h`, `nuxt.config.ts:14`) : les frontières de D2 deviendraient inopérantes pendant 8 h. Même requête que D8 → coût nul additionnel. Effet collatéral voulu : rétrograder/passer quelqu'un le **déconnecte** (à documenter à l'UI). |
| D13 | Côté UI (middleware) ? | **Aucun contrôle DB côté client** : `app/middleware/admin.ts` **inchangé**. Le 401 API déclenche `watchAdminUnauthorized` → session + cache `admin-*` vidés → `/admin/login` | Le middleware ne protège pas les données (son commentaire le dit déjà) et n'a aucun accès Prisma côté SPA. Limite assumée : un compte désactivé voit le shell jusqu'au premier appel API, qui part immédiatement (chaque page admin en fait un). |
| D14 | Mode d'obtention du nouveau mot de passe (pas de mailer) | **Généré côté serveur** (16 caractères, alphabet sans ambiguïté), haché immédiatement, **renvoyé une seule fois** dans la réponse (201/200, `no-store`), jamais stocké en clair, jamais journalisé, jamais relisible ; l'admin le communique **hors plateforme** | Q-10 non livré : envoyer un courriel est impossible. Alternative rejetée « mot de passe choisi par l'admin » : il connaîtrait alors le secret de façon permanente (et pourrait le réutiliser). Alternative rejetée « lien de réinitialisation » : jeton + mailer = deux dépendances absentes. Le reset ultérieur **regénère** (l'ancien devient invalide). |
| D15 | Rate-limit des mutations de comptes | Scope dédié **`admin-comptes`, 10 / 15 min**, clé = **IP + `secure.userId`** (nouveau paramètre optionnel `cle` de `assertRateLimit`, `resetRateLimit` symétrique), `resetRateLimit` au succès ; appliqué aux 3 mutations (POST/PATCH/reset), après `requireRole` (ordre du D7 du lot 5) | Toute la surface est réservée à un SA : pas de force brute, mais une session volée ou un script doit être borné. La clé composée évite qu'un NAT de bureau (plusieurs admins) partage un quota unique, tout en bornant chaque session. Le limiteur IP seul (`rate-limit.ts:83`) serait partagé entre les passes desktop/mobile e2e : IP fraîches par requête (précédent `nextTestIp`). |
| D16 | Tâche planifiée ? | **Aucune** | Contrairement à `anonymisation-loi25` (dette de données), il n'y a rien à purger : les sessions expirent par `maxAge` 8 h, les comptes n'ont pas d'expiration. |
| D17 | Entrées/sorties | UUID uniquement côté client, `select` Prisma explicite (jamais `id`/`companyId`/`passwordHash`), `cache-control: no-store` sur les 4 routes, zéro `console.log`/`alert`, `statusMessage` génériques affichables | CLAUDE.md (identifiants, erreurs, logs sans PII). Le mot de passe temporaire ne transite **que** dans le corps de sa propre réponse. |
| D18 | Type de colonne | `passwordChangedAt DateTime?` → **`TIMESTAMP(3)`**, même famille que `createdAt`/`updatedAt` de la table | Prisma mappe `DateTime` sur `timestamp(3)` dans ce projet (migration `init`) ; un `@db.Timestamptz` introduirait une famille hétérogène pour une valeur lue/comparée **en JS** (epoch ms). Cohérence du schéma > gain théorique. |

## 2. Règles session & mot de passe

### 2.1 État réel de la session (vérifié dans le code, pas supposé)

- Cookie scellé h3 (`nuxt-auth-utils 0.5.30`, `runtime/server/utils/session.js`), `maxAge` 8 h
  (`nuxt.config.ts:14`), `sameSite: strict` (`nuxt.config.ts:119`), aucun store serveur.
- Claims actuelles : `user { uuid, nom, role, companyUuid }` (client-visible), `secure { userId,
  companyId }` (**retiré** de la réponse `/api/_auth/session` — `session.get.js` : `const { secure,
  ...data } = session`), **`loggedInAt: number` (epoch ms) déjà posée au login** (`login.post.ts:62`,
  typée `shared/types/auth.d.ts:14`).
- **Aucune claim à ajouter.** La session ne contient ni `passwordHash` ni `passwordChangedAt`.

### 2.2 Règle d'invalidation paresseuse (D8/D9)

```ts
// server/lib/session-guard.ts — FONCTION PURE (pas de prisma, pas de createError) :
type EchecSession = 'compte-introuvable' | 'compte-inactif' | 'role-modifie' | 'filiale-modifiee' | 'mot-de-passe-change'
// entrées : loggedInAt: number | undefined, session { role, companyId }, compte | null
//   compte === null                        → 'compte-introuvable'
//   !compte.actif                          → 'compte-inactif'
//   compte.role !== session.role           → 'role-modifie'
//   compte.companyId !== session.companyId → 'filiale-modifiee'
//   compte.passwordChangedAt != null
//     && compte.passwordChangedAt > loggedInAt → 'mot-de-passe-change'   // strict ; égalité = valable
//   sinon                                  → { ok: true }
```

- `requireAuth` : `requireUserSession` → garde `secure` (existant) → **`prisma.user.findUnique({ where:
  { id: secure.userId }, select: { actif, role, companyId, passwordChangedAt } })`** → `evaluerSession`
  → tout échec = **401 `statusMessage: 'Session invalide, veuillez vous reconnecter'`** (message unique,
  aucun détail de structure ; le motif reste dans la fonction pure, testé en unit).
- Session **sans** `loggedInAt` (théoriquement impossible : le login la pose toujours) = `undefined` →
  valable **seulement si `passwordChangedAt` est null**, sinon 401 (prudent, jamais de session « sans
  date » promue au-dessus d'un mdp changé).
- **Compatibilité au déploiement** : colonne `null` partout → toutes les sessions existantes restent
  valables (aucune déconnexion massive). Aucun « re-login forcé » à la mise en production.
- **Portée exacte impactée** (liste exhaustive, vérifiée) :
  - `server/api/admin/**` : **64 routes** (14 avec `requireRole` direct, 25 via `requireModule`,
    22 CMS via `cms-collection.ts`/`services/cms/sections.ts`, 3 `sites` via `services/admin/sites.ts`)
    — toutes héritent du garde par `requireRole`.
  - `server/api/files/[key].get.ts:28` : `requireAuth` **uniquement** pour les fichiers `PRIVE` —
    les images publiques (ISR, sites statiques) ne passent jamais par là.
  - **Non impactés** : `server/api/auth/**` (login/logout/me), `server/api/public/**` (13 routes),
    rendus de pages, ISR, `app/middleware/admin.ts` (D13), `nuxt-security`.
- **Coût** : 1 lookup par PK et par requête authentifiée, seulement **après** validation du cookie
  (un requêteur sans session échoue avant toute lecture DB).

### 2.3 Écritures de `passwordChangedAt`

| Action | Écrit | Rebombe `loggedInAt` | Effet |
|---|---|---|---|
| Changement de mdp **par soi** (`POST /api/admin/profil/mot-de-passe`) | `Oui` (service `enregistrerMotDePasse`) | **Oui** (`setUserSession(event, { loggedInAt: Date.now() })` après l'update) | Session courante OK, toutes les autres 401 |
| Reset **par un admin** (D11) | `Oui` (service `reinitialiserMotDePasse`) | Non (la cible n'est pas l'acteur) | Toutes les sessions de la cible → 401 |
| Création d'un compte | Non (`null`) | — | Aucune session existante |
| Édition (`nom`/`role`/`site`/`actif`) | Non | Non | `actif`/rôle/filiale sont couverts par le garde (D8/D12) |
| Login | Non | pose `loggedInAt = Date.now()` (existant) | — |

- Le contrôle `actif` **dupliqué** dans `server/api/admin/profil/mot-de-passe.post.ts:29-32` devient
  redondant (le garde central le fait, en amont) : retiré au profit d'une seule source ; la lecture de
  `passwordHash` (« compte absent → 401 ») reste défensive.
- **Ordre imposé dans la route profil** : `verifyPassword` → `hashPassword` → update (`passwordHash` +
  `passwordChangedAt`) → `setUserSession` (bump) → `resetRateLimit` → 200 `no-store`.
- **Sémantique vérifiée** de `setUserSession` (`nuxt-auth-utils/dist/runtime/server/utils/session.js:13-17`)
  : `session.update(defu(data, session.data))` — **fusion, pas remplacement** : poser
  `{ loggedInAt: Date.now() }` conserve `user` et `secure` intacts. Ne jamais utiliser
  `replaceUserSession` ici (il efface la session).
- `User.updatedAt` n'est **pas** utilisé comme horloge de mdp (auto-bumpé par toute écriture —
  `lot5-parametres.md` §11).

### 2.4 Mots de passe

- Règle inchangée : `PASSWORD_MIN_LENGTH = 8`, pas d'historique/expiration/2FA (Q-02 ouverte, §11 pt. 5).
- Hash : `hashPassword()`/`verifyPassword()` (`#auth-utils`) **uniquement dans les routes** (le service
  reste importable par vitest — règle du lot 5). Seed inchangé (`@adonisjs/hash`, driver identique).
- Mot de passe temporaire : `crypto.getRandomValues` (global Nitro/Node), 16 caractères sur un alphabet
  sans ambiguïté (`A-Z a-z 2-9`, ni `0/O/1/l/I`), toujours conforme à `passwordSchema`.
  **Jamais** de `console.log`/log de corps de requête ou de réponse (CLAUDE.md § Logs).

## 3. API — routes Nitro (`server/api/admin/utilisateurs/`)

Constantes communes : `ROLES_COMPTES = [ROLES.SUPER_ADMIN]`, `paramsSchema = z.object({ uuid:
z.string().uuid() })` (malformé → **400**, jamais 500), `MAX_BODY_BYTES = 4 * 1024` (413 avant lecture,
copie de `login.post.ts:21-24`), `cache-control: no-store` sur les 4 réponses, rate-limit
`{ scope: 'admin-comptes', max: 10, windowMs: 15 min, cle: String(secure.userId) }` sur les 3 mutations
(D15), `resetRateLimit(event, 'admin-comptes', cle)` au succès.

| Route | Entrée | Succès | Erreurs |
|---|---|---|---|
| `GET /api/admin/utilisateurs` | `utilisateursQuerySchema` `.strict()` `{ role?, actif?, q?, page? }` | 200 `AdminPage<AdminCompteDto>` | 401 (garde), 403 (hors SA), 400 (zod) |
| `POST /api/admin/utilisateurs` | `utilisateurCreateSchema` `.strict()` `{ nom, email, role, site? }` | **201** `{ compte, motDePasseTemporaire }` | 400 (zod : nom/email/role, `site` manquant hors SA, `site` fourni pour SA), 403, 409 (`Un compte existe déjà avec cet email.`), 413, 429 |
| `PATCH /api/admin/utilisateurs/[uuid]` | `utilisateurUpdateSchema` `.strict()` `{ nom?, role?, site?, actif? }` (≥1 clé) | 200 `AdminCompteDto` | 400 (zod + cohérence du résultat fusionné), 403, 404 `Introuvable`, **409** `Impossible de modifier votre propre compte.` / `Impossible de désactiver le dernier compte super administrateur.` (pas d'erreur email : immuable, D6), 413, 429 |
| `POST /api/admin/utilisateurs/[uuid]/mot-de-passe` | corps **vide strict** `z.object({}).strict()` | 200 `{ motDePasseTemporaire }` | 400 (clé inconnue dans le corps), 403, 404, **409** `Utilisez la page Paramètres pour modifier votre propre mot de passe.`, 413, 429 |

Orchestration (identique pour les 3 mutations, ordre du D7 du lot 5 — le rate-limit frappe **avant**
toute validation d'entrée) :
`requireRole(SA)` → `assertRateLimit(admin-comptes)` → params zod (uuid) → garde 4 Ko →
`readValidatedBody` → génération + `hashPassword` (création/reset) → service → **`resetRateLimit` sur
les 3 mutations** → réponse.

Règles servies par le service (fusion après chargement de la cible, D6/D7) :
`roleResultant = body.role ?? cible.role` ; si `SUPER_ADMIN` → `companyId = null` (et `site` fourni ⇒
400 `Un super administrateur n'est rattaché à aucune filiale.`) ; sinon `companyId = siteFourni ?
companyParSlug(site) : cible.companyId` ; encore `null` ⇒ 400 `Une filiale est requise pour ce rôle.` ;
`site` inconnu ou `holding` ⇒ 400 (enum `FILIALE_SLUGS`, rejetée par zod en amont).

Logs : aucun (l'error-handler ne journalise que les 5xx, sans PII) ; le corps (mot de passe
temporaire) n'est jamais journalisé.

## 4. Shared

- **`shared/validation/utilisateurs.ts`** (CRÉER, imports relatifs + zod explicite — importable par tsx) :
  `utilisateursQuerySchema` (`page` coerce default 1, `q` trimé `ADMIN_SEARCH_MAX`, `role` enum `Role`
  optionnel, `actif` enum `['true','false']` optionnel), `utilisateurCreateSchema` `.strict()`
  (`nom` `UTILISATEUR_TEXT_BOUNDS.nom`, `email` `emailSchema` — trim/lowercase, `role` enum, `site`
  = `z.enum(FILIALE_SLUGS)` **locale au fichier** — `siteSlugSchema` existe déjà mais accepte la
  holding, `sites.ts:14`) **+ `superRefine` : `role === SUPER_ADMIN && site !== undefined` ⇒ issue
  `path: ['site']`, et `role !== SUPER_ADMIN && site === undefined` ⇒ issue `path: ['site']`**,
  `utilisateurUpdateSchema` `.strict()` partiel **≥ 1 clé** (`exigerAuMoinsUnChamp`, précédent
  `validation/admin.ts:57`) + issue si `role: SUPER_ADMIN` **et** `site` fournis (l'autre moitié de la
  règle dépend de l'état fusionné → service, §3), `resetMotDePasseSchema = z.object({}).strict()`,
  types `UtilisateurCreateInput` / `UtilisateurUpdateInput`.
- **`shared/types/admin.ts`** (MODIF) : `AdminCompteDto { readonly uuid; nom; email; role: AppRole;
  actif: boolean; company: { readonly uuid; readonly nom; readonly slug: FilialeSlug } | null }`
  (miroir de `AdminProfilDto:313` + `slug` pour pré-remplir le form ; `company: null` = SA, D7).
  La liste réutilise `AdminPage<AdminCompteDto>` existant.
- **`shared/config/admin.ts`** (MODIF) : `UTILISATEUR_TEXT_BOUNDS = { nom: { min: 2, max: 120 }, email:
  { max: 254 } }`, `STATUT_COMPTE_LABELS = { actif: 'Actif', inactif: 'Inactif' }` (badge = vrai statut,
  autorisé). `ROLE_LABELS:48-52` fournit déjà les libellés de rôle.
- `passwordSchema` / `PASSWORD_MIN_LENGTH` : **inchangés** (`shared/validation/auth.ts`).
- Aucun changement de `shared/utils/roles.ts`, `shared/config/sites.ts`, `shared/config/modules.ts`.

## 5. Frontend

- **Page** `app/pages/admin/utilisateurs.vue` (SA seul) :
  - `definePageMeta({ middleware: 'admin', layout: 'admin', roles: [ROLES.SUPER_ADMIN] })` (le
    middleware renvoie un AF sur `/admin`, `middleware/admin.ts:27-30`) ; `useHead({ title:
    'Utilisateurs — Administration' })` ; `AdminPageHeader titre="Utilisateurs"` description «
    Gérez les comptes de la console : nom, rôle, filiale et mot de passe. »
  - `useAdminListQuery(utilisateursQuerySchema, ['role', 'actif', 'q', 'page'])` + `useAdminPagedList`
    (`endpoint: '/api/admin/utilisateurs'`) — pagination serveur `ADMIN_PAGE_SIZE`, comme les 6 listes
    existantes.
  - Composants : `CompteFilters` (`AdminSearchInput` + `AdminFilterSelect` rôle « Tous/Super
    administrateur/Administrateur de filiale/Employé » + `AdminFilterSelect` statut « Tous/Actifs/
    Inactifs »), `ComptesList` (Nom, Courriel, Rôle en `Badge variant="secondary"` + `ROLE_LABELS`,
    Filiale (`company.nom` ; `null` → « Aucune (accès groupe entier) »), Statut en badge
    `STATUT_COMPTE_LABELS`, actions « Modifier » / « Réinitialiser le mot de passe » / « Désactiver »
    — « Réactiver » si `actif = false`, toutes ≥ 44 px), `AdminPagination`, `AdminListState`.
  - Bouton « Nouveau compte » (`Plus`) → `CompteFormDialog` (VeeValidate + `toTypedSchema`), champs :
    Nom, Courriel, Rôle (select `ROLE_LABELS`), Filiale (select des 6 `FILIALE_SLUGS`, **masqué si
    rôle = SA**, obligatoire sinon). Fermeture **seulement après succès**.
  - `MotDePasseTemporaireDialog` (commun création **et** reset) : champ `type="password"` readonly +
    bascule Eye/EyeOff, bouton « Copier le mot de passe » (`navigator.clipboard`, indisponible ⇒ le
    champ reste sélectionnable à la main, aucun blocage), texte « Ce mot de passe ne sera plus affiché.
    Communiquez-le à l'utilisateur en dehors de la plateforme. », action « Fermer ». Il s'ouvre **après**
    le 201/200 (jamais avant) et affiche la valeur retournée une seule fois.
  - Désactivation : `AlertDialog` (« Désactiver ce compte ? » / « Ce compte ne pourra plus se connecter
    et ses sessions seront fermées. ») — jamais `confirm()`.
  - **`useCompteActions`** (miroir `useClientActions.ts`) : `submitting`, `emailError` (409 → sous le
    champ courriel, dialog ouvert), succès → `toast.success` puis rechargement de la liste, 401 →
    `handleAdminUnauthorized()`, autres 4xx → `toast.error(toAdminError(e).message)` (les 409 « propre
    compte » / « dernier SA » s'affichent ainsi), 429 → libellé `MESSAGE_RATE_LIMIT_TENTATIVES`.
  - **Nav** `app/config/admin-nav.ts` : 1 item **transversal** (ni module, ni site), `roles:
    [ROLES.SUPER_ADMIN]`, `icon: Users` (`@lucide/vue`, usage fonctionnel), `label: 'Utilisateurs'`,
    `to: '/admin/utilisateurs'`, positionné **immédiatement avant `Paramètres`** (dernier du bloc de
    gestion ; `Paramètres` reste le dernier item — assertion `admin-nav.test.ts:31` préservée).
  - Design : socle navy/or, aucun dégradé, aucun emoji, aucune carte générique, cibles ≥ 44 px sous md,
    375 px sans scroll horizontal (dialogs inclus).

## 6. Services

- **`server/lib/session-guard.ts`** (CRÉER) — pur, sans `prisma` ni `createError` : `evaluerSession(...)`
  (§2.2) + type `EchecSession`. Importé par `server/utils/auth.ts` (import relatif explicite).
- **`server/lib/admin/comptes.ts`** (CRÉER) — pur, renvoie des **codes** (la route/service traduit en
  HTTP) : `verifierAutoModification(uuidCible, uuidSession)` → code `compte-propre`,
  `verifierDernierSuperAdmin(cible, nbAutresSuperAdminsActifs)` → code `dernier-super-admin`,
  `resoudreRattachement(roleResultant, site, companyIdActuel)` → `{ companyId }` ou code `site-requis`
  / `site-inattendu`, `toCompteDto(row)` (**pick explicite** des 6 champs, miroir `toProfilDto`).
  Les codes deviennent 409 / 400 dans le service (§3).
- **`server/services/admin/utilisateurs.ts`** (CRÉER) — IO uniquement, aucun `#auth-utils` :
  `COMPTES_SELECT` (`uuid, nom, email, role, actif, company { uuid, nom, slug }` — jamais `id`,
  `companyId`, `passwordHash`, `passwordChangedAt`), `listComptes(query)` (prisma `where` combiné :
  `role`, `actif`, `q` → `OR [{ nom: contains insens } { email: contains insens }]`, tri
  `[{ nom: 'asc' }, { email: 'asc' }]`, `count` + `pageArgs`/`buildPage` depuis
  `server/lib/admin/pagination.ts`), `creerCompte(data, passwordHash)` (pré-existence email → `409`, P2002
  → `409`), `modifierCompte(uuid, data)` (auto-garde, dernier SA via `count({ role: SUPER_ADMIN, actif:
  true, id: { not: cible.id } })`, rattachement fusionné, P2002 → `409`), `reinitialiserMotDePasse(uuid,
  hash)` (auto-garde + `passwordChangedAt: new Date()`).
- **`server/services/admin/profil.ts`** (MODIF) : `enregistrerMotDePasse` écrit `passwordHash` **et**
  `passwordChangedAt: new Date()` (D10) ; `lireComptePourMotDePasse` perd le champ `actif` devenu
  redondant (D8).
- **`server/utils/auth.ts`** (MODIF) : `requireAuth` = session → garde `secure` → lookup → `evaluerSession`
  → 401. `requireRole`, `companyScope`, `assertCompanyAccess` **inchangés**.
- **`server/utils/rate-limit.ts`** (MODIF) : `RateLimitOptions.cle?: string` → clé `${scope}:${ip}:${cle}`
  via un helper pur `rateLimitKey(scope, ip, cle?)` (exporté, testé), `resetRateLimit(event, scope, cle?)`
  symétrique. Aucun autre appelant impacté (paramètre absent ⇒ comportement identique).
- **Aucune tâche planifiée, aucun plugin, aucun changement de `nuxt.config.ts`/`.env`.**

## 7. Tests unitaires

- **`tests/unit/session-guard.test.ts`** (CRÉER) — `evaluerSession` : compte `null` → `compte-introuvable`
  ; `actif: false` → `compte-inactif` ; rôle modifié → `role-modifie` ; `companyId` différent (dont `null`
  ↔ valeur) → `filiale-modifiee` ; `passwordChangedAt` **strictement postérieur** → `mot-de-passe-change`
  ; **égalité au même ms → ok** ; `passwordChangedAt: null` → ok (grandfathering) ; `loggedInAt`
  absent + colonne renseignée → 401 ; nominal → ok.
- **`tests/unit/comptes.test.ts`** (CRÉER) — `toCompteDto` : clés exactes, `company: null` vs présente,
  une row « sale » (`id`, `companyId`, `passwordHash`, `passwordChangedAt`) qui ne transite pas ;
  `verifierAutoModification` (soi → refus, un tiers → ok) ; `verifierDernierSuperAdmin` (dernier →
  refus, un second actif → ok, désactivation d'un tiers hors SA → ok) ; `resoudreRattachement`
  (SA + site → erreur, SA sans site → null, AF sans site → erreur, AF avec site → id).
- **`tests/unit/utilisateurs-validation.test.ts`** (CRÉER) — query `.strict()` + `page` default +
  `actif` enum ; create : `.strict()` (clé inconnue), `email` normalisé, `role` invalide, `site` manquant
  hors SA → `path: ['site']`, `site` fourni pour SA → `path: ['site']`, `site: 'holding'` → échec,
  `nom` hors bornes ; update : `.strict()`, corps vide → échec (`exigerAuMoinsUnChamp`), un seul champ →
  ok, `role: SUPER_ADMIN` + `site` → `path: ['site']`, et **le schéma serveur accepte `role: EMPLOYE`
  sans `site`** (c'est le service qui tranche sur l'état fusionné — verrouille la répartition).
- **`tests/unit/rate-limit.test.ts`** (MODIF) — `rateLimitKey` : sans `cle` égal à l'ancienne clé
  `${scope}:${ip}` (régression de tous les appelants existants), avec `cle` → `${scope}:${ip}:${cle}`.
- **`tests/unit/admin-nav.test.ts`** (MODIF) — l'`it.each([SUPER_ADMIN, ADMIN_FILIALE])` de :15 devient
  **2 tests distincts** : SA → liste + `/admin/utilisateurs` avant `/admin/parametres` ; AF → sans
  l'item ; nouveau test « item Utilisateurs : SA seul, transversal (ni module ni site), `Paramètres`
  toujours dernier ».

## 8. E2E — `tests/e2e/admin-utilisateurs.spec.ts` (build prod, desktop + mobile)

Isolation (précédent `semerCompteMdp`) : `beforeAll` → `semerComptes(marker)` crée **3 comptes** :
`comptes-emp-<m>@example.test` (EMPLOYE, filiale `entretien`), `comptes-af-<m>@example.test`
(ADMIN_FILIALE, filiale `transport`), `comptes-sa-<m>@example.test` (SUPER_ADMIN, `company: null`) —
mots de passe **générés** remontés en JSON (`COMPTES_MDP_JSON=`) ; `afterAll` → `purgerComptes(marker)`
+ `purgerCompte(<email créé par un test via l'API>)`. **Aucun test ne cible `admin@groupecd.ca` ni les
comptes seedés AF/EMPLOYE** (muter un seed casserait les autres specs). Chaque test qui
désactive/rétrograde **restaure** l'état avant de finir (échec entre les deux = compte inactif pour la
suite). Toute requête de mutation (POST/PATCH) porte `x-forwarded-for:
nextTestIp()` + helper résilient (retry IP fraîche sur 429) ; le test 429, lui, garde **sa** IP pour
observer son quota. Les tests UI posent `page.setExtraHTTPHeaders` avant login (pattern
`admin-shell.spec.ts:15`). Helpers : `apiAs`, `loginAs`, `clesInterdites`, `AdminShell`.

1. **401 sans session** sur les 4 routes (GET/POST/PATCH/reset), `statusMessage` jamais technique.
2. **403 hors SA** : AF seed et EMPLOYE seed sur les 4 routes ; côté UI, aucun lien « Utilisateurs »
   dans la nav.
3. **GET liste** : 200, clés exactes par item (aucun `id`/`companyId`/`passwordHash`/
   `passwordChangedAt`), `clesInterdites` vide, `no-store`, tri `nom`, pagination (`page/pageSize/
   pageCount/total`), filtres `role`/`actif`/`q`, `company: null` pour un SA.
4. **POST 400** : nom manquant, email invalide, rôle invalide, `site` manquant pour EMPLOYE, `site`
   fourni pour SA, `site: 'holding'`, clé inconnue (`.strict()`).
5. **POST 409** email déjà utilisé (compte seed) → message exact sous le champ côté UI (test 16).
6. **POST 201 création** : réponse `{ compte, motDePasseTemporaire }` (longueur 16), login avec ce mdp
   → 200, login avec un mdp quelconque → 401 ; puis création d'un 2ᵉ compte **SA** via l'API
   (`comptes-nouveau-sa-<m>@example.test`, `company: null` attendu dans la réponse). Les 2 emails
   (`comptes-nouveau-<m>@example.test` + `comptes-nouveau-sa-<m>@example.test`) sont purgés en
   `afterAll` via `purgerCompte(email)`.
7. **413** (corps > 4 Ko) et **429** : 11 `PATCH /api/admin/utilisateurs/pas-un-uuid` identiques
   depuis **la même IP** → `[400 ×10, 429]` (le quota frappe avant la validation de l'uuid, §3) +
   en-tête `Retry-After` numérique.
8. **PATCH 200** : `nom` ; `role` EMPLOYE → ADMIN_FILIALE (`site: 'transport'`) → **la session de la
   cible renvoie 401 au prochain appel** (D12) puis re-login → rôle ADMIN_FILIALE dans la session ;
   restauration du rôle en fin de test.
9. **PATCH gardes** : sur son **propre** uuid → 409 (message exact) ; uuid inconnu → 404 ; uuid
   malformé → 400 (jamais 500).
10. **Désactivation** : cible connectée (session active) → `actif=false` → cible 401 → login 401
    « Identifiants invalides » ; réactivation → login 200 (restauration). Désactivation du **SA seedé
    par `semerComptes`** → 200 (le compte seed `admin` reste actif : prouve que le garde D4 ne bloque
    pas tout) puis réactivation ; le cas « dernier SA » est couvert en unit (`comptes.test.ts`) — non
    reproductible ici sans muter le seed (§11 pt. 6).
11. **Reset** : cible connectée → reset → **session cible 401** (D11) → login ancien mdp 401 → login
    nouveau mdp (lu dans la réponse) 200 ; reset de **soi** → 409 (message Paramètres).
12. **UI création** (375 + 1440) : nav SA, bouton « Nouveau compte », validation cliente **sans requête
    réseau** (compteur POST = 0), succès → dialog « mot de passe temporaire » (copie fonctionnelle),
    toast, ligne visible dans la liste.
13. **UI conflit email** : 409 → erreur sous le champ courriel, dialog ouvert.
14. **UI édition** : dialog pré-rempli (rôle/filiale cohérents, filiale masquée si SA), changement →
    toast, badge mis à jour.
15. **UI désactivation/reset** : `AlertDialog` (jamais une alerte navigateur), toast, badge « Inactif »,
    dialog de reset ouvert seulement après succès.
16. **Mobile 375** : aucun scroll horizontal (liste + dialogs), cibles ≥ 44 px.
17. **Régressions au T4** : `admin-parametres.spec.ts` (**critique** : « changement de mdp → toujours
    connecté », §2.3), `admin-shell.spec.ts` (nav), `admin-clients.spec.ts` (401 watcher).

## 9. Découpe T0 → T4 (périmètres disjoints, fichiers exhaustifs)

- **T0 (fil principal — shared + unit)** : `shared/validation/utilisateurs.ts` (CRÉER),
  `shared/types/admin.ts` (MODIF : `AdminCompteDto`), `shared/config/admin.ts` (MODIF : 2 constantes),
  `tests/unit/utilisateurs-validation.test.ts` (CRÉER). Rien d'autre (ni `server/`, ni `app/`).
- **T1 (backend + migration)** : `prisma/schema.prisma` (MODIF : `passwordChangedAt DateTime?`),
  `prisma/migrations/20261012000000_user_password_changed_at/migration.sql` (CRÉER :
  `ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);` — **l'utilisateur exécute
  `pnpm db:deploy && pnpm db:generate`, puis vérifie `pnpm exec prisma migrate diff --from-migrations
  prisma/migrations --to-schema-datamodel prisma/schema.prisma` vide** ; déploiement du code seulement
  après la colonne, sinon erreur Prisma), `server/lib/session-guard.ts` (CRÉER),
  `server/lib/admin/comptes.ts` (CRÉER), `server/utils/auth.ts` (MODIF : `requireAuth`),
  `server/utils/rate-limit.ts` (MODIF : `cle` optionnelle), `server/services/admin/utilisateurs.ts`
  (CRÉER), `server/services/admin/profil.ts` (MODIF : `passwordChangedAt` + champ `actif` retiré),
  `server/api/admin/profil/mot-de-passe.post.ts` (MODIF : bump `loggedInAt`, contrôle redondant retiré),
  `server/api/admin/utilisateurs/index.get.ts`, `index.post.ts`, `[uuid].patch.ts`,
  `[uuid]/mot-de-passe.post.ts` (CRÉER), `tests/unit/session-guard.test.ts` (CRÉER),
  `tests/unit/comptes.test.ts` (CRÉER), `tests/unit/rate-limit.test.ts` (MODIF). Ne touche pas
  `app/**`, `shared/**`, `tests/e2e/**`, `scripts/**`, `playwright.config.ts`.
- **T2 (frontend)** : `app/pages/admin/utilisateurs.vue` (CRÉER),
  `app/components/admin/utilisateurs/ComptesList.vue`, `CompteFilters.vue`, `CompteFormDialog.vue`,
  `MotDePasseTemporaireDialog.vue`, `useCompteActions.ts` (CRÉER), `app/config/admin-nav.ts` (MODIF :
  1 item), `tests/unit/admin-nav.test.ts` (MODIF : assertions `it.each` cassées — corrigées **avec**
  l'item, pas après coup). Ne touche pas `server/**`, `shared/**`, `tests/e2e/**`, `scripts/**`.
- **T3 (e2e)** : `tests/e2e/admin-utilisateurs.spec.ts` (CRÉER), `scripts/cleanup-test-data.ts` (MODIF :
  options `--seed-comptes <m>` (3 comptes, hash `@adonisjs/hash`, imprint `COMPTES_MDP_JSON=`),
  `--purge-comptes <m>`, `--purge-compte <email>` + commentaire d'usage en tête), `tests/e2e/helpers/db.ts`
  (MODIF : wrappers `semerComptes` / `purgerComptes` / `purgerCompte`), `playwright.config.ts` (MODIF :
  `admin-utilisateurs` dans le `testMatch` mobile, `:56`). `tests/e2e/fixtures/admin-pages.ts` :
  **aucune modification** (`AdminShell`, `apiAs`, `clesInterdites` réutilisés).
- **T4 (vérification)** : `pnpm typecheck`, `pnpm test:unit` (poste : `--maxWorkers=2`), un **seul**
  `pnpm build:check`, e2e ciblé (utilisateurs + régressions paramètres/shell/clients) sur build prod,
  **une seule** passe de revue (reviewer + ux-reviewer en parallèle, correctifs groupés avant rebuild),
  captures 375/768/1440 (`conversion-captures/lot6-nuxt/` : liste + dialog création + dialog mot de
  passe temporaire au desktop ; **pas de vidéo** : aucun enchaînement chorégraphié nouveau au-delà des
  dialogs/toasts déjà filmés), mise à jour de `PROJECT_STATE.md` (nouvelle ligne checklist Holding
  `/admin/utilisateurs`, journal du lot, levée de « D10 » dans les lignes 25/208, décisions D4/D11
  refermées).

## 10. Critères d'acceptation

1. Migration appliquée par l'utilisateur (`pnpm db:deploy`) **avant** l'exécution du code T1 ;
   `migrate diff` vide ensuite ; `prisma migrate dev` futur ne propose aucun DROP de la colonne.
2. `typecheck`, `test:unit` (§7), `build:check` passent ; e2e vert desktop + mobile sur build prod.
3. Toute route `/api/admin/**` renvoie **401** pour un compte `actif = false` (y compris
   `/api/admin/dashboard` et un fichier `PRIVE`), avec le message de session générique ; **401** après
   un reset ou un changement de mot de passe par un tiers ; **401** si le rôle/filiale de la session ne
   correspond plus à la base. Login d'un compte désactivé → 401 « Identifiants invalides ».
4. Après un changement de mot de passe **par soi** : session courante **intacte** (régression
   `admin-parametres` verte), anciennes autres sessions → 401 au prochain appel.
5. Les sessions existantes au déploiement restent valides (colonne `null` → aucun re-login forcé).
6. `/admin/utilisateurs` : visible en nav **pour le SA seulement**, inaccessible (403 API + redirection
   middleware) pour AF et EMPLOYE ; 401 sans session.
7. Création : 201 + mot de passe temporaire affiché une fois et utilisable pour un login ; email
   dupliqué → 409 sous le champ ; `site`/rôle incohérents → 400.
8. Édition : nom/rôle/filiale/actif ; `SUPER_ADMIN` toujours `company: null` ; auto-modification →
   409 ; dernier SA actif non désactivable/rétrogradable ; uuid malformé → 400, inconnu → 404.
9. Reset : 200 + mot de passe temporaire, anciennes sessions de la cible → 401, ancien mdp → 401.
10. Aucun `id`/`companyId`/`passwordHash`/`passwordChangedAt` dans aucune réponse ; `no-store` sur les
    4 routes ; rate-limit `admin-comptes` avec `Retry-After` après 10 mutations (IP+utilisateur).
11. Aucun `alert`/`confirm`/`console.log`/`v-html`/dégradé/emoji ; badges = statuts réels (rôle,
    Actif/Inactif) ; cibles ≥ 44 px ; 375 px sans scroll horizontal.
12. Seed inchangé, `.env` inchangé, aucune écriture de contenu public (aucun `invalidatePublicPages`),
    aucune tâche planifiée ajoutée ; régressions `admin-parametres`, `admin-shell`, `admin-clients` vertes.

## 11. Risques, points de vigilance, points ouverts

- **Ordre migration → code** : déployer avant la colonne = erreur Prisma sur **chaque** requête
  authentifiée (le garde lit la colonne). Risque le plus couteux du lot → étape explicite en T1.
- **1 requête PK en plus / requête admin** : négligeable sur le VPS mono-process, mais c'est désormais
  un point de passage unique : une régression de `requireAuth` toucherait tout l'admin. Couvert par les
  e2e (401) de chaque module en régression.
- **Ordre des écritures (D10)** : oublier le bump `loggedInAt` = déconnexion immédiate de l'utilisateur
  après son propre changement (casse le critère 4 du §10) ; oublier `passwordChangedAt` = aucune
  invalidation. Les deux sont couverts par `admin-parametres` (régression) + le spec du lot 6.
- **e2e partagé** : les comptes de test sont créés/purgés par marqueur ; un échec entre « désactive » et
  « restaure » laisse un compte inactif → le `afterAll` le purgera quand même (aucun seed touché).
- **`clesInterdites` ne détecte pas `passwordHash`** (filtre `id`/`*Id`/`details`) : les assertions du
  §8.3 utilisent la liste **exacte** des clés (précédent `admin-parametres.spec.ts:134`).
- **Bascule Eye du champ readonly** : le mot de passe temporaire n'est jamais requis pour un
  formulaire (il ne ressert jamais d'entrée), donc pas de risque de l'afficher par erreur ailleurs.
- **`navigator.clipboard`** : indisponible hors contexte sécurisé → repli « sélection manuelle »
  documenté, pas d'erreur bloquante, pas de promesse de copie non tenue en toast.

| # | Point ouvert | Défaut retenu |
|---|---|---|
| 1 | Rattachement `User` ↔ `Employe` (E27 historique) : un compte EMPLOYE créé ici n'a **aucun** dossier `Employe` → `/admin/mon-planning` renvoie « Aucun dossier employé » (404 existant) | **Hors lot** — à livrer avec un futur CRUD employés ; à afficher dans la doc d'usage de la page |
| 2 | Délégation à `ADMIN_FILIALE` (voir/compter les comptes de sa filiale) | **Refusée** (D2 : SA seul) — à ouvrir si le client le demande |
| 3 | Édition de l'email (identifiant de connexion) | **Immuable** (D6) |
| 4 | Suppression définitive d'un compte | **Non retenue** (D5 : désactivation) |
| 5 | Politique de mdp (Q-02 : complexité, historique, expiration), 2FA, mailer de réinitialisation (Q-10) | **Hors périmètre confirmé** — le reset s'appuie sur l'affichage une fois (D14) |
| 6 | Garde « dernier SA » : non couvert e2e (nécessiterait de désactiver le compte seedé) | Couvert en **unit** (fonction pure) + revue de code ; écart assumé |
| 7 | Affichage du shell à un compte désactivé jusqu'au premier appel API (D13) | Accepté — les données restent protégées (401 systématique) |
| 8 | Limite de changement **par utilisateur** au-delà de l'IP (point ouvert 4 du lot 5) | **Couvert ici** pour les mutations de comptes (clé IP+utilisateur, D15) ; le changement de mdp propre garde son scope `profil-mot-de-passe` IP seul |
