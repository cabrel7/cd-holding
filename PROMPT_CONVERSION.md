# Prompt d'orchestration — Conversion du prototype vers le produit Nuxt

**À qui s'adresse ce prompt** : au système multi-agent, une fois `PROMPT_SETUP_NUXT.md` et `PROMPT_AJUSTEMENTS_POST_SETUP.md` exécutés et vérifiés (voir `PROJECT_STATE.md`, section Avancement — les deux doivent être ✅ avant de commencer ici).

**Ce que ce prompt couvre** : la totalité de la conversion du prototype React (Lovable) vers le produit Nuxt final, en 3 phases strictement séquentielles. Ne pas sauter de phase, ne pas les mélanger.

Avant de commencer : lire `PROJECT_CONTEXT.md`, `PROJECT_STATE.md` et `CLAUDE.md` en entier. Ce prompt ne répète pas les règles non négociables (design, sécurité, identifiants) déjà verrouillées dans `CLAUDE.md` — il décrit la méthode de travail, `CLAUDE.md` reste la référence pour le "comment coder".

## Mise à jour des fichiers de base (à faire au fil de l'exécution, pas après)

Ce prompt couvre des mois de travail — des décisions vont forcément apparaître en cours de route (un écart détecté en phase 1, un choix fait en posant les fondations de phase 2, une règle affinée pendant la conversion d'une filiale). Chacune est reportée dans les fichiers de base du dépôt local **au moment où elle est prise**, jamais laissée seulement dans le code ou dans la tête de l'agent qui l'a prise :

- Une règle qui doit s'appliquer à toute route future (une contrainte de design découverte en convertissant la 1ʳᵉ filiale, une vérification qui s'avère nécessaire, un pattern de composant à généraliser) → ajoutée dans la section appropriée de `CLAUDE.md`.
- Un écart détecté en phase 1, une décision d'architecture prise en phase 2, un statut de route → noté dans `PROJECT_STATE.md` (checklist, "Décisions encore ouvertes" ou "Décisions verrouillées récemment", selon le cas).

Ces deux fichiers sont modifiés directement dans le dépôt local par l'agent qui exécute ce prompt, section par section, au fur et à mesure — ils ne sont pas régénérés depuis la conversation Claude. Si une décision semble dépasser le cadre de ce prompt (elle remet en cause un choix de `PROJECT_CONTEXT.md`, par exemple), elle est documentée dans `PROJECT_STATE.md` comme décision ouverte plutôt que tranchée seule.

---

## Pourquoi 3 phases et pas une conversion directe route par route dès le départ

Convertir route par route dès le premier jour, sans étape préalable, produit deux problèmes concrets sur un projet à 6 filiales quasi-identiques dans leur structure : (1) chaque filiale réinvente légèrement différemment les mêmes composants CMS (liste + formulaire + suppression), ce qui devient un cauchemar à maintenir dès la deuxième filiale ; (2) le contenu réel déjà écrit et validé par le client pendant le prototypage (`mockdata.ts`) risque d'être retapé à la main route par route, avec le risque de transcription et la perte de temps que ça implique. Les phases 1 et 2 ci-dessous existent pour éliminer ces deux risques une fois pour toutes, avant que la conversion route par route ne démarre.

---

## Phase 1 — Analyse complète du prototype (aucun code produit)

**Objectif** : produire un unique document, `CONVERSION_INVENTORY.md`, à la racine du dépôt. Rien d'autre n'est écrit pendant cette phase — pas de composant Vue, pas de route API, pas de modification du schéma Prisma.

**Méthode** :

1. Parcourir systématiquement `prototype_react/` (le code) et https://cd-holding-nexus.lovable.app/ (le rendu réel) route par route, dans l'ordre de la checklist de `PROJECT_STATE.md`.
2. Pour chaque route, capturer avec Playwright les 3 breakpoints (375/768/1440) et les sauvegarder dans `conversion-captures/<route>/` — ce sont les références visuelles utilisées en phase 3 pour vérifier chaque conversion, pas besoin de les reprendre à ce moment-là.
3. Inspecter `mockdata.ts` pour lister, pour chaque entité utilisée par la route, les champs réellement présents dans les objets mock (pas seulement ceux qu'on imagine) — c'est ce qui permet de vérifier que le schéma Prisma actuel les couvre tous.
4. Noter les interactions de la route : formulaires (et leurs champs exacts), filtres, onglets, modaux, éléments chorégraphiés (animations d'entrée, transitions).

**Livrable — structure de `CONVERSION_INVENTORY.md`** :

```markdown
## <Route>

- **Composants clés** : ...
- **Entités de données utilisées** (avec les champs réels vus dans mockdata.ts) : ...
- **Interactions** : formulaires (champs, validation attendue), filtres, onglets, modaux
- **Endpoints API nécessaires** : méthode + chemin + ce qu'ils font
- **Écart avec `prisma/schema.prisma`** : aucun / description précise
```

Une section finale `## Écarts détectés` récapitule tous les écarts trouvés (champ manquant sur un modèle, entité non prévue, etc.).

**Règle d'arrêt** : si `## Écarts détectés` n'est pas vide, ne pas modifier le schéma Prisma seul — signaler les écarts et attendre confirmation avant de passer à la phase 2. Un schéma changé en silence au milieu de la conversion est une source classique de désynchronisation entre les filiales déjà converties et celles qui ne le sont pas encore.

---

## Phase 2 — Fondations communes (une seule fois, avant toute route de filiale)

**Objectif** : poser une seule fois ce que les 6 filiales vont toutes réutiliser, pour que la phase 3 soit répétitive et rapide plutôt que créative à chaque route.

1. **Layout et navigation du socle design** : header/nav/footer communs à la holding et aux 6 filiales, avec la couleur d'accent de la filiale injectée dynamiquement (voir `PROJECT_CONTEXT.md` §6 pour la table des accents). Un seul composant de layout, pas six variantes.
2. **Composants CMS génériques réutilisables** : un composant de liste + `Dialog` de formulaire + `AlertDialog` de suppression + `toast` de confirmation, paramétrable pour fonctionner avec `services`, `realisations`, `equipe` et `partenaires` sans dupliquer la logique à chaque filiale. C'est le composant le plus réutilisé du dashboard — il mérite d'être fait une fois, bien.
3. **Composable générique d'accès aux données admin** (ex. `useAdminResource<T>(endpoint)`) qui encapsule le fetch/mutation via `$fetch`, la gestion des `uuid` dans les URLs (jamais d'id numérique — voir `CLAUDE.md`), et le retour d'erreur générique consommé par le `toast`.
4. **Convention de tests** (l'outillage — Vitest, `@nuxt/test-utils`, Playwright — a été installé dans `PROMPT_AJUSTEMENTS_POST_SETUP.md`, section 0) : `tests/unit/` pour les composables et schémas zod, `tests/e2e/` pour les parcours critiques en Playwright. Écrire dès cette phase le premier test e2e réel (pas juste une capture d'écran) sur le layout commun — par exemple : la navigation change bien de couleur d'accent selon la filiale. C'est le gabarit que chaque route de la phase 3 reprend.
5. **Contenu réel dans le seed, pas à la main** : le contenu par filiale (services, réalisations, partenaires) a déjà été écrit et validé par le client pendant le prototypage Lovable — il vit dans `mockdata.ts`. Écrire un script ponctuel (`scripts/migrate-mockdata-to-seed.ts`, supprimable après usage) qui lit les objets de `mockdata.ts` et génère les upserts Prisma correspondants (`Service`, `Realisation`, `Partenaire`, `MembreEquipe`) rattachés aux bons `Company` par `slug`. Le retaper à la main dans `prisma/seed.ts` serait une perte de temps et une source d'erreurs de transcription pour un contenu qui existe déjà, correct, quelque part.
6. **Vérifier que la gestion centrale des erreurs et le pattern id/uuid (phase précédente, `PROMPT_AJUSTEMENTS_POST_SETUP.md`) sont bien en place** avant de construire dessus.

**Vérification avant de passer en phase 3** : appliquer ces fondations à un cas réel (par exemple la page `/a-propos` de la holding, qui utilise déjà le layout, le composant CMS admin sur `equipe`/`partenaires`, et le contenu seedé) et confirmer que ça fonctionne de bout en bout — pas seulement en théorie.

---

## Phase 3 — Conversion route par route

**Ordre** : Holding d'abord (l'auth et les fondations communes y sont exercées une première fois en conditions réelles), puis les 6 filiales dans l'ordre de `PROJECT_STATE.md` (`entretien` → `transport` → `comptable` → `placement` → `ccdpaa` → `boissons`).

**Pour chaque route** :

1. Relire l'entrée correspondante de `CONVERSION_INVENTORY.md` (phase 1) et la capture Playwright associée.
2. Implémenter la page Vue **et** câbler directement le(s) endpoint(s) API Nitro/Prisma nécessaires dans la même passe — jamais de version avec données statiques ou mockées à reconnecter plus tard. Le backend et le frontend de la route se construisent ensemble.
3. Réutiliser systématiquement les fondations de la phase 2 (layout, composants CMS, composable de fetch) plutôt que d'improviser une variante locale.
4. Appliquer la table de correspondance React → Vue (`PROJECT_CONTEXT.md` §9) et toutes les règles non négociables de `CLAUDE.md` (design, identifiants uuid, validation zod serveur, scoping par rôle/filiale).
5. **Vérifier avant de marquer la route terminée — aucune de ces étapes n'est optionnelle** :
   - `pnpm typecheck` passe sans nouvelle erreur.
   - Test unitaire (`tests/unit/`) sur toute nouvelle logique testable isolément : schéma zod de la route, fonction de calcul/formatage, composable — pas nécessaire pour un composant purement visuel sans logique.
   - Test e2e Playwright (`tests/e2e/`, pas juste une capture d'écran) sur le parcours critique de la route : soumission de formulaire, action CRUD, changement d'état — avec de vraies assertions (le message de succès apparaît, l'enregistrement existe bien en base ensuite), pas seulement "la page s'affiche".
   - Capture Playwright aux 3 breakpoints, **comparée à la fois à la référence figée de phase 1 ET à une vérification visuelle en direct sur https://cd-holding-nexus.lovable.app/** (la route correspondante du prototype hébergé) — la capture de phase 1 peut dater de plusieurs semaines, le site hébergé reste la référence vivante. Objectif : cohérence et netteté du design (alignements, espacements, typographie, qualité des images) au moins équivalentes au prototype, pas seulement "ça y ressemble". Tout écart trouvé est corrigé avant de passer à la suite, pas seulement noté pour plus tard. Capture vidéo ffmpeg en plus pour les éléments chorégraphiés (visuel — ne remplace pas les assertions du point précédent).
   - **Test contre le build de production**, pas seulement `nuxt dev`, pour toute route qui touche une route API, un formulaire ou l'upload de fichier : `nuxt build`, démarrer le serveur buildé, rejouer le test e2e de cette route contre cette instance. C'est ce qui distingue "ça a l'air de marcher" de "ça marche vraiment" — une route qui passe en dev peut échouer en build de prod (hydratation SSR différente, variable d'environnement absente, comportement ISR des `routeRules` sur les pages publiques).
   - **Revue de code** de la route avant de la marquer ✅ : relecture du diff contre `CLAUDE.md` (design, id/uuid, zod serveur, scoping rôle/filiale, pas de `console.log`/`alert`/`confirm` oublié) — par un agent qui n'a pas écrit cette route quand c'est possible, pour ne pas noter son propre travail.
6. Mettre à jour `PROJECT_STATE.md` **dans le dépôt local** (statut de la ligne, ✅ uniquement une fois toutes les vérifications du point 5 passées) avant de passer à la route suivante.

**Une route à la fois, jamais un lot.** Le risque de dérive/hallucination augmente avec la taille du batch — c'est la même raison qui avait motivé le découpage des prompts Lovable en plusieurs étapes pendant le prototypage.

**Pourquoi ces vérifications ne sont pas optionnelles** : sans test automatisé ni build de production testé, la seule information disponible est "ça s'affichait correctement quand je l'ai regardé en dev" — ce qui ne dit rien de si le code reste correct après la route suivante (régression silencieuse, pas de test pour l'attraper), ni s'il tient en production (le build de prod change des choses que `nuxt dev` ne teste pas). Les deux trous que ça permet d'éviter : découvrir un bug en prod qui n'existait pas en dev, et casser une route déjà convertie sans s'en rendre compte en construisant la suivante.

**En cas d'ambiguïté** entre ce que montre le prototype et ce que décrit `PROJECT_CONTEXT.md` (notamment les retours client post-démo qui y sont intégrés mais que le prototype affiché ne reflète pas toujours), `PROJECT_CONTEXT.md` fait foi. En cas de doute réel non tranché par les documents existants, le documenter dans `PROJECT_STATE.md` plutôt que de trancher seul silencieusement.

---

## Fin de la conversion

Une fois toutes les routes de `PROJECT_STATE.md` à ✅ :

1. **Régression complète** : `pnpm typecheck` et `pnpm test:unit` sur l'ensemble du projet, puis `pnpm build:check` (build de production réel) suivi d'un passage e2e Playwright complet contre cette instance buildée, pas seulement route par route comme en phase 3 — l'objectif est d'attraper une interaction entre deux routes que les vérifications isolées n'auraient pas révélée.
2. **Revue globale de cohérence et de netteté du design**, sur l'ensemble des 6 filiales et pas seulement route par route isolément : parcourir méthodiquement chaque route de https://cd-holding-nexus.lovable.app/ et sa contrepartie convertie côte à côte, vérifier que le socle visuel (§6 de `PROJECT_CONTEXT.md`) reste cohérent d'une filiale à l'autre (même qualité de finition partout, pas une filiale mieux soignée que les autres parce que convertie en dernier avec plus d'expérience accumulée), et corriger tout écart trouvé avant de considérer la conversion terminée.
3. Reprendre les items différés au déploiement listés dans `PROJECT_STATE.md` ("Reste à faire") : `nuxt-security` (HSTS/CSP), configuration nginx (`X-Forwarded-For`, écoute `127.0.0.1`), pagination des listes admin qui le nécessitent.
4. Mise en place VPS (PM2, Caddy/Nginx + certbot) selon `PROJECT_CONTEXT.md` §4 et §10.
