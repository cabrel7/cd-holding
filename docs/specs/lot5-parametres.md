# Lot 5 — Sous-lot paramètres / changement de mot de passe (spec)

Rédigée par l'architecte le 2026-10-11 (lecture seule, aucun fichier code modifié). Même format que
`lot5-planning.md` / `lot5-dossiers-comptables.md`. Sources : `CLAUDE.md`, `PROJECT_STATE.md:157,205`,
`CONVERSION_INVENTORY.md:86,147,473-482` (D9), `shared/validation/auth.ts:5-9`, `shared/utils/roles.ts:3-7`,
`server/utils/auth.ts:16-57`, `server/api/auth/login.post.ts:1-66`, `server/utils/rate-limit.ts:83-106`,
`prisma/schema.prisma:182-198`, `prisma/seed/accounts.ts:1-67`, `shared/config/admin.ts:42-46`,
`prototype_react/.../routes/admin.parametres.tsx`, `prototype_react/.../components/admin/AdminSidebar.tsx:35-58`,
`app/config/admin-nav.ts:49-126`, `app/middleware/admin.ts:21-31`, `app/pages/admin/login.vue`,
`app/pages/admin/mon-planning.vue`, `app/components/admin/{AdminHeader,AdminPageHeader}.vue`,
`app/components/admin/comptable/useDossierActions.ts`, `app/utils/{admin-error,admin-unauthorized}.ts`,
`tests/e2e/fixtures/admin-pages.ts`, `tests/e2e/helpers/{auth,db,ip}.ts`, `tests/e2e/contact.spec.ts:94-127`,
`playwright.config.ts:50-58`, `scripts/cleanup-test-data.ts`.

## 0. Résumé, périmètre, routes

Ce sous-lot livre la page `/admin/parametres` du prototype (strictement lecture seule : Nom, Courriel,
Rôle en badge, Filiale rattachée) **+** l'ajout D9 « bloquant prod » : changement de mot de passe
(`PROJECT_STATE.md:204-205`, `CONVERSION_INVENTORY.md:481`).

| Page | API | Rôles |
|---|---|---|
| `/admin/parametres` | `GET /api/admin/profil` | SUPER_ADMIN, ADMIN_FILIALE, EMPLOYE |
| idem + Dialog « Changer le mot de passe » | `POST /api/admin/profil/mot-de-passe` | idem (3 rôles) |

- **Inclus** : page, dialog de changement de mdp, item de nav, 2 endpoints, schémas partagés,
  tests unitaires + e2e, captures 3 breakpoints.
- **Exclus** : gestion des comptes (D10 / DEC-37 `/admin/utilisateurs`), reset de mdp par un admin,
  édition de nom/courriel/rôle/filiale (page lecture seule, comme le prototype — aucune mutation de
  profil), expiration/historique de mot de passe, `TexteAccentue` (page admin = libellés d'interface,
  pas de catalogue de contenu public — exception CLAUDE.md § Dashboard), mailer (Q-10).
- **Aucune migration** : `User.passwordHash` (`schema.prisma:186`) + relation `company` (`:190`) déjà
  en base ; le hash est déjà produit par le seed et vérifié au login aujourd'hui.

## 1. Décisions tranchées (et pourquoi)

| # | Question | Décision | Justification |
|---|---|---|---|
| D1 | Sidebar : 3 rôles ou 2 (prototype : SA/AF seulement, EMPLOYE par URL) | **Item pour les 3 rôles** (dernier de `ADMIN_NAV`) | Le prototype cachait le lien à l'employé parce que sa nav n'avait qu'une page — pas une règle métier. Avec D9, le changement de mdp devient la **seule** porte de secours d'un employé (aucun reset admin avant D10) : le laisser derrière une URL tapée à la main crée un impasse. Le mdp est une capacité de compte, pas une donnée — ça ne contredit pas `PROJECT_CONTEXT.md:53` (l'employé reste en lecture seule sur ses données). Écart assumé vs prototype, item créé avec le pattern `AdminNavItem` existant. |
| D2 | `nouveau == actuel` | **Refusé**, erreur 400 sous le champ `nouveau` | Un « changement » sans changement est un no-op qui laisse croire à tort qu'on a sécurisé le compte ; règle placée dans le schéma partagé → client ET serveur, une seule source. |
| D3 | Champ « Confirmer le nouveau mot de passe » | **Oui, côté client uniquement** | Aucun reset automatique n'existe avant D10 : un mdp tapé de travers = compte verrouillé jusqu'à une intervention en base. Zéro champ de confirmation dans le dépôt aujourd'hui, mais ici l'enjeu est un verrouillage définitif. Schéma de dialog fourni par une fabrique dans `shared/validation/auth.ts` (pas de règle dupliquée) ; le dialog **retire `confirmation` avant le POST** (le schéma serveur est `.strict()`). |
| D4 | Invalidation des sessions après changement | **Aucune invalider** ; la session courante reste active | Il n'existe **aucun** mécanisme dans le dépôt : les sessions sont des cookies scellés stateless (`nuxt-auth-utils`), pas de store serveur, pas d'horloge `passwordChangedAt`. Une invaliderion paresseuse exigerait une colonne + un contrôle dans `requireAuth` = migration + impact transverse à toutes les routes admin — hors périmètre (le brief attend « aucune migration »). Risque documenté §10 ; proposition complète (colonne `passwordChangedAt`) à greffer sur D10. |
| D5 | Mdp actuel incorrect → quel statut ? | **400** (`statusMessage: 'Mot de passe actuel incorrect'`), jamais 401 | Un 401 déclenche `watchAdminUnauthorized` → l'utilisateur serait **déconnecté de l'UI** pour une faute de saisie. 401 reste réservé aux vrais cas de session morte (§3). |
| D6 | Compte e2e pour les mutations | **Compte dédié créé/purgé** via `cleanup-test-data.ts` | Isolation du dépôt (« chaque test nettoie ses propres données ») : muter un compte seedé partagé casserait les autres specs en cas d'échec entre les deux changements. Mot de passe **généré** par le script et remonté en stdout (`MDP_E2E=`, motif `OFFRE_UUID=`), jamais écrit en dur (convention `helpers/auth.ts:3-4`). |
| D7 | Ordre dans la route POST | `requireRole` → `assertRateLimit` → garde 4 Ko → zod | CLAUDE.md impose `requireRole` en premier ; le reste reproduit `login.post.ts:19-26` (le limiteur protège le parseur de corps). |
| D8 | En-tête de page | `AdminPageHeader titre="Paramètres"` (pas l'eyebrow « Compte » du prototype) | La page vit dans le shell admin validé au lot 4 : toutes ses pages utilisent `AdminPageHeader` (un seul h1, pattern commun). Écart documenté, pas un redesign. |
| D9 | `companyScope` / 403 ? | **Applicable nulle part** | La ressource lue EST l'utilisateur de la session (`secure.userId`) : impossible de lire le profil d'un tiers, donc aucun filtre à refaire et **aucun cas 403** sur ce lot (les 3 rôles sont autorisés). |
| D10 | Rate-limit sur GET profil ? | **Non** | Lecture de soi, aucune surface de force brute ; le risque (deviner un mdp) est sur le POST, limité 5/15 min/IP. |
| D11 | Vérification `actif` | Sur le **POST seulement** → 401 | On n'effectue pas d'opération d'identification pour un compte désactivé ; le 401 fait also repartir l'UI vers le login. L'extension du contrôle à toutes les routes `/api/admin/**` est un chantier global (D10), pas de fausse sécurité à une seule route. |
| D12 | Message affiché quand la confirmation est vide | **Message distinct** « Veuillez confirmer le nouveau mot de passe. » (vide), règle de longueur commune sinon | Aux deux champs courts, la même phrase longueur répétée sous `nouveau` **et** `confirmation` est illisible ; message porté par le schéma, donc client **et** tests unit partagent la constante `PASSWORD_TOO_SHORT_MESSAGE`. |
| D13 | Largeur du contenu de la page | Borné `max-w-2xl md:max-w-3xl` sous un en-tête pleine largeur | `ADMIN_PAGE_WIDTH_CLASS` = `max-w-7xl` (retour design 2026-10-10, 24 pages) : appliqué tel quel ici, 4 lignes courtes formeraient une bande blanche ~1150 px, alors que le prototype bornait la page à `max-w-3xl`. Écart assumé, précédent `MessageItem` (`max-w-prose` sur son `dl`). |

## 2. Règles mot de passe & session

- **Règle unique existante conservée** : `PASSWORD_MIN_LENGTH = 8` (`shared/validation/auth.ts:5`).
  Aucune exigence majuscule/chiffre, aucun historique, aucune expiration dans ce sous-lot (§10).
- **Hash** : `hashPassword()` / `verifyPassword()` de `#auth-utils` (scrypt, auto-imports Nitro —
  utilisés sans import par `login.post.ts:14,42`). **Jamais** de `#auth-utils` dans `shared/`,
  `scripts/` ou les tests : hors Nitro l'alias ne résout pas (precedent seed → `@adonisjs/hash`,
  `PROJECT_STATE.md:128`). Le seed n'est **pas modifié** : ses hashes Scrypt sont vérifiables par
  `verifyPassword` (preuve : login e2e vert).
- **Pas de trim ni de minuscules** sur les mots de passe (les espaces de bord sont significatifs) —
  contrairement à `emailSchema`.
- **Session** : le changement de mdp ne touche ni `session.user` ni `session.secure` (aucune donnée de
  mdp n'y figure) → **aucun refresh, aucune reconnexion forcée** ; l'utilisateur reste connecté après
  succès. Les autres sessions existent toujours (D4).
- `passwordHash` ne sort **jamais** : ni dans le DTO, ni dans le `select` de lecture du profil.

## 3. API — routes Nitro (`server/api/admin/profil/`)

Constantes communes (exportées par le service) : `ROLES_PROFIL = [SUPER_ADMIN, ADMIN_FILIALE, EMPLOYE]`,
`PROFIL_SELECT` (select Prisma explicite : `uuid, nom, email, role, company { uuid, nom }` — ni `id`,
ni `companyId`, ni `passwordHash`, ni `actif`). Réponses en `cache-control: no-store`. UUID : sans objet
(lecture de soi, aucun paramètre).

| Route | Entrée | Succès | Erreurs |
|---|---|---|---|
| `GET /api/admin/profil` | — | 200 `AdminProfilDto { uuid, nom, email, role, company: {uuid, nom} \| null }` | 401 (pas de session / `secure` absent / compte supprimé) |
| `POST /api/admin/profil/mot-de-passe` | `changementMotDePasseSchema` `.strict()` `{ actuel, nouveau }` | 200 `{ ok: true }` | 400 (zod : champs manquants, mdp < 8, `nouveau == actuel` ; ou `Mot de passe actuel incorrect`), 401 (session morte, compte supprimé, `actif = false`), 413 (corps > 4 Ko ou `content-length` absent), 429 (`Retry-After`, message générique `assertRateLimit`) |

Comportements de `POST` (orchestration dans la route, crypto dans la route — le service ne touche jamais
à `#auth-utils`, cf. §6) :

1. `requireRole(event, ROLES_PROFIL)` — premier appel.
2. `assertRateLimit(event, { scope: 'profil-mot-de-passe', max: 5, windowMs: 15 min })` — **scope distinct
   de `login`** (buckets séparés : un changement de mdp n'épuise pas le quota de connexion), mêmes
   paramètres que le login. **`resetRateLimit` au succès** (comme `login.post.ts:49`) : sinon un
   utilisateur (ou un site derrière un NAT) est bloqué 15 min après 5 changements réussis.
3. Garde `content-length` 4 Ko → 413 (copie de `login.post.ts:21-24`).
4. `readValidatedBody(changementMotDePasseSchema.parse)` → 400.
5. Lecture par `secure.userId` (jamais d'identifiant client) : `{ passwordHash, actif }` — absent → 401,
   `actif = false` → 401 (D11).
6. `verifyPassword(passwordHash, actuel)` faux → 400 `Mot de passe actuel incorrect` (D5). Pas de
   « dummy hash » : l'appelant est authentifié sur son propre compte, aucune énumération possible.
7. `hashPassword(nouveau)` → `prisma.user.update` sur l'**id interne** de `secure` → `resetRateLimit`
   → 200 `{ ok: true }` (même forme que le login).

Logs : aucun (l'error-handler ne journalise que les 5xx, sans PII) ; zéro `console.log`/`alert`.

## 4. Shared

`shared/validation/auth.ts` (ajouts, imports existants) :

- `actuelSchema = z.string().min(1, 'Mot de passe actuel requis')` (required_error inclus).
- `changementMotDePasseChamps = z.object({ actuel: actuelSchema, nouveau: passwordSchema }).strict()`.
- `changementMotDePasseSchema = changementMotDePasseChamps.superRefine( nouveau !== actuel → issue
  `path: ['nouveau']`, message « Le nouveau mot de passe doit être différent de l'actuel. »)`.
- `changementMotDePasseDialogSchema()` — fabrique pour le client : mêmes champs **+ `confirmation:
  confirmationSchema`**, `.strict()`, superRefine `nouveau !== actuel` **+** `confirmation` (issue
  `path: ['confirmation']`, « Les mots de passe ne correspondent pas. »). La fabrique évite tout code de
  règle dupliqué entre client et serveur (zod 3 : `.extend` impossible après `.superRefine`).
  **`confirmationSchema` (D12)** : champ **vide** → « Veuillez confirmer le nouveau mot de passe. » ;
  champ **court** → la règle de longueur commune (`PASSWORD_TOO_SHORT_MESSAGE`). Sans cela, un
  formulaire aux deux champs courts affiche la même phrase longueur sous les deux, illisible.
- Types : `ChangementMotDePasseInput`.

`shared/config/admin.ts` (MODIF) : `MESSAGE_ACTUEL_INCORRECT` (constante du 400 du serveur, comparée
par le client pour ne router que **ce** message sous le champ — un autre 400 part en toast avec
`ADMIN_ERROR_GENERIC_MESSAGE`) et `MESSAGE_RATE_LIMIT_TENTATIVES` (libellé 429 identique login ↔
paramètres, sorti de `login.vue`).

`shared/types/admin.ts` : `AdminProfilDto { readonly uuid; nom; email; role: AppRole;
company: { readonly uuid; readonly nom } | null }` (+ import `AppRole` depuis `../utils/roles`).

`ROLE_LABELS` (déjà présent, `shared/config/admin.ts:42-46`) fournit les libellés du badge.

## 5. Frontend

- **Page** `app/pages/admin/parametres.vue` :
  - `definePageMeta({ middleware: 'admin', layout: 'admin', roles: [SA, AF, EMPLOYE] })` (le middleware
    ne redirige l'EMPLOYE que pour `/admin` exact — `middleware/admin.ts:23`).
  - `useHead({ title: 'Paramètres' })` ; `AdminPageHeader titre="Paramètres"`
    description « Consultez votre compte et modifiez votre mot de passe. » (D8).
  - `useFetch<AdminProfilDto | null>('/api/admin/profil', { server: false, key: 'admin-profil',
    default: () => null })` + `watchAdminUnauthorized(error)` (préfixe `admin-` → vidé au logout,
    `admin-unauthorized.ts:8`). Le `| null` + `default` distingue **loading** (`data === null`) de
    **ready** sans attendre `pending` — écart assumé au §5 initial (la page a 3 états, pas 2).
    **Tous les champs affichés viennent du GET** (source unique ; la session ne contient pas l'email).
  - Bloc `dl` repris du prototype (Nom / Courriel / Rôle / Filiale rattachée) **en tokens du socle**
    (`bg-card`, `border-border`, `text-navy` — pas de hex bruts du prototype) ; rôle en `Badge
    variant="secondary"` avec `ROLE_LABELS` (badge fonctionnel : un vrai statut, autorisé) ;
    `company === null` → « Aucune (accès groupe entier) » (libellé exact du prototype).
  - Section « Mot de passe » (même langage visuel : bordure, bloc) : texte « Modifiez le mot de passe
    utilisé pour vous connecter à la console. » + bouton « Changer le mot de passe » (≥ 44 px).
    **Le texte teasé du prototype (« Les paramètres avancés seront disponibles dans une prochaine
    itération. ») est remplacé** : la fonctionnalité existe maintenant (écart voulu, D9).
  - États : `AdminListState` (loading / erreur 401→déjà gérée par le watcher).
- **Dialog** `app/components/admin/parametres/MotDePasseDialog.vue` (shadcn-vue `Dialog`, portage du
  pattern `CmsFormDialog`/`useDossierActions`) :
  - VeeValidate + `toTypedSchema(changementMotDePasseDialogSchema())` ; champs dans l'ordre : « Mot de
    passe actuel » (`autocomplete="current-password"`), « Nouveau mot de passe »,
    « Confirmer le nouveau mot de passe » (`autocomplete="new-password"`), tous `type="password"` par
    défaut avec bascule afficher/masquer par champ (bouton icône `Eye`/`EyeOff` de `@lucide/vue`,
    `aria-label` « Afficher le mot de passe »/« Masquer le mot de passe », cible ≥ 44 px).
  - Titre « Changer le mot de passe », description « Saisissez votre mot de passe actuel pour confirmer
    le changement. », pied : « Annuler » / « Enregistrer » (désactivé + libellé en cours pendant
    `submitting`).
  - Fermeture **seulement après succès** ; reset des valeurs à la fermeture.
- **Action** `app/components/admin/parametres/useMotDePasseAction.ts` (miroir strict de
  `useDossierActions.ts`) : `submitting`, `actuelError` (400 → message serveur sous le champ), POST du
  **seul** `{ actuel, nouveau }` (confirmation retirée — `.strict()` sinon 400), puis :
  - succès → `toast.success('Mot de passe modifié.')`,
  - 401 → `handleAdminUnauthorized()` (déconnexion propre),
  - 429 → `toast.error('Trop de tentatives. Réessayez dans quelques minutes.')` (libellé login),
  - autres 4xx/5xx → `toast.error(toAdminError(e).message)`.
  - Jamais d'`alert`/`confirm`/`console.log`.
- **Nav** `app/config/admin-nav.ts` : item **dernier** de `ADMIN_NAV` :
  `{ to: '/admin/parametres', label: 'Paramètres', icon: Settings, roles: [SA, AF, EMPLOYE] }`
  (transversal : ni `module`, ni `site` ; icône fonctionnelle de navigation). Position = dernière,
  comme dans le prototype (`AdminSidebar.tsx:58`). Effet collatéral souhaité : `AdminHeader`
  affiche « Paramètres » comme contexte de section (`AdminHeader.vue:36-38`).
- Design : socle navy/or, aucun dégradé, aucune emoji, cibles ≥ 44 px sous md, 375 px sans scroll
  horizontal (dialog inclus).

## 6. Service (`server/services/admin/profil.ts`)

`PROFIL_SELECT`, type `ProfilMapRow`, `toProfilDto(row)` (**pick explicite** des 5 champs — un
`{ ...row }` serait refusé par le test §6), `getProfil(userId)` (read, `null` si compte absent),
`lireComptePourMotDePasse(userId)` (`{ passwordHash, actif }`), `enregistrerMotDePasse(userId, hash)`,
`ROLES_PROFIL`. **Aucun appel à `hashPassword`/`verifyPassword` dans le service** : ces identifiants
sont des auto-imports Nitro — les tests unitaires importent ce module (precedent
`placement-mapping.test.ts`) et ne doivent pas en dépender. La crypto vit dans la route (comme
`login.post.ts`).

## 7. Tests unitaires

- `tests/unit/auth-validation.test.ts` (étendu) :
  - `changementMotDePasseSchema` : `.strict()` (clé inconnue rejetée), actuel requis/vide → message,
    nouveau < 8 → message existant, `nouveau == actuel` → échec avec `path: ['nouveau']` et message
    exact, valide → succès, **pas de trim** (`'abcdefgh '` analysé tel quel).
  - Fabrique dialog : `confirmation` différente → `path: ['confirmation']` ; valide → succès ;
    **le schéma serveur rejette `confirmation`** (`.strict()`) — verrouille le contrat de §5 (retrait
    avant POST).
- `tests/unit/profil-mapping.test.ts` (nouveau) : `toProfilDto` — clés exactes de sortie
  (`uuid, nom, email, role, company`), `company: null` vs présente, une row « sale » (avec `id`,
  `passwordHash` en plus, cast) ne les fait pas transiter.
- `tests/unit/admin-nav.test.ts` (corrigé au T2, assertions **exactes** cassées par le nouvel item) :
  EMPLOYE → `['/admin/mon-planning', '/admin/parametres']` ; SA/AF sans module → `+ '/admin/parametres'` ;
  nouvel item : visible pour les 3 rôles, sans module ni site.

## 8. E2E — `tests/e2e/admin-parametres.spec.ts` (build prod, desktop + mobile)

Isolation : `beforeAll` → `semerCompteMdp(marker)` (compte `parametres-<m>@example.test`, EMPLOYE,
filiale entretien, mot de passe `MDP_E2E=` généré) ; `afterAll` → `purgerCompteMdp(marker)`. Les 3 rôles
seedés servent aux lectures seules. **Toute requête POST porte `x-forwarded-for: nextTestIp()`**
(per-request, precedent `admin-reservations.spec.ts:218`) ; les POST mutants passent par un helper
résilient qui retire une IP fraîche sur 429 inattendu (miroir `postContactResilient`,
`contact.spec.ts:94-106`). La variable `motDePasseCourant` suit l'enchaînement (workers 1, ordre de
fichier déterministe). Les tests UI posent `page.setExtraHTTPHeaders` avant login (pattern
`admin-shell.spec.ts:15`).

1. **401 sans session** : GET profil et POST mot-de-passe → 401 (message générique).
2. **GET profil 200 × 3 rôles** : SA (`company: null`), AF entretien et EMPLOYE (`company.nom` présent),
   `email` conforme au compte (preuve que le GET sort bien ce que la session ne contient pas),
   `clesInterdites(dto) === []`, `cache-control: no-store`.
3. **POST 400** : `actuel` faux → 400 « Mot de passe actuel incorrect » ; `nouveau` < 8 → 400 ; `nouveau
   == actuel` → 400 ; corps invalide/champs manquants → 400 ; clé inconnue (`confirmation`) → 400 (strict).
4. **Changement complet** : POST 200 → login **ancien** mdp → 401, login **nouveau** mdp → 200 (helper
   `loginAs`/`apiAs` avec le nouveau mot de passe, anciens devenus invalides).
5. **413** : corps > 4 Ko → 413.
6. **429** : même IP, 6 POST avec `actuel` faux → statuts `[400 × 5, 429]` + en-tête `Retry-After`
   numérique (IP fraîche réservée au préalable).
7. **UI** (375 + 1440) : page = Nom/Courriel/Rôle (badge libellé exact)/Filiale rattachée ; SA affiche
   « Aucune (accès groupe entier) » ; lien « Paramètres » visible dans la nav pour SA, AF **et** EMPLOYE ;
   ouverture du dialog, validation cliente (nouveau court, confirmation différente) **sans requête
   réseau** (compteur de requêtes POST = 0) ; `actuel` faux → erreur sous le champ, dialog ouvert ;
   succès → toast « Mot de passe modifié. », dialog fermé, **toujours connecté** (pas de redirect
   login) ; cibles ≥ 44 px, aucun scroll horizontal à 375.
8. **Régression** : `admin-shell.spec.ts` (desktop + tablet — nav EMPLOYE et items SA/AF) sans
   modification attendue, `admin-planning` non impacté.

## 9. Découpe T0 → T4 (périmètres disjoints, fichiers exhaustifs)

- **T0 (fil principal)** — `shared/validation/auth.ts` (MODIF : schémas + fabrique + types),
  `shared/types/admin.ts` (MODIF : `AdminProfilDto`), `tests/unit/auth-validation.test.ts` (MODIF :
  tests §7). Rien d'autre.
- **T1 backend** — `server/services/admin/profil.ts` (CRÉER),
  `server/api/admin/profil/index.get.ts` (CRÉER), `server/api/admin/profil/mot-de-passe.post.ts`
  (CRÉER), `tests/unit/profil-mapping.test.ts` (CRÉER). Ne touche pas `app/**`, `shared/**`,
  `tests/e2e/**`, `scripts/**`, `playwright.config.ts`.
- **T2 frontend** — `app/pages/admin/parametres.vue` (CRÉER),
  `app/components/admin/parametres/MotDePasseDialog.vue` (CRÉER),
  `app/components/admin/parametres/useMotDePasseAction.ts` (CRÉER), `app/config/admin-nav.ts`
  (MODIF : 1 item), `tests/unit/admin-nav.test.ts` (MODIF : 3 assertions). Ne touche pas `server/**`,
  `shared/**`, `tests/e2e/**`.
- **T3 e2e** — `tests/e2e/admin-parametres.spec.ts` (CRÉER), `scripts/cleanup-test-data.ts` (MODIF :
  options `--seed-compte-mdp <m>` (upsert avec hash `@adonisjs/hash` comme le seed, imprint
  `MDP_E2E=`, met à jour le hash à chaque appel) et `--purge-compte-mdp <m>`, dispatch +
  commentaire d'usage en tête), `tests/e2e/helpers/db.ts` (MODIF : wrappers `semerCompteMdp` /
  `purgerCompteMdp`), `playwright.config.ts` (MODIF : `admin-parametres` dans le `testMatch` mobile,
  `:54`). `tests/e2e/fixtures/admin-pages.ts` : **aucune modification** (réutilise `AdminShell`,
  `apiAs`, `clesInterdites`).
- **T4 vérification** — `pnpm typecheck`, `pnpm test:unit` (poste : `--maxWorkers=2`),
  un **seul** `pnpm build:check`, e2e ciblé (parametres + régressions shell/planning) sur build prod,
  **une seule** passe de revue (reviewer + ux-reviewer en parallèle, correctifs groupés avant rebuild),
  captures 375/768/1440 (`conversion-captures/lot5-nuxt/` : page + dialog ouvert au desktop),
  **pas de vidéo** (dialog/toast déjà chorégraphiés et filmés au lot 5), mise à jour de
  `PROJECT_STATE.md` (ligne checklist Holding `/admin/parametres`, journal, prochaine étape).

## 10. Critères d'acceptation

1. `typecheck`, `test:unit` (§7), `build:check` passent ; e2e vert desktop + mobile sur build prod.
2. GET profil : 200 pour les 3 rôles, aucun `id`/`companyId`/`passwordHash` en réponse, `no-store`.
3. POST : 200 avec le bon `actuel` ; ancien mdp → 401 au login, nouveau → 200 ; `actuel` faux / mdp
   court / identique → 400 (jamais 401) ; 413 ; 429 avec `Retry-After` après 5 échecs ; 401 = session
   réellement morte (ou compte inactif).
4. Item « Paramètres » visible en nav pour SA, AF, EMPLOYE ; page accessible aux 3 rôles (et redirigée
   sinon par le middleware).
5. Après un changement réussi : session courante intacte (pas de relogin imposé), toast exact
   « Mot de passe modifié. », dialog fermé seulement alors.
6. Aucun `alert`/`confirm`/`console.log`/`v-html`/dégradé/emoji ; cibles ≥ 44 px ; 375 px sans scroll.
7. `admin-shell` (dont tablet) non régressé ; seed inchangé ; aucune migration, aucune écriture de
   contenu public (donc aucun appel `invalidatePublicPages`).

## 11. Risques, points de vigilance, points ouverts

- **Compatibilité des hashes** : ne jamais hasher hors des routes (`#auth-utils` ne résout pas hors
  Nitro) ; le seed garde `@adonisjs/hash` (driver identique, prouvé par le login). Ne pas « améliorer »
  le hash dans ce lot (migration de données silencieuse).
- **`resetRateLimit` obligatoire au succès** (T1) : sinon 5 changements réussis = 15 min de blocage
  (IP de bureau partagée). Inversement, le scope doit rester séparé de `login`.
- **Sessions non invalidées** (D4) : une session volée reste valide jusqu'à son expiration même après
  changement de mdp. Comportement documenté, pas de secret. Mitigation proposée (hors lot) : colonne
  `User.passwordChangedAt` (migration) + contrôle `loggedInAt >= passwordChangedAt` dans
  `requireAuth` → invaliderion paresseuse de toutes les anciennes sessions, à décider avec
  l'utilisateur et à livrer avec D10.
- **`User.updatedAt` n'est PAS une horloge de mot de passe** : auto-bumpé par toute écriture future
  (D10 : `actif`, `nom`…) — ne pas le réutiliser comme substitut.
- **Compte désactivé** : le 401 du POST (D11) n'est **pas** couvert e2e (aucun compte `actif=false`
  seedé) — revue de code ; l'extension du contrôle à toutes les routes reste D10.
- **Employé sans dossier `Employe`** : **non applicable** ici (contrairement à `/admin/mon-planning`) :
  le profil ne lit que `User` → aucun cas 404, rien à couvrir.
- **`.strict()` + `confirmation`** : si le dialog oublie de retirer `confirmation`, chaque soumission
  renvoie 400 — le test unitaire du schéma serveur (§7) et le test UI « sans requête / succès » le
  détectent.
- **Cassures attendues au T2** : `tests/unit/admin-nav.test.ts` (listes exactes) — corrigé dans le
  même temps que l'item, pas après coup.
- **e2e rate-limit** : IPs tirées par `nextTestIp` (253 suffixes) partagées entre les deux passes
  desktop/mobile du même run — le helper résilient (retry IP fraîche sur 429) est obligatoire, sauf
  pour le test 429 lui-même qui doit observer son propre quota.
- **Hors périmètre confirmé** : aucune migration attendue (schéma `User` déjà complet) ; aucun seed à
  toucher ; aucune modification de `.env(.example)`.

| # | Point ouvert | Défaut |
|---|---|---|
| 1 | Invalidation des sessions après changement de mdp (colonne `passwordChangedAt`) | Non dans ce lot (D4) — à trancher avec D10 |
| 2 | Politique de mdp élargie (majuscule/chiffre, historique, expiration) | Non (uniquement `PASSWORD_MIN_LENGTH = 8`) — à trancher avec le client |
| 3 | Édition du profil (nom/courriel) et reset admin | Non (prototype lecture seule ; D10 `/admin/utilisateurs`) |
| 4 | Limite de changement **par utilisateur** (au-delà de l'IP) | Non (le dépôt n'a que du rate-limit IP — `consumeRateLimit` pourrait cléer `secure.userId`, à voir en D10) |
