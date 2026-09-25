# PROJECT_CONTEXT.md — Groupe CD

Ce document est la source de vérité métier et architecturale du projet. Tout agent (ou humain) qui reprend ce dépôt doit le lire avant de toucher au code. Il ne change pas souvent — pour le suivi au jour le jour, voir `PROJECT_STATE.md`. Pour les règles de travail dans le dépôt, voir `CLAUDE.md`.

## 1. Le projet en une phrase

Un écosystème numérique pour une holding montréalaise et ses 6 filiales : un site vitrine par entité, un dashboard central pour gérer le contenu et les opérations de chaque filiale, avec permissions par rôle.

## 2. Contexte métier

Le "Groupe CD" (nom de travail — remplacer partout si un nom officiel est choisi) est détenu par un actionnaire majoritaire unique, basé à Montréal (Québec), avec 6 filiales enregistrées sous la Loi canadienne sur les sociétés par actions :

| Filiale | Slug | Activité |
|---|---|---|
| Chaudetcha Entretiens et Sanitations | `entretien` | Entretien ménager résidentiel et commercial |
| Chaudetcha Transport et Logistique | `transport` | Transport de marchandises, déménagement, logistique |
| CD Tenue de Livre Comptable | `comptable` | Comptabilité, paie, déclarations fiscales, création et régularisation d'entreprise |
| Placement CD Pro | `placement` | Placement de personnel + recrutement de travailleurs étrangers temporaires |
| CCDPAA | `ccdpaa` | Import-export de produits agricoles d'Afrique + restaurant "Les Ambassades d'Afrique" |
| CD Boissons d'Afrique | `boissons` | Représentation et distribution de marques de boissons |

Chaque filiale garde son identité propre (accent couleur, contenu) mais partage un socle visuel commun avec la holding (voir §6).

## 3. Historique du projet

1. **Prototypage visuel en React**, construit par itérations dans Lovable (mockdata en dur, pas de backend réel). Prototype hébergé à **https://cd-holding-nexus.lovable.app/**. Le code source exporté vit dans le dossier local `prototype_react/`.
2. **Décision de conversion** : le prototype React valide le design et les parcours utilisateurs, mais le produit réel se construit en **Nuxt 4 full-stack** (voir §4 pour le pourquoi). Le prototype React n'est **pas** repris tel quel — il sert de référence fonctionnelle et visuelle pendant la conversion, filiale par filiale.
3. **Statut actuel** : décisions d'architecture prises, scaffolding du projet Nuxt en cours. Voir `PROJECT_STATE.md` pour l'avancement réel.

## 4. Décisions d'architecture (et pourquoi)

| Décision | Choix | Raison |
|---|---|---|
| Rendu | Nuxt 4, rendu hybride via `routeRules` | Les pages publiques (holding + 6 filiales) doivent être SSR/ISR pour le SEO. Les `/admin/**` (dashboards) sont en SPA (`ssr: false`) — pas de gain SEO à y perdre, et ça simplifie l'état client (auth, données temps réel) |
| Backend | Nitro (`server/api/`), même projet que le front | Un seul langage (TypeScript) du front au back, types partagés, un seul déploiement |
| ORM | **Prisma** (décidé) | Migrations versionnées, client typé généré, requêtes paramétrées par défaut (protection injection SQL sans y penser) |
| Base de données | PostgreSQL | Standard, robuste, supporte les tableaux natifs (utile pour `autresDocumentsKeys` sur les candidatures) |
| Auth | `nuxt-auth-utils` (cookies scellés, session serveur) | Suffisant pour 3 rôles internes, pas besoin d'un service d'auth externe à ce stade |
| État client (dashboards) | Pinia | Remplace le Context API du prototype React |
| Validation formulaires | VeeValidate + zod | Équivalent Vue de `react-hook-form` + zod utilisé dans le prototype ; **zod aussi côté serveur**, sur chaque route API, jamais seulement côté client |
| UI Kit | shadcn-vue + Tailwind CSS | Équivalent Vue de shadcn/ui utilisé dans le prototype — mêmes composants, mêmes noms, portage direct |
| Icônes | @lucide/vue | Équivalent Vue de lucide-react déjà utilisé dans le prototype |
| Animations | `<Transition>` natif Vue, `@vueuse/motion` si besoin de plus | Remplace framer-motion |
| Stockage fichiers (CV, documents, images) | `unstorage` (intégré à Nitro), driver `fs` en local | Abstraction — migration vers S3/R2 plus tard = changement de config uniquement, aucun code applicatif à réécrire. Voir §8 |
| Hébergement | VPS (pas de serverless) | Nécessaire pour que le stockage `fs` fonctionne (disque persistant). Process manager : PM2. Reverse proxy : Caddy ou Nginx + certbot |

## 5. Modèle de rôles

Trois rôles, définis dans `User.role` :

- **`super_admin`** — accès à toutes les filiales, tout le contenu, tous les modules du dashboard.
- **`admin_filiale`** — accès uniquement à sa propre filiale (`User.companyId`), à son contenu et à son module métier.
- **`employe`** — accès en lecture seule à son propre planning uniquement (`/admin/mon-planning`).

Toute route `/admin/**` doit vérifier la session ET le rôle/filiale avant de renvoyer des données — jamais de filtrage côté client uniquement.

## 6. Système de design (non négociable)

Contraintes établies et validées pendant le prototypage — à respecter dans la conversion Nuxt, pas seulement dans le prototype React :

- Aucun dégradé (gradient) nulle part.
- Aucun badge/pill décoratif sans fonction réelle (un badge n'affiche qu'un vrai statut : lu/non lu, statut de dossier, statut de candidature, etc.).
- @lucide/vue réservé aux icônes fonctionnelles ; sur les pages marketing, préférer images/formes/courbes à l'accumulation d'icônes.
- Pas de grilles de cartes génériques répétitives — mise en page éditoriale, variée section par section.
- Aucun `alert()`, `confirm()` ni `console.log()` dans le dashboard — Dialog/AlertDialog + toast partout.
- Landing pages pensées pour convertir : proposition de valeur claire, preuve de confiance, CTA net.

**Socle visuel du groupe** : navy `#1B2A4A` + or `#C9A227`, fond clair `#F5F3EE`, texte `#2C2C2A`, typographie Poppins (titres) + Inter (texte). Chaque filiale garde ce socle et ajoute sa propre couleur d'accent :

| Filiale | Accent |
|---|---|
| Entretien | `#0F6E56` (teal) |
| Transport | `#D85A30` (orange) |
| Comptable | `#185FA5` (bleu acier) |
| Placement | `#D4537E` (corail) |
| CCDPAA | `#BA7517` (terracotta) |
| Boissons | `#A32D2D` (bordeaux) |

Structure de pages par filiale (5 pages + 1 pour CCDPAA) : Accueil, Services, Réalisations, À propos (regroupe équipe + partenaires), Contact — routes réelles, jamais d'ancre `#section`. CCDPAA a une 6ᵉ page dédiée : `/ccdpaa/restaurant`.

## 7. Modèle de données (résumé — le détail exact est dans `prisma/schema.prisma`)

- `Company` — la holding + les 6 filiales (même table, champ `type` pour distinguer)
- `Service`, `MembreEquipe`, `Realisation`, `Partenaire` — contenu CMS par filiale
- `User` — comptes du dashboard (3 rôles)
- `MessageContact` — tous les formulaires de contact publics (y compris les suggestions de produit hors catalogue pour CCDPAA/Boissons)
- `ReservationRestaurant` — réservations du restaurant CCDPAA
- `Employe`, `PlanningEntry` — planning partagé (Entretien, Transport, restaurant CCDPAA)
- `Client`, `DossierComptable` — carnet clients CRM général ; `DossierComptable` étend un `Client` avec les champs propres à la filiale comptable (au lieu d'un modèle `clientsComptables` isolé et dupliqué)
- `Candidat` — vivier interne de candidats de l'agence Placement CD Pro
- `DemandeClient` — demandes de personnel des entreprises clientes, devient une offre d'emploi publique quand `publiee = true`
- `Candidature` — candidatures reçues via le site public (liées ou non à une `DemandeClient`)

- **Assistant Import-Export (CCDPAA)** : questionnaire guidé à 5 étapes avec recommandation calculée par une règle fixe (volume) — **explicitement pas une IA, aucun appel LLM** (retour client). Structure du questionnaire en code, textes d'introduction et de recommandation éditables.

## 8. Stockage de fichiers

Toute écriture/lecture de fichier (CV, documents, images de contenu) passe par `useStorage('uploads')` (driver `fs`, dossier hors de `public/`). Jamais de fichier servi statiquement sans passer par une route API qui vérifie la session. Clé de stockage = UUID généré côté serveur, jamais le nom de fichier fourni par l'utilisateur. Détail complet : voir le prompt de setup, section stockage.

## 9. Sources de conversion (à utiliser activement, pas juste pour référence passive)

- **Prototype React source** : dossier local `prototype_react/`
- **Prototype hébergé** : https://cd-holding-nexus.lovable.app/ — Playwright + ffmpeg sont installés localement pour capturer chaque route (captures par breakpoint 375/768/1440, vidéo courte sur les éléments avec chorégraphie : modaux, toasts, accordéon FAQ) avant de traduire une route en Vue
- **Table de correspondance React → Vue** à appliquer systématiquement :

| React (prototype) | Vue/Nuxt (cible) |
|---|---|
| `useState` | `ref` / `reactive` |
| `useEffect` | `onMounted` / `watch` |
| Context API | Pinia store |
| `react-hook-form` + zod | VeeValidate + zod |
| shadcn/ui | shadcn-vue |
| framer-motion | `<Transition>` / `@vueuse/motion` |
| react-router-dom | routing par fichiers Nuxt (`pages/`) |
| lucide-react | @lucide/vue |

## 10. Sécurité — checklist de référence

- Validation zod sur **chaque** route API, même si le formulaire frontend valide déjà.
- Jamais de SQL brut — Prisma uniquement.
- CSRF : cookies de session `SameSite=Strict` (géré par `nuxt-auth-utils`), CORS restreint au domaine du projet.
- Rate limiting sur le login et les formulaires publics (compteur `unstorage`, pas besoin de Redis à cette échelle).
- Logs structurés (`consola`, inclus dans Nitro), rotation de fichier en prod.
- Toute route `/api/admin/**` appelle `requireUserSession` et vérifie le rôle/filiale avant toute requête base de données.
