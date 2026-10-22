# Lot 8 — Sous-domaines chauvierdelor.com + mise en production (multi-hôtes)

## Objet

Faire servir le même monolithe Nuxt/Nitro sur 9 hôtes de production
(`chauvierdelor.com` apex + `www` = holding, `<slug>.chauvierdelor.com` = 6 filiales,
`admin.chauvierdelor.com` = dashboard à **chemins nus**), avec :

1. canonique **sous-domaine** (301 depuis l'apex) — décision utilisateur verrouillée ;
2. chemins **nus** côté client sur sous-domaines (`entretien.chauvierdelor.com/services`,
   `admin.chauvierdelor.com/utilisateurs`) ;
3. **mode chemin (localhost / IP / hôte inconnu) strictement inchangé** : la suite e2e
   existante doit rester verte sans aucune modification ;
4. reverse proxy **Nginx + certbot**, app derrière **PM2**, hébergement VPS
   (PROJECT_CONTEXT §4) — runbook dans `docs/runbook-prod.md`.

## Ce qui change par rapport au brief littéral (divergences, en tête)

| # | Brief | Spéc (tranché) | Pourquoi |
|---|---|---|---|
| 1 | Réécriture `server/middleware/site-hosts.ts` (`/x` → `/{slug}/x`) | **Réécriture upstream Nginx** (`proxy_pass` + `rewrite`) ; aucun middleware de réécriture côté app | **Spike T0 (lecture source) : une réécriture de `event.path`/`event.node.req.url` dans un middleware Nitro N'ARRIVE JAMAIS au router ni à la clé ISR** — h3 ré-assigne `event._path`/`req.url` à chaque layer depuis un snapshot pris avant la boucle (source citée §Spike). Le middleware est non seulement inutile, il échouerait silencieusement. Nginx est de toute façon devant en prod et fait déjà les 301 : un seul endroit possède la connaissance des hôtes. |
| 2 | Exemple Nginx : `location ^~ /entretien { return 301 https://entretien.chauvierdelor.com$request_uri; }` (préfixe **conservé**) | 301 **stripé** : `chauvierdelor.com/entretien/services` → `https://entretien.chauvierdelor.com/services` | Si le préfixe était conservé, le sous-domaine recevrait `/entretien/services` puis son propre rewrite → `/entretien/entretien/services` (double préfixe), et l'URL affichée ne serait pas nue — contraire à la décision « chemins nus » (nav BARE D8). |
| 3 | Routes nues = « duplication de chaque page `[filiale]/*` » | **6 seules routes nues publiques** (`/services`, `/mentions-legales`, `/restaurant`, `/offres`, `/offres/[uuid]`, `/offres/candidature-spontanee`) + les 4 chemins collidants (`/`, `/a-propos`, `/contact`, `/realisations`) gérés par **dispatchers** dans les pages holding | Dupliquer `[filiale]/services` × 6 créerait **6 records au même chemin `/services`** (ambiguïté vue-router identique à celle du brief pour la holding). Un seul record nu par chemin + slug issu de l'hôte ⇒ zéro doublon de chemin, zéro filtrage de table de routes nécessaire. |
| 4 | Risque n°1 = « clé ISR partagée apex/sous-domaine » | Constat sourcé : **`routeRules.isr` est actuellement INERTE sur cette stack** (aucun `cachedEventHandler` actif dans `.output`) → pas de poisonnement possible aujourd'hui ; l'architecture (clé = chemin préfixé) reste la bonne quand/si le cache sera activé | Vérifié dans le build réel (§Spike, constat C3). Aucun changement `isr` dans ce lot (hors périmètre), mais documenté — PROJECT_STATE considère l'ISR comme actif, c'est à corriger dans le journal. |

## Constats de lecture (greps réels, 2026-10-21)

- `params.filiale` : **10 occurrences / 6 fichiers** — `app/pages/[filiale]/{index,services,a-propos,contact,realisations,mentions-legales}.vue`
  (dont `definePageMeta.validate` dans les 6, `nomCourt` fallback dans index/contact/a-propos).
- Pages publiques : 15 fichiers = 5 racine holding (`index`, `a-propos`, `contact`, `confidentialite`,
  `realisations`) + `ccdpaa/restaurant.vue` + `placement/offres/{index,[uuid],candidature-spontanee}.vue` + 6 `[filiale]/*`.
- Pages admin : **24 fichiers** `app/pages/admin/**` (dont `contenu.vue` = parent layout de 6 enfants,
  `login.vue` `layout:false`, les 24 portent `definePageMeta` sauf exceptions vérifiées au T2).
- Liens `to="/…"` hors admin : **12** (`SiteHeader` ×3 logo `/`, `SiteFooter` ×2, `SiteMaintenance`,
  `AdminSidebar` logo `/`, `admin/login` logo `/`, `MentionConfidentialite` `/confidentialite`,
  `CandidatureForm` `/confidentialite`, `ReservationForm` `/ccdpaa/contact`, `restaurant.vue` `/ccdpaa/contact`).
- Liens dynamiques `:to` : `HoldingFiliales` `/${f.slug}`, `SiteFooter` `/${filiale.slug}` +
  `/${site.slug}/mentions-legales`, `FilialeServicesApercu` `/${slug}/services`,
  `FilialeRealisationsApercu` `/${slug}/realisations`, `admin/index.vue` `{path:'/admin/messages'}` ×4.
- `navigateTo` admin : `middleware/admin.ts` (3), `stores/auth.ts`, `utils/admin-unauthorized.ts`,
  `pages/admin/{login,comptable/index,placement/index}.vue`.
- 51 fichiers contiennent `/admin` — **majorité = `/api/admin/**` (inchangés)** ; seuls liens/nav/route touchés listés en inventaire.
- JSON-LD : unique occurrence `app/pages/placement/offres/[uuid].vue` (`JobPosting`) — **aucune URL absolue émise nulle part** (grep `https://` dans app/ = 0 hors schema.org).
- Aucun `useRequestURL`, aucun `rel=canonical`, aucun `og:url` aujourd'hui.
- `server/middleware/` : inexistant (à créer) · `modules/` : inexistant (à créer) · `app/router.options.ts` : inexistant.

## Décisions

> **T0.0 — Spike D3 : GO (2026-10-21, exécuté)** — h3 `1.15.11` fige `_reqPath` au l.1996 avant la
> boucle des layers (réécriture middleware perdue pour le router) ; `nitropack@2.13.4` normalise
> `swr`/`cache` mais **jamais `isr`** (core `index.mjs` l.536-544) → wrap ISR inerte (2 occurrences
> `cachedEventHandler` dans `.output` = définition + wrap `cache:false`). D2 (réécriture Nginx) retenue.

### D1 — Hôtes : source unique `shared/config/site-hosts.ts`

```ts
export const SITE_HOSTS: Record<string, SiteSlug | 'admin'> = {
  'chauvierdelor.com': HOLDING_SLUG, 'www.chauvierdelor.com': HOLDING_SLUG,
  'entretien.chauvierdelor.com': 'entretien', /* … 6 filiales */
  'admin.chauvierdelor.com': 'admin',
}
export type SiteMode = 'chemin' | 'sous-domaine'
export interface SiteHost { mode: SiteMode; slug?: SiteSlug | 'admin'; hoteConnu: boolean }
export function parseSiteHost(host: string): SiteHost
```

- `parseSiteHost` : minuscules, **retrait du port** (`host.split(':')[0]` — IPv6 brackets hors scope,
  l'app n'est jamais adressée en IP en prod), puis lookup `SITE_HOSTS`.
- Hôte inconnu (localhost, IP, `.test`) → `{ mode: 'chemin', hoteConnu: false }` (**fallback = comportement actuel**).
- Suffixes de test : `entretien.localhost` (et `<slug>.localhost`) résolus par Chromium via `*.localhost` →
  même table : on teste une entrée `SITE_HOSTS` par suffixe `.localhost` sans DNS (mécanisme générique :
  si `host` se termine par `.localhost`, on ré-applique le lookup sur la partie avant `.localhost`).
- `hoteConnu` distingue apex de dev : requis par D8 (liens inter-sites absolus uniquement en prod).

### D2 — Réécriture des chemins : Nginx uniquement (divergence n°1)

- Prod : Nginx réécrit le chemin **en amont** de l'app — l'app reçoit toujours des chemins
  **préfixés** (`/entretien/services`, `/admin/utilisateurs`) comme en mode chemin → routage,
  `params.filiale`, ISR (si actif un jour) et règles `routeRules` sont **identiques à aujourd'hui**.
 - Blocs (détail + final dans `docs/runbook-prod.md`) :
   - filiale `location / { rewrite ^/$ /<slug> last; rewrite ^/(.*)$ /<slug>/$1 break; proxy_pass … }`
     + **strip 301 au edge** `location ^~ /<slug>/` et `location = /<slug>` (exécution
     2026-10-21 : pass-through initial remplacé — avec `proxy_set_header Host $host`, un
     pass-through laisse le middleware D5 re-voir du préfixé et répondre 301 vers le nu à
     chaque requête = **boucle** ; le strip émet la cible bare, qui ne re-matche jamais) ;
   - admin : idem vers `/admin` + strip `^~ /admin/` ;
   - **exceptions jamais réécrites ni stripées** (both hôtes) : `^~ /api/`, `^~ /_nuxt/`,
     `^~ /fonts/`, `^~ /favicon`, `^~ /__nuxt_error`, et sur sous-domaine filiale
     **`location = /confidentialite`** (page holding reachable depuis le pied de page de
     toutes les filiales — `SiteFooter.vue:148`) ;
   - apex : **aucune réécriture** (le holding est servi tel quel).
 - **Idempotence** : la cible du strip (bare) ne re-matche jamais `^~ /<slug>/` — retry,
   prefetch payload préfixé (stripé → bare → réécrit → 200, un seul tour) jamais doublés.
- Mode chemin (dev/e2e/IP) : **aucun middleware, aucune réécriture** → suite e2e intouchée.

### D3 — Spike ordre Nitro/ISR (prioritaire, T0.0) : résultat + procédure

**Résultat de la lecture source (fait pendant la rédaction de cette spec)** — ordre réel dans
`nitropack@2.13.4` :

1. `node_modules/.pnpm/nitropack@2.13.4_*/node_modules/nitropack/dist/runtime/internal/app.mjs`
   (`createNitroApp`) : `h3App.use(createRouteRulesHandler(…))` **en 1er** (headers/redirect/proxy
   uniquement, figés au1er appel via `event.context._nitro.routeRules`, cf. `route-rules.mjs`)
   → ensuite les `server/middleware/*` (`h3App.use(middlewareBase, handler)`) → wrap ISR
   `if (routeRules.cache) handler = cachedEventHandler(handler, { group: 'nitro/routes', … })`
   posé **sur le handler de route au boot**, calculé sur le **pattern** `h.route` → enfin
   `h3App.use(config.app.baseURL, router.handler)` **en dernier**.
2. `node_modules/.pnpm/h3@1.15.11/node_modules/h3/dist/index.mjs`, `createAppEventHandler`
   (~l.1991-2035) : `_reqPath` est capturé **une fois avant la boucle des layers**, puis **chaque**
   layer ré-assigne `event._path = _layerPath` et `event.node.req.url = …` dérivés de ce snapshot.
   → une mutation faite par un middleware est **écrasée avant l'entrée dans le layer suivant
   (le router donc)**. `event.path` est un getter sans setter (l.1798) : `event.path = …` lèverait
   en strict mode.
3. Clé ISR à l'exécution : `runtime/internal/cache.mjs` (~l.136) :
   `event.node.req.originalUrl || event.node.req.url || event.path` (+ hash, + headers `vary`) —
   donc **la clé = le chemin reçu par Nitro**, c'est-à-dire le chemin upstream Nginx (préfixé) si D2.

**Constat C3 (build réel)** : `.output/server/chunks/nitro/nitro.mjs` — les `routeRules` runtime
ne contiennent que `isr: 3600|60` ; la seule règle `cache` est `/__nuxt_error: { cache: false }`
→ la condition `routeRules.cache` du wrap `cachedEventHandler` est **toujours fausse** ;
`grep 'cachedEventHandler'` sur `.output/server/chunks/**` = 2 occurrences (définition + wrap inactif).
`nitropack/dist/core/index.mjs` l.536-543 normalise `swr`→`cache` mais **pas `isr`** ;
`@nuxt/nitro-server@4.5.2/dist/index.mjs` l.608 mappe `isr`→`payload` (manifest client) et l.649-658
duplique les règles `…/_payload.json`. **Conclusion : pas de cache HTML serveur actuel** ⇒ risque
poisonnement de clé inexistant aujourd'hui, et `invalidatePublicPages()` (`server/utils/isr.ts`)
est un filet sans effet aujourd'hui. **Aucun changement dans ce lot** (champ `isr` conservé tel quel),
constat reporté au journal PROJECT_STATE (candidat : bascule future `isr` → `swr` = 1 ligne +
analyse de ses effets — hors lot).

**Procédure de validation en 10 min (T0.0, à exécuter avant T2)** :
1. `node -e` mini-h3 : créer un `createApp` avec 1 middleware qui fait
   `event.node.req.url = '/x'` + 1 handler route qui log `event.path` — constater que le handler
   reçoit le chemin d'origine (valide §D3-2, 2 min).
2. Ou lecture directe : `grep -n '_reqPath\|_layerPath' node_modules/.pnpm/h3@1.15.11/*/h3/dist/index.mjs`.
3. Vérif build : `grep -o '"[^"]*": {"isr[^}]*}' .output/server/chunks/nitro/nitro.mjs` et
   `grep -rc cachedEventHandler .output/server/chunks/*/*.mjs` (constat C3).
4. **Go/No-Go** : si (1) prouvait l'inverse (mutation propagée), la réécriture app resterait un
   repli possible — mais D2 (Nginx) reste retenu (§divergences n°1).

**Plans B/C (si Nginx un jour contourné)** :
- B — plugin Nitro enveloppant `nitroApp.h3App.handler` : la mutation est faite **avant** le snapshot
  `_reqPath` (h3 `toNodeListener` l.2312 lit `app.handler` **par requête** ; `createApp` l.1952
  rend `handler` une propriété simple → wrappable). Jamais via un `server/middleware`.
- C — `routeRules` `proxy` interne (`{ proxy: { to: '/<slug>/x' } }`) : le1er layer (`route-rules.mjs`)
  proxy vers `localFetch` = nouvel event = snapshot propre ; coût = un saut interne par requête.

### D4 — Routes nues : `pages:extended` (statique, au build) + dispatchers

- Module `modules/bare-routes.ts` (enregistré dans `nuxt.config.ts`), hook `pages:extended` :
  pour **chacune** des cibles nues suivantes, dupliquer la page existante avec `path` sans préfixe
  (mêmes `file`, `name` préfixé `bare-` pour rester unique, meta identique) :
  - `app/pages/[filiale]/services.vue` → `/services`
  - `app/pages/[filiale]/mentions-legales.vue` → `/mentions-legales`
  - `app/pages/ccdpaa/restaurant.vue` → `/restaurant`
  - `app/pages/placement/offres/index.vue` → `/offres`
  - `app/pages/placement/offres/[uuid].vue` → `/offres/[uuid]`
  - `app/pages/placement/offres/candidature-spontanee.vue` → `/offres/candidature-spontanee`
  - **admin (24 fichiers)** : `app/pages/admin/X.vue` → `/X` (préfixe `/admin` retiré, arborescence
    et meta conservées — le parent `contenu.vue` reste parent de `contenu/*`).
- **Non dupliqués** (collisions racine) : `/`, `/a-propos`, `/contact`, `/realisations`. Ce sont les
  **pages holding elles-mêmes qui deviennent des dispatchers** : le contenu holding migre vers
  `app/site-pages/holding/{index,a-propos,contact,realisations}.vue` (hors de `app/pages`, non
  scanné par Nuxt) et `app/pages/<x>.vue` rend
  `<component :is="filialeSlug ? Filiale<XPage> : Holding<XPage>>"` (imports **synchrone** des
  deux variantes → hydration stricte : même composant, même DOM côté SSR et client).
  Résultat : **aucun chemin n'a deux records** (matrice ci-dessous).
- `validate` des pages nues/génériques (gate du mode chemin) :
  - `services`/`mentions-legales` : `isFilialeSlug(param) || isFilialeSlug(slugHôte)` ;
  - `restaurant` : … `|| slugHôte === 'ccdpaa'` ; `offres*` : … `|| slugHôte === 'placement'`
    (`route.path.startsWith('/placement/')` couvre le cas préfixé existant) ;
  - en mode chemin, hôte non filiale → validate échoue → **404 identique à aujourd'hui** (`/services`
    sur localhost ne résout toujours pas) ;
  - les 6 `[filiale]/*` : `validate = isFilialeSlug(param) || isFilialeSlug(slugHôte)` (le cas
    préfixé continue de passer par le param).
- **Plugin `app/plugins/admin-routes.ts` (universel)** : sur hôte `admin` **seulement**, retirer de
  la table les records publics (`router.removeRoute(name)`) pour que `/` nu = dashboard admin et
  jamais l'accueil holding. Exécuté à la création du router (avant la navigation initiale ;
  **point de vigilance T2** : vérifier l'ordre plugin/`app:created` — fallback documenté :
  re-`router.replace(currentRoute.fullPath)` après retrait, et, si le serveur devait rester ambigu,
  seul `/` nu SSR admin.localhost serait affecté (prod est réécrit en `/admin` par Nginx → hors sujet)).
- `app/router.options.ts` (filtre `routes()` par hôte) = **alternative écartée** : le callback
  `routes(_routes)` (nuxt/dist/pages/runtime/plugins/router.js l.35) n'a **aucun accès au contexte
  requête** côté serveur → impossible d'y lire l'hôte. Les dispatchers + le plugin admin suffisent.

**Matrice racine holding vs nue filiale** (attendu) :

| Chemin | localhost/127.0.0.1 (chemin) | apex chauvierdelor.com | `<filiale>.chauvier…` | admin.chauvier… |
|---|---|---|---|---|
| `/` | holding (dispatcher → Holding) | holding | dispatcher → **filiale** (via Nginx : record `[filiale]`) | dashboard (dispatcher/plugin) |
| `/a-propos` `/contact` `/realisations` | holding ✓ | holding ✓ | dispatcher → **filiale** / SSR `[filiale]` | 404 (records publics retirés) |
| `/confidentialite` | holding ✓ | holding ✓ | **holding** (page native, `= /confidentialite` non réécrite) | 404 |
| `/services`, `/mentions-legales` | **404** (validate) ✓ | **404** (validate) ✓ | 200 filiale (nu + SSR préfixé) | 404 |
| `/restaurant` | 404 | 404 | 200 sur `ccdpaa.` only | 404 |
| `/offres*` | 404 | 404 | 200 sur `placement.` only | 404 |
| `/entretien/**` (préfixé) | 200 ✓ inchangé | **301 → sous-domaine** (Nginx + repli middleware D5) | **301 stripé au edge** → nu | 301 → admin nu |
| `/admin/**` | 200 ✓ inchangé | **301 → admin nu** | 301 → admin nu | **301 stripé au edge** → nu |
| `/api/**`, `/_nuxt/**`, `/fonts/**` | ✓ | ✓ | ✓ (jamais réécrit) | ✓ |

### D5 — Redirections 301 canoniques : Nginx (primaire) + middleware Nitro (repli testable)

- **Nginx (recommandé, zéro requête app)** :
  - **Bloc apex** (le bloc `www` fait `return 301 https://chauvierdelor.com$request_uri` au-dessus) :
    - regex à captures nomées (une seule, **strip** incluse) :
      `location ~ ^/(?<fs>entretien|transport|comptable|placement|ccdpaa|boissons)(?<rest>/.*)?$`
      → `return 301 https://$fs.chauvierdelor.com$rest$is_args$args;`
      (`/entretien` sans slash → `$rest` vide → racine du sous-domaine ✓ ; query string conservée
      via `$is_args$args` ✓ ; `/entretienfoo` **non** matché) ;
    - `location ~ ^/admin(?:/(?<rest>.*))?$` → `return 301 https://admin.chauvierdelor.com/$rest$is_args$args;`
      (`/admin` → `/`) ;
    - si le PCRE de `return` avec `$rest` posait problème (test T4) : **blocs explicites** —
      6 × ( `location = /<slug>` + `location ^~ /<slug>/` ) + 2 pour `/admin` = **14 locations** +
      bloc www ; variante fonctionnelle équivalente.
  - **Blocs sous-domaine (filiale + admin)** :
    - **Strip au edge anti-boucle 301 (ajout 2026-10-21)** : le middleware D5 répond 301 sur
      chemin préfixé + hôte connu. Si Nginx réécrivait `/x` → `/<slug>/x` **puis** transmettait
      `Host: $host`, le middleware re-voit du préfixé à chaque requête → **boucle infinie**.
      Division retenue : chaque bloc sous-domaine fait **d'abord**
      `location ^~ /<slug>/` (+ `location = /<slug>`) → 301 stripé vers le nu, **puis**
      `location /` réécrit vers le préfixé pour l'app — la cible bare ne re-matche jamais le
      strip (zéro boucle ; hop supplémentaire uniquement si un client tape l'URL préfixée ;
      `/_payload.json` préfixé : strip → bare → rewrite → 200, un seul tour) ;
    - bloc **filiale** : `proxy_pass` app avec `rewrite ^/(.*)$ /<slug>/$1 break` (le chemin
      préfixé reste la clé des `routeRules`/records SSR — cf. D3) ;
    - bloc **admin** : `proxy_pass` **sans** réécriture (les records `bare-*` servent le nu ;
      le strip `/admin/…` → nu est la seule redirection) ;
    - `proxy_set_header Host $host` : requis — le middleware (repli) et `parseSiteHost`
      lisent le vrai hôte ; en prod le middleware reste inerte (jamais vu de préfixé après strip).
- **Middleware Nitro `server/middleware/redirect-sous-domaines.ts` (repli + testable)** :
  fonction pure `cibleRedirection(host, chemin): string | null` (shared, unit-testée) →
  si hôte **connu** apex/www + chemin sous `/{slug}(/…)` → 301 stripé vers le sous-domaine ; si
  hôte = sous-domaine + chemin déjà préfixé par son slug → 301 vers le chemin nu ; si hôte =
  `admin.` + chemin sous `/admin` → 301 nu. `sendRedirect(event, url, 301)` (h3).
  **Aucune réécriture de path ici** (cf. D3) : ce middleware ne fait que répondre 301 — donc sûr.
  En dev/e2e, aucun hôte n'est connu → jamais déclenché (comportement inchangé).
  Couvre aussi le cas « app exposée sans Nginx » et rend le 301 **vérifiable par unit/e2e**
  (curl simulé via `parseSiteHost` + fonction pure, plutôt que prod-only).

### D6 — Slug courant : `useFilialeSlug()` + `useCurrentSiteSlug()` host-aware

- `app/composables/useFilialeSlug(): ComputedRef<FilialeSlug | null>` :
  `params.filiale` si `isFilialeSlug`, sinon slug du hôte si filiale, sinon `null`.
  Remplace les 3 fallbacks `String(route.params.filiale)` (index/contact/a-propos `nomCourt`).
- `app/composables/useCurrentSiteSlug()` (keystone — layout + services/realisations/mentions-legales
  l'utilisent déjà) : **mode `sous-domaine` → slug du hôte** ; mode chemin → premier segment (inchangé) ;
  hôte `admin` → `HOLDING_SLUG` (le layout public n'est pas rendu sur l'admin, fallback neutre).
- `app/composables/useSiteHost()` : enveloppe `useRequestURL().host` (serveur) / `location.host`
  (client) → `parseSiteHost`. Unique passerelle hôte côté app (testable via mocks unit).

### D7 — Nav et liens : helpers purs + composable

`shared/utils/site-links.ts` (purs, paramètres explicites → tests unit) :

- `siteHref(ctx, slugCible, path, hash?)` — résultat `{ to: string; externe: boolean }` :
  - **même site** → chemin relatif : mode chemin → `/${slug}${path}` (aujourd'hui), mode
    sous-domaine → `/${path}` (nu) ;
  - **site différent** :
    - hôte **connu** (prod) → `{ to: origine + chemin nu sur l'hôte cible + hash, externe: true }`
      (hôte cible via registre `SITE_HOSTS`, schéma de l'origine ; forme **nu** = canonique +
      zéro 301 de strip à l'arrivée — `<a>`/NuxtLink externe → navigation complète ;
      exécution 2026-10-21 : divergente du préfixé littéral, alignée sur D9) ;
    - hôte **inconnu** (dev/e2e) → `{ to: '/<slugCible>…', externe: false }` → SPA → **suite e2e
      inchangée** ;
  - exception : chemins **partagés entre sites** (`/confidentialite`) → toujours relatif
    (résolus nativement sur tous les hôtes, cf. matrice).
- `siteAbsoluteUrl(origin, slug, path?)` = origine + **chemin nu** sur l'hôte cible (forme
  canonique, coïncide avec `canonicalPath` — tests unit). À n'émettre que si hôte connu (D1).
- `adminHref(path)` : hôte `admin` → strip le préfixe `/admin` (`/admin/utilisateurs` →
  `/utilisateurs`), sinon tel quel. Le **prompt `publicNav`/`ADMIN_NAV` reste en chemins
  préfixés** (source unique inchangée) ; la traduction se fait au rendu.
- Inventaire des points de traduction : `app/layouts/default.vue` (map `publicNav` → `siteHref`),
  `HoldingFiliales`, `SiteFooter` (liste filiales + mentions-legales), `FilialeServicesApercu`,
  `FilialeRealisationsApercu`, `ReservationForm`, `ccdpaa/restaurant.vue` (les 2 liens codés en dur
  `/ccdpaa/contact`), `AdminSidebar`/`AdminHeader` (`ADMIN_NAV` + logo `/` → `adminHref`),
  `admin/index.vue` (4 `{path:'/admin/messages'}`), `navigateTo` admin (D8).
  Inchangés : `SiteHeader` logo `/` et `SiteMaintenance` `to="/"` (chemin racine → dispatcher),
  `MentionConfidentialite`/`CandidatureForm` `/confidentialite` (partagé).

### D8 — Admin : chemins nus homogènes

- Routes nues (D4) + `adminHref` au rendu (D7) + cibles `navigateTo` normalisées via
  **`toAdminPath(path)`** (`app/utils/admin-path.ts`, wrapper de `adminHref` sans dépendance hôte
  — lit `useSiteHost`) : `middleware/admin.ts` (comparaisons `ADMIN_LOGIN_PATH`/`ADMIN_HOME_PATH`
  **et** cibles), `utils/admin-unauthorized.ts`, `stores/auth.ts`,
  `pages/admin/{login,comptable/index,placement/index}.vue`.
- `safeAdminRedirect` (`app/utils/safe-redirect.ts`) : accepte désormais la cible **nu ou préfixé**
  (regex élargie : `/admin…` **ou** chemin admin connu via liste `ADMIN_NAV`/pages nues) et
  **normalise toujours vers la forme servie sur l'hôte courant** (strip en mode admin) ;
  `tests/unit/safe-redirect.test.ts` mis à jour (anti open-redirect conservé : `//`, `\`, login).
- `isNavItemActive(item, path)` : recevoir `adminHref(item.to)` et le path courant (nu en mode
  admin) → comparaison homogène ; `tests/unit/admin-nav.test.ts` complété.
- Login/logout/session : **même origine `admin.`** → SameSite=Strict + hôte seul, aucun `Domain`
  de cookie → aucun changement (session jamais partagée entre hôtes ; les sites publics n'ont
  pas de session).

### D9 — SEO : canonical + og:url + JSON-LD

- Émetteur unique : **`app/layouts/default.vue`** (toutes les pages publiques, aucun titre admin) :
  `useHead({ link: [{ rel: 'canonical', href }] })` + `useSeoMeta({ og:url })` via helper
  **`canonicalPath(route, host)`** (shared, pur) : origine = `useRequestURL().origin` (serveur) /
  `location.origin` (client) ; chemin = chemin courant **stripé du préfixe de site en mode
  sous-domaine** (en prod, Nginx a réécrit : `route.path` = `/entretien/services` → canonical =
  `https://entretien.chauvierdelor.com/services`) — **jamais** `useRequestURL().pathname` brut
  (il contiendrait le préfixe réécrit). Mode chemin → canonical = chemin courant (comportement
  inchangé hors dev où on peut omettre — règle : canonical émis seulement si hôte connu D1,
  pour ne pas polluer localhost/robots des dev).
- JSON-LD `JobPosting` (`placement/offres/[uuid].vue`) : **ajouter** `url` (canonical de l'offre —
  grep : aucune URL absolue n'est émise aujourd'hui). `mainEntityOfPage` non ajouté (non requis).
- Pas de `x-default`, pas de sitemap dans ce lot (documenté comme limite).

### D10 — ISR / payload : verrous documentés, aucun changement de règles

- `routeRules` **inchangés** (tous préfixés + racine) ; les chemins nus n'ont **aucune règle `isr`**
  → même si l'ISR devient actif plus tard, les clés nues ne sont jamais mises en cache ⇒ pas de
  poisonnement inter-filiales en e2e nu ; en prod, Nginx sert préfixé → clé = préfixe = unique par
  site (= partagée avec le mode chemin, ce qu'on veut, la holding n'étant plus servie sous ces
  chemins : 301 D5).
- `/_payload.json` : Nuxt duplique automatiquement ces règles (constat D3) — vérifs T3 :
  le prefetch éventuel d'un href préfixé depuis un sous-domaine est **stripé au edge (301)**
  puis servi via le rewrite bare→préfixé (200, un seul tour) — jamais un double rewrite (404).
- `invalidatePublicPages()` inchangé (filet).

## Découpage

### T0 — Shared/helpers/validations + tests unit + spike

| Fichier | Action |
|---|---|
| `shared/config/site-hosts.ts` | créer — `SITE_HOSTS`, `parseSiteHost`, types |
| `shared/utils/site-links.ts` | créer — `siteHref`, `siteAbsoluteUrl`, `adminHref`, `canonicalPath`, `cibleRedirection`, `toAdminPath` (purs) |
| `app/composables/useSiteHost.ts` | créer — passerelle `useRequestURL`/`location` → `parseSiteHost` |
| `app/composables/useFilialeSlug.ts` | créer |
| `tests/unit/site-hosts.test.ts` | créer — 9 hôtes, port retiré, casse, `*.localhost`, hôte inconnu, IPv4 |
| `tests/unit/site-links.test.ts` | créer — same-site/cross-site × (chemin, sous-domaine, dev), `siteAbsoluteUrl`, `adminHref`, `canonicalPath` (préfixé stripé), `cibleRedirection` (apex, sous-domaine déjà nu, admin, non-concerné) |
| `tests/unit/safe-redirect.test.ts` | modifier — normalisation nu/préfixé + régressions open-redirect |
| — | **T0.0 spike D3** (procédure 10 min) : noter le Go/No-Go en tête de spec avant T2 |

Critère T0 : `pnpm exec vitest run tests/unit/site-hosts.test.ts tests/unit/site-links.test.ts tests/unit/safe-redirect.test.ts`.

### T1 — Backend Nitro : middleware 301 (repli)

| Fichier | Action |
|---|---|
| `server/middleware/redirect-sous-domaines.ts` | créer — `parseSiteHost` → `cibleRedirection` → `sendRedirect(…, 301)` ; **aucune réécriture de path** (commentaire citant le spike) |
| `tests/unit/…` (couvert par `cibleRedirection` T0) + test d'intégration middleware via `tests/nuxt` | créer si le pattern `tests/nuxt` existant le permet (h3 `toNodeListener` + hôte factice) — sinon couverture pure T0 + constat prod T4 |

Rien d'autre côté serveur : `routeRules`, `/api/**`, zod, `requireRole` **inchangés** (pas de nouvelle route API → aucune validation à ajouter).

### T2 — Frontend : routes nues, dispatchers, slug, nav, SEO

| Fichier | Action |
|---|---|
| `modules/bare-routes.ts` | créer — hook `pages:extended` (6 publiques + 24 admin) |
| `nuxt.config.ts` | modifier — `modules: […, './modules/bare-routes.ts']` |
| `app/site-pages/holding/{index,a-propos,contact,realisations}.vue` | créer — contenu déplacé depuis `app/pages/…` (inchangé à l'identique) |
| `app/pages/{index,a-propos,contact,realisations}.vue` | modifier → dispatchers (`<component :is>`, imports synchrone, slug via `useFilialeSlug`) |
| `app/pages/[filiale]/{index,services,a-propos,contact,realisations,mentions-legales}.vue` | modifier — `validate` host-aware (6), fallbacks `nomCourt` → `useFilialeSlug()` (3) |
| `app/pages/{placement/offres/*,ccdpaa/restaurant}.vue` | modifier — `validate` (bare + préfixé) sur les 4 ; `JobPosting.url` dans `[uuid].vue` |
| `app/plugins/admin-routes.ts` | créer — `removeRoute` publics si hôte `admin` (+ re-résolution de sécurité) |
| `app/composables/useCurrentSiteSlug.ts` | modifier — host-aware (D6) |
| `app/layouts/default.vue` | modifier — `nav` via `siteHref` (map), canonical + og:url (D9) |
| `app/utils/admin-path.ts` | créer — `toAdminPath` |
| `app/utils/safe-redirect.ts` | modifier — D8 |
| `app/middleware/admin.ts` | modifier — comparaisons/cibles mode-aware |
| `app/utils/admin-unauthorized.ts`, `app/stores/auth.ts` | modifier — cibles via `toAdminPath` |
| `app/pages/admin/{login,comptable/index,placement/index,index}.vue` | modifier — `navigateTo`/`:to` nu (index : 4 × `/admin/messages`) |
| `app/components/admin/{AdminSidebar,AdminHeader}.vue` | modifier — `adminHref` items + logo |
| `app/components/site/SiteFooter.vue` | modifier — liste filiales (holding → inter-sites) + lien mentions-legales via `siteHref` |
| `app/components/site/accueil/HoldingFiliales.vue` | modifier — `:to` via `siteHref` |
| `app/components/site/filiale/{FilialeServicesApercu,FilialeRealisationsApercu}.vue` | modifier — `/${slug}/…` via `siteHref` (nu en sous-domaine) |
| `app/components/site/restaurant/ReservationForm.vue`, `app/pages/ccdpaa/restaurant.vue` | modifier — liens `/ccdpaa/contact` via `siteHref` |
| `tests/unit/admin-nav.test.ts` | modifier — rendu `adminHref` si couvert |

Inventaire **vérifié inchangé** (piège documenté) : `SiteHeader.vue` (logo `/`), `SiteMaintenance.vue`
(`to="/"`), `MentionConfidentialite.vue`, `CandidatureForm.vue` (`/confidentialite` partagé),
`ADMIN_NAV`/`publicNav` (restent préfixés = source unique), `playwright.config.ts`, toutes les
routes `/api/**`.

### T3 — e2e dédié + régressions

| Fichier | Action |
|---|---|
| `tests/e2e/sous-domaines.spec.ts` | créer (projet **desktop** par défaut — config intouchée) |

Tests (navigateur = Brave via `PW_CHROMIUM_PATH`, build prod sur :3200) :

1. `page.goto('http://entretien.localhost:3200/services')` → 200 + H1 + slug entretien
   (Chromium résout `*.localhost` → 127.0.0.1, aucun DNS) ;
2. **dispatcher** : `http://entretien.localhost:3200/a-propos` → contenu filiale (pas holding) ;
   idem `/`, `/contact`, `/realisations` ;
3. **lien SPA nu** : depuis `/services`, clic nav « Contact » → URL `/contact` sans rechargement
   complet (suivi `page.on('framenavigated')` : même document) ;
4. **partagé** : `/confidentialite` sur `entretien.localhost` → 200 holding ;
5. **gate mode chemin** : `localhost:3200/services` → 404 (régression du brief) ;
6. **admin nu** : `http://admin.localhost:3200/utilisateurs` non connecté → redirection vers
   `/login` **nu** ; `http://admin.localhost:3200/` → dashboard (si connecté) — cookie de session
   sur l'hôte `admin.localhost` (login dédié ou skip si trop coûteux : au minimum 1 login) ;
7. **301** : non testable en e2e (dev = mode chemin, aucun hôte connu) → couverture
   **unit** (`cibleRedirection`) + **vérification manuelle prod** (`curl -I`, checklist runbook T4) ;
8. régression : `pnpm exec playwright test tests/e2e/filiale-services.spec.ts tests/e2e/home.spec.ts`
   **sans modification**.

### T4 — Vérifications complètes, revues, captures, PROJECT_STATE

1. `pnpm typecheck` → 0 erreur.
2. `pnpm test:unit` (relance `pnpm exec vitest run --maxWorkers=2` si flakés sous charge — Outillage).
3. **Un seul** `pnpm build:check` (boot prod : vérifier que le build embarque bien
   `modules/bare-routes` → `grep` des chemins nus dans `.nuxt/routes.mjs`).
4. e2e complet (nouveau + suite existante).
5. **Revue reviewer** (+ **ux-reviewer** : nav/liens/pied de page touchés) — 0 CRITICAL / 0 MAJOR.
6. Captures 375/768/1440 de `entretien.localhost` bare (accueil + services) et `admin.localhost`
   nu, script type `scripts/capture-lot7-mentions.mjs` → `conversion-captures/lot8-nuxt/`
   (non versionné).
7. Mise à jour **`PROJECT_STATE.md`** :
   - ligne checklist nouvelle : `| Mise en prod / sous-domaines (lot 8) | 🔧 → ✅ | spec docs/specs/lot8-sous-domaines.md, runbook docs/runbook-prod.md |` ;
   - entrée journal concise (décisions D1-D10, divergence middleware→Nginx, constat ISR inert,
     fichiers, chiffres de tests) ;
   - « Prochaine étape recommandée » : déploiement réel VPS suivant le runbook (DNS → certbot →
     PM2 → checklist curl) ;
   - **correction du constat ISR** : les lignes existantes qui présentent l'ISR comme actif
     (`cache:nitro:routes` purge) sont à annoter « inert sur nitropack 2.13.4 (constat D3-C3) ».

## Écarts / limites assumés

- Pas de sitemap/`robots.txt` multi-hôtes ni `hreflang` (7 sites, langues identiques — hors périmètre).
- La purge ISR (`invalidatePublicPages`) reste un no-op tant que `isr` → `swr` ne sera pas basculé
  (décision explicite de ne pas toucher à ça dans ce lot).
- `/services` etc. sur l'apex → 404 (validate) : cohérent (le canonical pointe sous-domaine,
  pas de contenu dupliqué) mais aucun 301 apex→sous-domaine pour ces chemins nus (ils n'ont
  jamais existé en préfixe depuis l'extérieur autrement que `/{slug}/services` → 301 ✓).
- Session admin non invalidée entre hôtes différents impossible (cookies host-only) — sans objet.
- Le dispatcher des 4 pages racine importe la variante filiale en synchrone : le chunk de la page
  filiale est ainsi inclus dans le chunk de la page holding correspondante (poids négligeable,
  pages partageant déjà le socle).
- `*.localhost` : valide Chromium/Firefox, pas Safari — e2e = Brave/Chromium ici ✓.

## Risques

| # | Risque | Impact | Plan |
|---|---|---|---|
| R1 | **Ordre ISR/réécriture** (n°1 du brief) | clé de cache incohérente si cache activé + réécriture ratée silencieusement | D3 source-lu + spike 10 min ; réécriture **Nginx** (indépendante de h3) ; plans B (plugin `h3App.handler`) / C (`routeRules.proxy`) |
| R2 | Plugin `admin-routes` exécuté après la navigation initiale serveur | `/` nu SSR `admin.localhost` pourrait rendre la holding | vérif T2 (ordre `app:created`), fallback re-`router.replace` ; **prod non affectée** (Nginx réécrit `/` → `/admin`) |
| R3 | Hydration des dispatchers (SSR `[filiale]` vs client dispatcher) | warning hydration, re-render | imports synchrone + même slug (param ≡ hôte) ; e2e T3-2 hydratée (pas de warning console asserté) |
| R4 | Dérive Nginx ↔ pages (exception oubliée) | 404 en prod | liste d'exceptions générée à partir de `SITE_HOSTS`/pages dans le runbook + checklist curl T4 (6 pages × hôtes) |
| R5 | Double rewrite des href préfixés (prefetch payload) | 404 assets/payload | **strip 301 au edge** `^~ /<slug>/` (D5 ajout 2026-10-21) + test curl T4 |
| R6 | Suite existante verte « sans modification » | régression conversion | mode chemin inchangé par construction (aucun record nu résout, aucun middleware actif) + régression e2e T3-8 obligatoire |
| R7 | 301 stripé ≠ lecture littérale du brief | SEO | divergences documentées (§tête) — l'utilisateur tranche après relecture |

## Exécution (ordre des commandes)

```bash
# T0
#   1. spike D3 (10 min) → noter Go/No-Go en tête de spec
pnpm exec vitest run tests/unit/site-hosts.test.ts tests/unit/site-links.test.ts tests/unit/safe-redirect.test.ts
pnpm typecheck

# T1 + T2
pnpm typecheck
pnpm exec vitest run --maxWorkers=2        # unit complet (799+ existants + nouveaux)

# T3 (build prod une seule fois puis e2e)
pnpm build:check                            # ou pnpm build
PORT=3200 node --env-file=.env .output/server/index.mjs &   # fenêtre dédiée
PW_CHROMIUM_PATH=/opt/brave.com/brave/brave pnpm exec playwright test tests/e2e/sous-domaines.spec.ts
PW_CHROMIUM_PATH=/opt/brave.com/brave/brave pnpm exec playwright test   # suite complète (vert intégral)

# T4
pnpm typecheck && pnpm test:unit            # 0 échec
# revue reviewer + ux-reviewer (diff) → correctifs regroupés → UN rebuild si touché
node scripts/capture-lot8-sous-domaines.mjs # captures 375/768/1440
# mise à jour PROJECT_STATE.md
# déploiement : docs/runbook-prod.md
```
