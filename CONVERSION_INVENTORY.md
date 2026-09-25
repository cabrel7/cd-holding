# CONVERSION_INVENTORY.md — Groupe CD

Livrable de la **phase 1** de `PROMPT_CONVERSION.md` : analyse complète du prototype React (`prototype_react/`, https://cd-holding-nexus.lovable.app/), sans aucun code produit.

- Rédigé le 2026-09-25 par 4 agents `architect` (lecture seule, un périmètre chacun) + 1 agent `e2e-tester` (captures), consolidé par le thread principal.
- Parties détaillées (format par route imposé par le prompt) : [Partie 1 — Holding + Admin](#partie-1), [Partie 2 — Entretien + Transport](#partie-2), [Partie 3 — Comptable + Placement](#partie-3), [Partie 4 — CCDPAA + Boissons](#partie-4).
- Captures de référence : `conversion-captures/<route>/<375|768|1440>.png` (non versionnées, régénérables via `scripts/capture-prototype.mjs`). Index : `conversion-captures/index.json`.
- Les numéros d'écarts internes à chaque partie (ex. « écart 9 », « E14 ») renvoient à la section « Écarts détectés » de la partie concernée.

**Règle d'arrêt (PROMPT_CONVERSION.md)** : la section « Écarts détectés » ci-dessous n'est pas vide → **aucune modification du schéma Prisma avant confirmation de l'utilisateur.** Les décisions à prendre sont regroupées et numérotées (`DEC-xx`), chacune avec la recommandation retenue par défaut.

---

## Constats transverses

1. **Le prototype n'est pas branché sur ses propres données publiques** : les pages publiques importent `mockdata.ts` en statique ; les éditions du CMS admin n'y apparaissent jamais. Le parcours « éditer → publier » n'a donc jamais été validé par le client — il est à construire, pas à copier.
2. **Aucune sécurité réelle côté prototype** : pas de garde de rôle sauf `/admin/filiales`, scoping uniquement visuel, mots de passe démo affichés. Ne rien reprendre tel quel (CLAUDE.md fait foi : `requireRole` + scoping serveur partout).
3. **Les 6 filiales partagent 6 composants** (`SubLayout`, `SubHome`, `SubServicesPage`, `SubRealisationsPage`, `SubAboutPage`, `SubContactPage` + `GenericContactForm`), différenciés par `SUB_CONFIG` (`subConfig.ts`, hors `mockdata.ts`). Exceptions à pages propres : `/placement` (accueil + contact double audience + offres), `/ccdpaa` (accueil), `/ccdpaa/restaurant`, assistant import-export (`/ccdpaa/services`).
4. **Défauts du prototype à ne pas porter** (violations CLAUDE.md / PROJECT_CONTEXT §6) : `linear-gradient` (`SubServicesPage`) et `radial-gradient` (`SubAboutPage`) ; **id numérique affiché** (`String(s.id).padStart(2,"0")`) et filtré en dur (`s.id !== 20`) ; validation de formulaire silencieuse (`required: true` sans message) ; liens `href="#"` (réseaux sociaux, légal) ; CTA `#contact` sans cible ; Google Fonts externes (bloquées par la CSP) ; images Unsplash/pravatar/dicebear en URL externes (bloquées par la CSP).
5. **Retours client partiellement reflétés** : supermarchés (service présent mais absent de l'accueil, des meta, du formulaire) ; services comptables (pitch, meta, options du formulaire encore sur « paie, TPS/TVQ ») ; candidature (ni adresse, ni « Autre » + précision) ; libellé suggestion (« Un produit manque… » vs « Vous ne trouvez pas… »). **PROJECT_CONTEXT fait foi.** Le retour « assistant scripté, pas une vraie IA » est cité par PROJECT_STATE mais **absent de PROJECT_CONTEXT**.
6. **Promesses sans infrastructure** : plusieurs toasts promettent une confirmation « par courriel » alors qu'aucun envoi d'e-mail n'existe dans la stack.

---

## Écarts détectés — synthèse et décisions

### A. Schéma — contenu CMS partagé (toutes filiales) — *décisions d'implémentation, faible risque*

| # | Écart | Recommandation par défaut |
|---|---|---|
| DEC-01 | `MembreEquipe.bio` absent (affiché partout) | `bio String? @db.Text` |
| DEC-02 | `Partenaire.typeRelation` absent (affiché partout, valeurs libres) | `typeRelation String?` |
| DEC-03 | `Company` sans coordonnées ni nom court (header, footer, contact, SEO `LocalBusiness`) | `nomCourt`, `email`, `telephone`, `adresse` en `String?` |
| DEC-04 | `Company` sans image hero/couverture ni ordre d'affichage (holding liste les filiales « 01…06 ») | `heroImageKey String?` (Fichier PUBLIC) + `ordre Int @default(0)` ; afficher `index+1`, jamais un id |
| DEC-05 | Images en URL externes (Unsplash, pravatar, dicebear) vs clés `Fichier` + CSP | Le script de migration télécharge **uniquement Unsplash** → `Fichier` PUBLIC. **pravatar / dicebear jamais migrés** (visages de stock sous des noms réels) → `photoKey`/`logoKey` null + initiales en repli. Vraies photos à fournir par le client |
| DEC-06 | Dates `YYYY-MM-DD` → `DateTime` : minuit UTC affiché « mai » au lieu de « juin » à Montréal + mismatch d'hydratation | `dateRealisation … @db.Date` + formatage `timeZone: 'UTC'` dans un utilitaire partagé testé |
| DEC-07 | Textes marketing par filiale (`SUB_CONFIG` : hero, pitch, CTA, champs de formulaire) sans modèle | Config typée versionnée `shared/config/filiales.ts` (pas en base) — les champs de formulaire sont couplés au zod serveur |
| DEC-08 | `PageContenu` (onglet admin « Sections », 15 sections) : **lu par aucune page publique**, contredit `SUB_CONFIG` | **Ne pas porter** l'onglet ; activité « contenu modifié » du dashboard dérivée des `updatedAt` CMS. À rouvrir seulement si le client veut éditer les textes de héros |
| DEC-09 | `Company.statutSite` (badge « en maintenance » CCDPAA) ne pilote rien = badge décoratif interdit §6 | Ne pas porter |
| DEC-10 | Idempotence du script `migrate-mockdata-to-seed` : aucune clé unique naturelle sur Service/Realisation/MembreEquipe/Partenaire | `findFirst({companyId, titre|nom})` puis create/update dans le script ; pas de contrainte de schéma |

### B. Schéma — messages de contact (toutes filiales)

| # | Écart | Recommandation par défaut |
|---|---|---|
| DEC-11 | Statut message : prototype `nouveau/en_cours/traite` vs schéma `lu Boolean` | `enum StatutMessage { NOUVEAU EN_COURS TRAITE }` à la place de `lu` (prototype validé avec 3 états) |
| DEC-12 | Champs structurés des formulaires par filiale (type de propriété, fréquence, origine/destination, structure/besoin, volume, établissement, marques…) concaténés dans `message` | `entreprise String?` + `details Json?` validé par un **zod par filiale** (config partagée) ; **un seul** endpoint `POST /api/public/contact` (`z.discriminatedUnion`) — pas de duplication par filiale |
| DEC-13 | Suggestion de produit : pays d'origine sans colonne ; `SUGGESTION_PRODUIT` accepté pour toute filiale ; `message ≥ 10` vs `commentaire ≥ 5` (400 garanti) | `paysOrigine String?` ; suggestion limitée à ccdpaa/boissons ; minimums alignés dans `shared/validation/contact.ts` |
| DEC-14 | Assistant import-export : e-mail vide, contact en texte libre, pas de type | `TypeMessage.ASSISTANT_IMPORT_EXPORT` ; étape contact éclatée (nom/entreprise/email/tél.) ; réponses en clés stables dans `details` ; Q&A en fichier statique versionné `shared/content/ccdpaa/assistant-import-export.ts` (pas en base, aucun LLM) |
| DEC-15 | `sujet` fourni par le client ; téléphone optionnel alors que requis par certains formulaires | `sujet` calculé serveur depuis la config filiale ; `telephone` requis au niveau zod par filiale |

### C. Schéma — Placement CD Pro

| # | Écart | Recommandation par défaut |
|---|---|---|
| DEC-16 | `OffreEmploi` (entité séparée au prototype, jointure par titre) vs `DemandeClient.publiee` (PROJECT_CONTEXT §7, fait foi) | Garder `DemandeClient`, ajouter champs d'offre publique nullables : `titreOffre`, `lieu`, `typeContrat` (enum), `salaire`, `descriptionPublique`, `publieeLe` ; zod admin les exige pour publier ; **jamais `entrepriseCliente` en public** (le prototype fuit le nom du client) |
| DEC-17 | `DemandeClient` sans champs internes (contact, quantité, début, statut) | `contactNom`, `contactEmail`, `contactTelephone?`, `nombrePostes Int @default(1)`, `dateDebut?`, `statut StatutDemande @default(OUVERTE)` ; public = `publiee && statut=OUVERTE` |
| DEC-18 | `Candidature` : `experience`, `pays`, `message`, consentement absents ; statuts 5 (proto) vs 4 (schéma) | Ajouter `experience NiveauExperience?`, `pays`, `message? @db.Text`, `consentementLe DateTime` ; **garder les 4 statuts du schéma** (mapping : entrevue → EN_REVISION ; l'étape « entrevue » disparaît — à signaler au client) |
| DEC-19 | Retours client non reflétés : adresse complète, poste « Autre » + précision | Un seul `CandidatureForm` (spontanée + offre) avec `adresseComplete` et `posteAutrePrecision` (requis ssi « Autre », `superRefine` client + serveur) ; liste de postes partagée incluant **Entretien** |
| DEC-20 | Candidature à une offre : modal (prototype) vs page | **Page `/placement/offres/[uuid]`** (formulaire complet trop haut pour un modal à 375 px ; lien partageable ; JSON-LD `JobPosting`) — écart au prototype à documenter |
| DEC-21 | Formats de CV : prototype `.pdf/.doc/.docx` vs stockage PDF/PNG/JPEG/WebP | **CV en PDF uniquement**, documents PDF/JPEG/PNG. DOCX seulement si le client l'exige (contrôle zip), `.doc` jamais |
| DEC-22 | Upload public multi-fichiers : plafond par requête, pas d'atomicité | Plafond total 10 Mo / candidature, ≤ 5 documents, validation de tous les fichiers avant écriture, rollback (helper `saveUploadedFiles`), rate-limit `candidature` 3/h/IP |
| DEC-23 | `Candidat` (vivier) : catégorie, disponibilité, statut, origine absents ; prototype crée un Candidat à chaque candidature | Ajouter `categorie`, `disponibilite?`, `statut StatutCandidat`, `origine OrigineCandidat` ; **pas de création automatique** → action admin « Ajouter au vivier » |
| DEC-24 | Affectation candidat ↔ demande non tracée | Table `Affectation(candidatId, demandeId, date)` `@@unique` |
| DEC-25 | ISR 3600 s sur `/placement/**` : une offre retirée reste affichée 1 h | `/placement/offres` en ISR 60 s ou SSR ; vérification serveur « publiée et ouverte » à chaque candidature |

### D. Schéma — Comptable, Restaurant, Planning, comptes

| # | Écart | Recommandation par défaut |
|---|---|---|
| DEC-26 | `DossierComptable` sans forfait ni statut | `forfait ForfaitComptable?` (MENSUEL/TRIMESTRIEL/ANNUEL) + `statut StatutDossier @default(A_JOUR)` ; confirme la décision ouverte n°2 (Dossier étend Client — doublon « Atelier EG » dans le mock) |
| DEC-27 | Réservation : `date`+`heure` séparés vs `dateReservation` ; pas d'`updatedAt` ; aucune validation métier (date passée, lundi, hors horaires, « abc » personnes) | Combinaison fuseau `America/Montreal` → UTC ; `updatedAt` ; créneaux générés depuis `shared/config/restaurant.ts` (mar–dim 11h30–21h30, pas 30 min, ≤ 90 jours, 1–20 personnes) ; transitions EN_ATTENTE → CONFIRMEE/ANNULEE |
| DEC-28 | `PlanningEntry` : prototype = gabarit hebdo récurrent (`jour`, `HH:mm`, `lieu`) vs schéma = dates réelles sans `lieu` | Garder les dates réelles, ajouter `lieu String`, `titre` optionnel ; grille semaine + navigation ; « dupliquer la semaine » plus tard |
| DEC-29 | Lien `User` ↔ `Employe` absent (`/admin/mon-planning` joint par e-mail) | `Employe.userId Int? @unique` → résolu par `secure.userId` |
| DEC-30 | `Employe.statut` 3 valeurs vs `actif Boolean` | Garder le booléen (« en congé » sans effet métier au prototype) |
| DEC-31 | Unicité des clients CRM | `@@unique([companyId, email])`, 409 sur conflit |

### E. Routes admin — prototype ↔ checklist PROJECT_STATE

| # | Divergence | Recommandation par défaut |
|---|---|---|
| DEC-32 | D1 dashboard `/admin/dashboard` (proto) vs `/admin` (checklist) | `/admin` (= `ADMIN_HOME_PATH`) |
| DEC-33 | D4 planning : 1 route scopée (proto, toutes filiales) vs 3 routes (checklist) ; périmètre PROJECT_CONTEXT = entretien/transport/ccdpaa | Route unique `/admin/planning?site=<slug>` + `shared/config/modules.ts` + `requireModule` serveur ; périmètre = PROJECT_CONTEXT (3 filiales) |
| DEC-34 | D6/D7 comptable et placement : onglets (proto) vs routes (checklist) ; onglet « Offres » sans contrepartie | `/admin/comptable/dossiers` ; `/admin/placement/{candidats,demandes,candidatures}` en onglets-liens ; « Offres » = filtre `publiee` des demandes |
| DEC-35 | D3 réservations : onglet de Messages (proto) vs route dédiée (checklist) | Route dédiée `/admin/ccdpaa/reservations` |
| DEC-36 | D5 `/admin/mon-planning`, D8 `/admin/filiales`, D9 `/admin/parametres` absentes de la checklist | Les ajouter à la checklist (mon-planning exigé par PROJECT_CONTEXT §5) ; `EMPLOYE` redirigé vers `/admin/mon-planning` |
| DEC-37 | D10 gestion des comptes absente partout (création, reset mot de passe, CRUD employés) | Ajouter `/admin/utilisateurs` (SUPER_ADMIN) à la checklist |
| DEC-38 | Suggestions de produit jamais affichées en admin | Filtre `type` dans `/admin/messages` (+ pagination, déjà notée) |
| DEC-39 | Réalisations holding éditables mais affichées nulle part | Exclure la holding du CMS réalisations |

### F. Questions pour le client (bloquent le contenu, pas le code)

| # | Question |
|---|---|
| Q-01 | **Loi 25** : politique de confidentialité (texte), durée de conservation des CV/documents, page `/confidentialite` + mention sous chaque formulaire public (5 formulaires collectent des données personnelles) — **à ajouter à la checklist Holding** |
| Q-02 | Vraies coordonnées (e-mails, téléphones, adresses — le prototype mélange `@groupe-cd.ca` et `@groupecd.ca`, téléphones `000-100x`) et **nom officiel du groupe** (décision ouverte n°3) |
| Q-03 | Effectif réel du groupe (prototype : 133 employés vs « 150+ » vs « 130+ » selon la page) |
| Q-04 | Comptable : la paie et la TPS/TVQ sont-elles toujours offertes ? (services mis à jour vs pitch/formulaire/PROJECT_CONTEXT §2) |
| Q-05 | Entretien : mettre le service « supermarchés » en avant (accueil, meta, option de formulaire) ? |
| Q-06 | Mentions à valider : « Ordre des CPA du Québec — Adhésion professionnelle » (titre réservé), « Service Canada — Partenaire institutionnel » |
| Q-07 | Boissons alcoolisées : mentions légales / règles publicitaires RACJ |
| Q-08 | Restaurant : adresse précise, horaires exacts (dernier service), capacité max par réservation |
| Q-09 | Formats de CV acceptés (PDF seul recommandé) |
| Q-10 | Envoi d'e-mails (confirmations promises dans les toasts) : en attendant, les toasts seront reformulés (« nous vous recontactons ») |
| Q-11 | Libellé du formulaire de suggestion : « Vous ne trouvez pas ce que vous cherchez ? » (PROJECT_STATE) confirmé |

---

## Récapitulatif — impact sur `prisma/schema.prisma` si toutes les recommandations sont acceptées

- **Nouveaux champs** : `MembreEquipe.bio` · `Partenaire.typeRelation` · `Company.{nomCourt,email,telephone,adresse,heroImageKey,ordre}` · `MessageContact.{entreprise,details,paysOrigine,statut}` (− `lu`) · `DemandeClient.{titreOffre,lieu,typeContrat,salaire,descriptionPublique,publieeLe,contactNom,contactEmail,contactTelephone,nombrePostes,dateDebut,statut}` · `Candidature.{experience,pays,message,consentementLe}` · `Candidat.{categorie,disponibilite,statut,origine}` · `DossierComptable.{forfait,statut}` · `ReservationRestaurant.updatedAt` · `PlanningEntry.lieu` (+ `titre` optionnel) · `Employe.userId` · `Realisation.dateRealisation @db.Date`.
- **Nouveaux enums** : `StatutMessage`, `TypeMessage.ASSISTANT_IMPORT_EXPORT`, `TypeContrat`, `StatutDemande`, `NiveauExperience`, `CategoriePoste`, `StatutCandidat`, `OrigineCandidat`, `ForfaitComptable`, `StatutDossier`.
- **Nouveau modèle** : `Affectation`.
- **Contraintes** : `Client @@unique([companyId, email])`, `Affectation @@unique([candidatId, demandeId])`, `Employe.userId @unique`.
- **Non portés** : `PageContenu`, `OffreEmploi` (fusionné dans `DemandeClient`), `statutSite`, `employesCount` (remplacé par config/chiffre client).

---

<a id="partie-1"></a>

# Partie 1 — Inventaire de conversion : Holding publique + Admin (Phase 1)

> Hypothèses et remarques préalables
> - **Source du prototype** : tout le code lu dans `prototype_react/cd-holding-nexus/src/`. Je n'ai fait **aucune capture Playwright** (le brief demandait un inventaire sans code) : l'étape 2 de la Phase 1 reste à exécuter.
> - **Aucune page publique ne lit le contexte de données.** Elles importent `mockdata.ts` en statique. Seuls les formulaires écrivent dans `useData()`. Les éditions CMS du prototype ne sont donc **jamais** visibles sur les sites publics. Le prototype ne valide pas le parcours « éditer → publier ».
> - **Aucune route admin du prototype ne vérifie le rôle, sauf `/admin/filiales`.** Le scoping se fait seulement dans la sidebar et dans les filtres côté client. Tout ce qui figure sous « Rôles / scoping » décrit ce que le code *affiche*. Ce n'est pas une règle de sécurité à reprendre telle quelle.
> - **Conventions des endpoints proposés** : `[uuid]` validé par `z.string().uuid()`. Le paramètre `site` est un **slug** de `Company` : ce n'est pas un id, c'est donc conforme à CLAUDE.md § Identifiants.
> - **Existant réutilisé** : `server/api/auth/{login,logout,me}`, `server/api/public/contact.post.ts`, `server/api/admin/messages/index.get.ts`, `server/api/admin/files/index.post.ts`, `server/api/files/[key].get.ts`, et les helpers `server/utils/auth.ts` (`requireRole`, `companyScope`, `assertCompanyAccess`).

---

## Table de correspondance : routes admin du prototype ↔ checklist `PROJECT_STATE.md`

| Prototype (fichier) | Checklist PROJECT_STATE | Divergence |
|---|---|---|
| `/admin/login` (`admin.login.tsx`) | `/admin/login` | Alignées |
| `/admin` (`admin.index.tsx`, vide) qui redirige vers `/admin/dashboard` (`admin.dashboard.tsx`) | `/admin` (shell dashboard) | **D1** : le dashboard est à `/admin/dashboard` dans le prototype, à `/admin` dans la checklist. `shared/utils/roles.ts` définit `ADMIN_HOME_PATH='/admin'`. |
| `/admin/contenu` (`admin.contenu.index.tsx`, onglet « Sections », entité `PageContenu`) | absent (la checklist ne cite que services/réalisations/équipe/partenaires) | **D2** : route du prototype absente de la checklist, et entité absente du schéma. |
| `/admin/contenu/{services,realisations,equipe,partenaires}` | `/admin/contenu/*` | Alignées |
| `/admin/messages`, onglets **Messages** et **Réservations** | `/admin/messages` + `/admin/ccdpaa/reservations` | **D3** : les réservations sont un onglet de Messages dans le prototype, une route dédiée dans la checklist. |
| `/admin/clients` | `/admin/clients` | Alignées |
| `/admin/planning` : route unique, sélecteur de filiale pour le super_admin, **toutes** les filiales sauf holding | `/admin/entretien/planning`, `/admin/transport/planning`, `/admin/ccdpaa/planning` | **D4** : une route scopée contre trois routes. Le périmètre diffère aussi : le prototype ouvre le planning à comptable, placement et boissons (des employés comptable et boissons sont seedés), alors que PROJECT_CONTEXT §7 le limite à entretien, transport et CCDPAA. |
| `/admin/mon-planning` | absente | **D5** : absente de la checklist alors que PROJECT_CONTEXT §5 l'exige pour le rôle `employe`. |
| `/admin/comptable` | `/admin/comptable/dossiers` | **D6** : chemin différent. |
| `/admin/placement`, 4 onglets (Candidats, Demandes, Candidatures, **Offres**) | `/admin/placement/candidats`, `/demandes`, `/candidatures` | **D7** : onglets contre routes. L'onglet **Offres** n'a pas de contrepartie dans la checklist (lié à l'écart OffreEmploi, E14). |
| `/admin/filiales` (super_admin) | absente | **D8** |
| `/admin/parametres` | absente | **D9** |
| aucune | aucune | **D10** : ni le prototype ni la checklist ne prévoient de **gestion des comptes** (création admin_filiale/employé, reset de mot de passe, lien User↔Employe). Aujourd'hui, les comptes n'existent que par le seed. |

Recommandation (à trancher par toi) :
- **Placement** : des routes imbriquées `/admin/placement/{candidats,demandes,candidatures}` avec un layout à onglets-liens, sur le même modèle que `/admin/contenu` dans le prototype. C'est cohérent et chaque onglet a son lien direct.
- **Planning** : une **route unique** `/admin/planning?site=<slug>`, gardée côté serveur par une config des modules par filiale. Trois fichiers quasi identiques n'apportent rien à un admin_filiale, qui n'a qu'un site, et triplent la surface e2e.
- **Réservations** : une route dédiée `/admin/ccdpaa/reservations`. Des réservations mêlées aux messages sont illisibles pour un super_admin.

---

## `/`  (`routes/index.tsx`, layout `routes/__root.tsx`)

- **Composants clés**
  - Layout racine `__root.tsx` :
    - `<html lang="fr">`, meta title/description/og/twitter.
    - Google Fonts Poppins 500–800 et Inter 400–600.
    - `Toaster` (sonner) global, `DataProvider`.
    - `NotFoundComponent` (404 « Page introuvable ») et `ErrorComponent` (« Réessayer », « Accueil »).
  - Page :
    - `holding/Header` : fixe, logo « Groupe **CD** », nav « Nos filiales » (ancre `/#filiales`), À propos, Contact, CTA « Nous joindre ».
    - `holding/Hero` : blob SVG navy, cercle or, image Montréal, carte « 06 Filiales actives », vague SVG.
    - `holding/Companies` : liste éditoriale alternée gauche/droite des 6 filiales.
    - `holding/Stats` : fond navy, 4 chiffres en dur.
    - Section CTA « Parlons de votre projet » vers `/contact`.
    - `holding/Footer`.
  - `holding/UnderConstruction` existe mais n'est **utilisé nulle part** : code mort.
- **Entités de données utilisées** : `companies` (6), champs `id, slug, nom, secteur, description, couleurAccent, imagePlaceholder`.
  - `0{c.id}` sert de numéro affiché : il faudra utiliser l'ordre d'affichage, jamais un id.
  - `employesCount` et `statutSite` ne sont pas utilisés ici.
  - Stats en dur : `12+` ans, `150+` employés, `06` secteurs, `100%` Montréal.
- **Interactions**
  - Header :
    - Fond crème flouté et bordure dès que `scrollY > 12`.
    - Menu mobile burger, animé en hauteur et opacité (AnimatePresence).
  - Animations :
    - Hero : fondu vers le haut en cascade (délais 0 / 0.05 / 0.15 / 0.25 s), image en échelle 0.96→1 (0.9 s, délai 0.2).
    - Companies : fondu vers le haut `whileInView` (y 40, 0.7 s, marge −80 px), zoom de l'image au survol (1.05, 900 ms).
    - Stats : cascade `whileInView` (0.08 s).
  - Liens :
    - « Découvrir cette filiale » mène à `/{slug}`.
    - **Bug** : le CTA Hero « Nous contacter » pointe vers `#contact`, ancre inexistante sur `/`.
  - Aucun formulaire.
- **Endpoints API nécessaires**
  - `GET /api/public/companies` (public, ISR) : filiales `type=FILIALE` triées, avec `{uuid, slug, nom, secteur, description, couleurAccent, imageKey, ordre}`. Réutilisé par Footer, Companies et le sélecteur du formulaire de contact.
  - `GET /api/files/[key]` (existant) : images `PUBLIC`.
- **Écart avec `prisma/schema.prisma`**
  - `Company` n'a **pas d'image de couverture** : `imagePlaceholder` n'a pas d'équivalent, `logoKey` ≠ couverture (E1).
  - **Pas de champ `ordre`** pour l'ordre des filiales (E2).
  - Les `secteur` et `description` du seed actuel (`prisma/seed.ts`) diffèrent de `mockdata.ts` : textes plus courts, description absente pour les filiales (E3).

## `/a-propos`  (`routes/a-propos.tsx`)

- **Composants clés** :
  - `Header` et `Footer`.
  - Section histoire : 2 paragraphes en dur, plus un aside « Nos repères » (6 filiales, **130+** collaborateurs, siège Montréal).
  - Section Équipe sur fond navy (figures portrait 4/5).
  - Section Partenaires : liste à séparateurs, logo 64 px, nom, type de relation.
- **Entités de données utilisées** :
  - `equipe` filtrée `filialeId==="holding"` (3) : `id, filialeId, nom, poste, photoPlaceholder, bio`.
  - `partenaires` filtrés holding (3) : `id, filialeId, nom, logoPlaceholder, typeRelation`.
  - **Incohérence de contenu** : 130+ collaborateurs ici, 150+ sur `/`, alors que la somme des `employesCount` donne 133.
- **Interactions** :
  - Équipe : cascade `whileInView` (y 20, 0.5 s, délai i×0.08). Le 2ᵉ membre est décalé `md:mt-12` (mise en page en quinconce).
  - Pas de formulaire.
- **Endpoints API nécessaires** : `GET /api/public/sites/[slug]/a-propos` (public, ISR). Renvoie `{ equipe: [{uuid, nom, poste, bio, photoKey}], partenaires: [{uuid, nom, typeRelation, logoKey, siteUrl}] }` trié par `ordre`. Il sera réutilisé tel quel par les 6 `/[filiale]/a-propos`.
- **Écart avec `prisma/schema.prisma`** :
  - `MembreEquipe.bio` manquant (E4).
  - `Partenaire.typeRelation` manquant (E5).
  - Images : le prototype utilise des URLs externes (pravatar, dicebear **SVG**), le schéma attend `photoKey`/`logoKey` (upload `Fichier`). Le SVG est refusé par `server/utils/storage.ts` (E6).
  - `Partenaire.siteUrl` existe dans le schéma mais n'est pas utilisé par le prototype (aucun lien) : rien à faire, mais le champ n'est pas exploité.

## `/contact`  (`routes/contact.tsx` + `components/holding/Contact.tsx`)

- **Composants clés** : `Header`, `Contact` (colonne texte avec coordonnées en dur `contact@groupe-cd.ca`, `+1 (514) 000-0000`, Montréal ; carte formulaire), `Footer`, champ `Field` (label en majuscules et message d'erreur).
- **Entités de données utilisées** :
  - `companies` pour le sélecteur (`slug`, `nom`).
  - Écriture dans `messagesContact` : `filialeId` = slug cible ou `"holding"`, `nom`, `email`, `sujet` (généré : `Demande — {nom filiale}` ou `Demande générale`), `message`, `statut:"nouveau"`, `date`.
- **Interactions** :
  - Formulaire react-hook-form + zod :
    - `nom` : min 2, « Veuillez saisir votre nom. »
    - `email` : format email, « Adresse courriel invalide. »
    - `filiale` : min 1 ; options `""` (placeholder), `groupe` (« Le Groupe CD (général) »), puis les 6 slugs.
    - `message` : min 10.
  - Soumission :
    - Latence simulée de 600 ms.
    - Bouton désactivé avec le texte « Envoi en cours… ».
    - Toast succès « Message envoyé » avec « Merci {nom}, notre équipe vous répondra rapidement. », puis `reset()`.
  - Animations : 2 blocs en fondu vers le haut `whileInView` (délais 0 et 0.1 s).
  - Pas de téléphone ni de sujet saisis.
- **Endpoints API nécessaires** : `POST /api/public/contact` (existant, public, rate-limit, honeypot). À adapter :
  - `companySlug` devient `z.enum([...slugs connus])` au lieu d'une chaîne libre.
  - Correspondance `groupe` → `holding`.
  - `sujet` dérivé **côté serveur**.
  - `type=CONTACT` forcé sur ce formulaire.
- **Écart avec `prisma/schema.prisma`** :
  - Statut 3 états `nouveau/en_cours/traite` dans le prototype contre `lu Boolean` dans le schéma (E7).
  - Aucune trace du site d'origine : un message envoyé depuis la holding vers « entretien » est indiscernable d'un message du site entretien. C'est mineur (E8).

---

## `/admin` (layout)  (`routes/admin.tsx` + `components/admin/{AdminSidebar,AdminHeader}.tsx`)

- **Composants clés** :
  - `ssr:false`, `AuthProvider`, garde client (écrans « Chargement… » et « Redirection… »).
  - `SidebarProvider` + `AdminSidebar` (repliable en icônes, logo « CD », groupe « Navigation »).
  - `AdminHeader` : `SidebarTrigger`, nom de la filiale ou « Groupe CD », nom de l'utilisateur, **Badge** de rôle, bouton Déconnexion avec AlertDialog « Se déconnecter ? ».
  - `<main>` avec transition de route. Footer « Console d'administration » avec lien « Voir le site public → ».
- **Entités de données utilisées** :
  - `User` : `id, nom, email, motDePasse, role, filialeId`.
  - `companies` (`id, slug, nom`).
- **Interactions** :
  - Transition de route AnimatePresence `mode="wait"` : opacité et y 8 → 0 → −4, 0.2 s.
  - Déconnexion : AlertDialog, puis toast « Vous avez été déconnecté. », puis redirection vers `/admin/login`.
  - Redirection de toute personne connectée depuis `/admin` ou `/admin/login` vers `/admin/dashboard`, **y compris l'employé**.
- **Rôles / scoping** :
  - Sidebar `employe` : « Mon planning » uniquement.
  - Sidebar `super_admin` et `admin_filiale` : Vue d'ensemble, Messages, Contenu (« des sites » ou « de mon site »), Clients, **Planning (toujours affiché)**.
    - « Comptabilité » si le scope contient `comptable`.
    - « Placement » si le scope contient `placement`.
    - « Toutes les filiales » pour le super_admin seulement.
    - Paramètres.
  - `lib/admin-scope.ts` :
    - `scopeSlugs(user)` : super_admin → les 7 slugs (holding compris) ; sinon → le slug de sa filiale.
    - `slugOf`, `slugLabel` (holding : « Groupe CD (holding) »).
- **Endpoints API nécessaires** :
  - `GET /api/auth/me` (existant).
  - `POST /api/auth/logout` (existant).
  - `GET /api/admin/scope` (tous les rôles connectés) : `[{uuid, slug, nom, type, couleurAccent, modules[]}]`. Remplace `scopeSlugs` et alimente la sidebar et les sélecteurs de site. `modules` vient d'une config serveur partagée (planning, comptable, placement, reservations) : zéro valeur magique côté client.
- **Écart avec `prisma/schema.prisma`** :
  - Aucun écart sur `User`. `motDePasse` en clair devient `passwordHash` ; `filialeId` devient `companyId`.
  - Point à prévoir : le schéma n'a pas de notion de **modules par filiale**. Il faut une config (E16).
  - Décision ouverte n°1 (style sombre du dashboard) : à trancher avant ce layout.

## `/admin/login`  (`routes/admin.login.tsx`)

- **Composants clés** : écran scindé en deux :
  - panneau navy (lg+) : logo, « Console d'administration. », copyright ;
  - formulaire : `Input`, `Label`, `Button` ;
  - encart **« Comptes de démonstration » avec les mots de passe en clair**.
- **Entités de données utilisées** : `users` (`email`, `motDePasse`, `role`, `filialeId`).
- **Interactions** :
  - Formulaire :
    - `email` : `trim().email("Adresse courriel invalide").max(255)`.
    - `motDePasse` : `min(1,"Mot de passe requis").max(200)`.
  - Erreur inline `role="alert"` animée en hauteur. Message d'échec : « Identifiants invalides. Vérifiez votre courriel et votre mot de passe. »
  - Toast « Connexion réussie » puis `/admin/dashboard`.
  - Animation : fondu vers le haut 0.3 s.
- **Rôles / scoping** : public. Toute personne connectée est redirigée.
- **Endpoints API nécessaires** : `POST /api/auth/login` (existant : rate-limit 5/15 min, anti-timing, `shared/validation/auth.ts`, champ `password`).
- **Écart avec `prisma/schema.prisma`** :
  - Aucun écart de schéma.
  - **L'encart des comptes démo ne doit pas être porté** : identifiants exposés.
  - Les comptes de démo diffèrent entre le prototype et le seed : le prototype a Claire Dubois (super), Marc Tremblay (admin **comptable**) et Awa Diallo (employée entretien) ; le seed a un admin **entretien**. Impact sur `/admin/mon-planning` (E11).

## `/admin/dashboard`  (`routes/admin.dashboard.tsx`)

- **Composants clés** :
  - En-tête : « Vue d'ensemble » ou « Ma filiale », « Bonjour, {prénom}. », total d'employés.
  - Table des filiales : pastille d'accent, nom, secteur, employés, **Badge statut du site**.
  - Liste « Activité récente » (8 éléments).
- **Entités de données utilisées** :
  - `companies` (`nom, secteur, couleurAccent, employesCount, statutSite`).
  - Activité fusionnée :
    - `pagesContenu` (`titre, filialeId, derniereModification`) ;
    - `messagesContact` (`sujet, nom, filialeId, date`) ;
    - `reservationsRestaurant` (`personnes, nom, date, heure, creeLe`), si le scope contient ccdpaa ;
    - `candidatures` (`posteVise, nom, date`) et `demandesClients` (`poste, quantite, entreprise, debut`), si le scope contient placement.
- **Interactions** :
  - Aucun formulaire ni filtre.
  - Tri par date décroissante. **Bug** : les demandes sont datées par `debut` (date future, 2027-01-05), donc elles remontent toujours en tête.
- **Rôles / scoping** :
  - super_admin : 6 filiales. La holding n'apparaît pas dans la table mais ses messages oui.
  - admin_filiale : sa filiale.
  - **Fuite** : l'employé est redirigé ici et voit l'activité de sa filiale (messages clients). Aucune garde de rôle.
- **Endpoints API nécessaires** : `GET /api/admin/dashboard` (`SUPER_ADMIN`, `ADMIN_FILIALE` ; `EMPLOYE` reçoit 403 et le front le redirige vers `/admin/mon-planning`). Renvoie `{ filiales[], totalEmployes, activite[8] }`. L'activité est agrégée côté serveur et scopée : messages, réservations, candidatures, demandes par `createdAt`, et mises à jour CMS par `updatedAt` si les Sections sont retirées.
- **Écart avec `prisma/schema.prisma`** :
  - `Company.employesCount` absent (E9).
  - `Company.statutSite` absent (E10).
  - `PageContenu` absent (E12).

## `/admin/contenu` (layout + index « Sections »)  (`routes/admin.contenu.tsx`, `routes/admin.contenu.index.tsx`)

- **Composants clés** :
  - Layout : en-tête « CMS / Contenu des sites » et nav d'onglets-liens (Sections, Services, Réalisations, Équipe, Partenaires ; onglet actif sur `pathname ===`).
  - Index : une liste par site, avec Badge `section` en police mono, titre, contenu tronqué, « Modifié le ».
  - Boutons Modifier et Supprimer ; `Dialog` d'édition ; `AlertDialog` de suppression.
- **Entités de données utilisées** : `pagesContenu` (15 ; holding 3) : `id, filialeId (number|"holding"), section, titre, contenu, derniereModification`.
- **Interactions** :
  - Édition, sans création possible :
    - `titre` : maxLength 200.
    - `contenu` : textarea, 6 lignes, maxLength 2000.
    - Les deux sont requis après trim (toast d'erreur « Le titre et le contenu sont requis. »).
  - Toasts « Section mise à jour. » et « Section supprimée. ».
- **Rôles / scoping** : super_admin voit holding + 6 filiales ; admin_filiale voit sa filiale.
- **Endpoints API nécessaires** : aucun si l'onglet est retiré (recommandé, voir E12). Sinon `GET/PATCH/DELETE /api/admin/contenu/sections[/[uuid]]`.
- **Écart avec `prisma/schema.prisma`** : **entité `PageContenu` absente** du schéma, et **aucune page publique ne la consomme** : le texte des héros est codé en dur et différent (« Six entreprises. Une seule exigence. » contre « Une holding montréalaise, six métiers, un cap. »). Voir E12.

## `/admin/contenu/services`  (`routes/admin.contenu.services.tsx` + `components/admin/CollectionEditor.tsx`)

- **Composants clés** : `CollectionEditor` générique :
  - en-tête ; sélecteur de site si plusieurs ; bouton « Ajouter » ;
  - une liste par site : primaire en gras, secondaire en `line-clamp-2`, compteur « n fiches » ;
  - `Dialog` Nouvelle/Modifier fiche ; `AlertDialog` « Supprimer cette fiche ? ».
- **Entités de données utilisées** : `services` (26) : `id, filialeId (hors holding), titre, description`.
- **Interactions** :
  - Formulaire :
    - `titre` : texte, maxLength 300.
    - `description` : textarea, maxLength 2000.
    - Tous deux requis après trim (toast « Champs requis : … »).
  - Toasts « Fiche ajoutée. », « Fiche mise à jour. » et « Fiche supprimée. ».
  - Les ajouts sont préfixés en tête de liste.
  - **Pas de réordonnancement ni d'image.**
- **Rôles / scoping** : `scopeSlugs(user)` sans la holding. super_admin : 6 filiales. admin_filiale : la sienne. La holding n'a pas de services.
- **Endpoints API nécessaires** (`SUPER_ADMIN`, `ADMIN_FILIALE` scopé ; `site=holding` renvoie 400) :
  - `GET /api/admin/contenu/services?site=<slug>`
  - `POST /api/admin/contenu/services` `{site, titre, description, imageKey?}`
  - `PATCH /api/admin/contenu/services/[uuid]`
  - `DELETE /api/admin/contenu/services/[uuid]`
  - Optionnel : `PATCH /api/admin/contenu/services/ordre` `{uuids[]}`.
- **Écart avec `prisma/schema.prisma`** : aucun champ manquant. `imageKey` et `ordre` existent dans le schéma mais ne sont pas exposés par le prototype : à décider (E13).

## `/admin/contenu/realisations`  (`routes/admin.contenu.realisations.tsx`)

- **Composants clés** : `CollectionEditor` (primaire `titre`, secondaire `description`).
- **Entités de données utilisées** : `realisations` (16 ; holding 2) : `id, filialeId, titre, description, imagePlaceholder, date` (ISO `YYYY-MM-DD`).
- **Interactions** :
  - Champs `titre`, `description` (textarea), `imagePlaceholder` (**URL en texte**, « Adresse de l'image ») et `date` (**input texte**, le `type:"date"` n'est pas passé).
  - Tous requis. Aucune validation de format de date ni d'URL.
- **Rôles / scoping** : `scopeSlugs` **holding comprise**. Or **aucune page publique holding n'affiche les réalisations** : les 2 réalisations holding sont éditables mais invisibles.
- **Endpoints API nécessaires** : même contrat que services sur `/api/admin/contenu/realisations`. Payload `{site, titre, description, imageKey?, dateRealisation?}` ; l'image passe par `POST /api/admin/files` (existant, visibilité `PUBLIC`).
- **Écart avec `prisma/schema.prisma`** :
  - `date` devient `dateRealisation DateTime?` : OK.
  - L'URL d'image devient `imageKey` (upload) (E6).
  - Holding sans vitrine de réalisations (E15).

## `/admin/contenu/equipe`  (`routes/admin.contenu.equipe.tsx`)

- **Composants clés** : `CollectionEditor` (primaire `nom`, secondaire `poste`).
- **Entités de données utilisées** : `equipe` (15) : `id, filialeId, nom, poste, photoPlaceholder, bio`.
- **Interactions** : champs `nom`, `poste`, `photoPlaceholder` (URL en texte) et `bio` (textarea). Tous requis.
- **Rôles / scoping** : `scopeSlugs` holding comprise.
- **Endpoints API nécessaires** : même contrat sur `/api/admin/contenu/equipe`. Payload `{site, nom, poste, bio, photoKey?}`.
- **Écart avec `prisma/schema.prisma`** :
  - **`bio` manquant** (E4).
  - `photoPlaceholder` (URL) devient `photoKey` (E6).

## `/admin/contenu/partenaires`  (`routes/admin.contenu.partenaires.tsx`)

- **Composants clés** : `CollectionEditor` (primaire `nom`, secondaire `typeRelation`).
- **Entités de données utilisées** : `partenaires` (15) : `id, filialeId, nom, logoPlaceholder, typeRelation`.
- **Interactions** : champs `nom`, `typeRelation` et `logoPlaceholder` (URL). Tous requis.
- **Rôles / scoping** : `scopeSlugs` holding comprise.
- **Endpoints API nécessaires** : même contrat sur `/api/admin/contenu/partenaires`. Payload `{site, nom, typeRelation, logoKey?, siteUrl?}`.
- **Écart avec `prisma/schema.prisma`** :
  - **`typeRelation` manquant** (E5).
  - `logoPlaceholder` (URL d'un SVG dicebear) devient `logoKey` ; le SVG n'est pas autorisé (E6).

## `/admin/messages`  (`routes/admin.messages.tsx`)

- **Composants clés** :
  - `Tabs` : « Messages (n) » et « Réservations (n) », ce dernier seulement si le scope contient ccdpaa.
  - Recherche `Input` et `Select` de statut.
  - Articles de message : sujet, nom · email · téléphone · site, Badge de statut, texte, `Select` de statut, bouton « Ajouter aux clients », date.
  - Lignes de réservation avec `Select` de statut.
- **Entités de données utilisées** :
  - `messagesContact` (7) : `id, filialeId, nom, email, telephone?, sujet, message, statut (nouveau|en_cours|traite), date`.
  - `reservationsRestaurant` (3) : `id, nom, email, telephone, date, heure, personnes, note?, statut (en_attente|confirmee|annulee), creeLe`.
  - `clients` (en écriture).
- **Interactions** :
  - Recherche plein texte sur `nom, email, sujet, message`. Filtre de statut « Tous » ou l'un des 3 états.
  - Tri par date décroissante.
  - Changement de statut, puis toast « Statut mis à jour. ».
  - « Ajouter aux clients » :
    - dédoublonnage par email **sur tous les clients, toutes filiales confondues** (toast info « Ce contact figure déjà dans les clients. ») ;
    - sinon création d'un client `{nom, entreprise:"—", email, telephone, filialeId du message, statut:"prospect", notes: sujet}`.
  - Réservations : statut modifiable, puis toast « Réservation mise à jour. ».
  - **Les suggestions de produit ne sont affichées nulle part dans l'admin du prototype.**
- **Rôles / scoping** :
  - Messages filtrés par `scopeSlugs` : super_admin voit holding + tout ; admin_filiale voit sa filiale.
  - Réservations **non filtrées** : il suffit que le scope contienne ccdpaa.
- **Endpoints API nécessaires** (`SUPER_ADMIN`, `ADMIN_FILIALE` scopé) :
  - `GET /api/admin/messages?statut=&q=&site=&type=&page=`. L'existant est à étendre avec la pagination (tâche en attente dans PROJECT_STATE), la recherche et le filtre.
  - `PATCH /api/admin/messages/[uuid]` `{statut}` ou `{lu}` selon E7.
  - `POST /api/admin/messages/[uuid]/client` : crée un `Client` (`PROSPECT`) rattaché à la filiale du message. Renvoie **409** si l'email existe déjà dans la même filiale.
  - Réservations (si D3 garde l'onglet) : `GET /api/admin/reservations`, `PATCH /api/admin/reservations/[uuid]` `{statut}` ; module `reservations` requis (super_admin ou admin ccdpaa).
- **Écart avec `prisma/schema.prisma`** :
  - Statut 3 états contre `lu Boolean` (E7).
  - `sujet` obligatoire dans le prototype, optionnel dans le schéma. Acceptable.
  - Réservation : `date` + `heure` deviennent `dateReservation` (fusion OK) ; `personnes` devient `nombrePersonnes` ; `note` devient `notes` ; enum `StatutReservation` aligné.
  - Lien message → client non tracé (aucune FK) : acceptable.

## `/admin/clients`  (`routes/admin.clients.tsx`)

- **Composants clés** :
  - En-tête avec compteur et bouton « Ajouter un client ».
  - Barre de filtres : recherche, boutons de statut (Tous, Prospect, Actif, Inactif), `<select>` de filiale si plusieurs.
  - Table : Client, Coordonnées, Filiale, Statut (Badge), Actions.
  - `Dialog` d'ajout/modification ; `AlertDialog` de suppression.
- **Entités de données utilisées** : `clients` (5) : `id, nom, entreprise, email, telephone, filialeId, statut (prospect|actif|inactif), notes, creeLe`.
- **Interactions** :
  - Recherche sur `nom, entreprise, email, telephone`. Filtres statut et filiale.
  - Formulaire : `nom`, `entreprise`, `email`, `telephone`, `filialeId` (select sur le scope), `statut`, `notes`.
  - Seuls `nom` et `email` sont requis (toast d'erreur). **Aucune validation du format email.**
  - Toasts « Client ajouté. », « Client mis à jour. » et « Client supprimé. ».
- **Rôles / scoping** : `scopeSlugs`. Pour le super_admin, la filiale par défaut d'un nouveau client est **holding** (`sites[0]`).
- **Endpoints API nécessaires** (`SUPER_ADMIN`, `ADMIN_FILIALE` scopé) :
  - `GET /api/admin/clients?statut=&site=&q=&page=`
  - `POST /api/admin/clients` `{site, nom, entreprise?, email, telephone?, statut, notes?}`
  - `PATCH /api/admin/clients/[uuid]`
  - `DELETE /api/admin/clients/[uuid]` (cascade sur `DossierComptable` : à signaler dans l'AlertDialog).
- **Écart avec `prisma/schema.prisma`** :
  - Enum `actif` ↔ `CLIENT_ACTIF` : simple correspondance de libellé.
  - `creeLe` devient `dateAjout`.
  - `email` est optionnel dans le schéma mais requis par le prototype : à valider en zod.
  - `derniereInteraction` existe dans le schéma mais n'est pas utilisé.
  - Pas de contrainte d'unicité `(companyId, email)` : nécessaire au dédoublonnage (E17).

## `/admin/filiales`  (`routes/admin.filiales.tsx`)

- **Composants clés** : en-tête « Toutes les filiales » ; une carte par filiale : barre d'accent, nom, secteur, employés, Badge statut du site, lien « Voir le site public → ». Écran « Accès restreint » si l'utilisateur n'est pas super_admin.
- **Entités de données utilisées** : `companies` : `nom, secteur, couleurAccent, employesCount, statutSite, slug`.
- **Interactions** : lecture seule. **Aucune édition des filiales**, alors que `secteur`, `description` et l'image alimentent la page `/`.
- **Rôles / scoping** : super_admin seulement. C'est la seule garde de rôle du prototype.
- **Endpoints API nécessaires** : `GET /api/admin/companies` (`SUPER_ADMIN`). Optionnel, si tu le décides : `PATCH /api/admin/companies/[uuid]` `{secteur, description, imageKey, couleurAccent?}`.
- **Écart avec `prisma/schema.prisma`** : `employesCount` (E9), `statutSite` (E10), image de couverture (E1).

## `/admin/parametres`  (`routes/admin.parametres.tsx`)

- **Composants clés** : liste de définitions `dl` : Nom, Courriel, Rôle (Badge), Filiale rattachée (ou « Aucune (accès groupe entier) ») ; mention « paramètres avancés… prochaine itération ».
- **Entités de données utilisées** : `User` (`nom, email, role, filialeId`) et `companies.nom`.
- **Interactions** : lecture seule. **Pas de changement de mot de passe.**
- **Rôles / scoping** : tous les rôles connectés. La page n'est pas dans la sidebar de l'employé mais reste accessible par URL.
- **Endpoints API nécessaires** :
  - `GET /api/admin/profil` (tous rôles) : `{uuid, nom, email, role, company:{uuid,nom}|null}`. La session actuelle ne contient pas l'email (`session.user` = uuid, nom, role, companyUuid).
  - Recommandé : `POST /api/admin/profil/mot-de-passe` `{actuel, nouveau}` (validation `shared/validation/auth.ts`).
- **Écart avec `prisma/schema.prisma`** : aucun.

## `/admin/planning`  (`routes/admin.planning.tsx`)

- **Composants clés** :
  - En-tête « Planning hebdomadaire », `Select` de site (si plusieurs), bouton « Ajouter un quart ».
  - Grille : lignes = employés, colonnes = lundi→dimanche. Chaque cellule empile les quarts « HH:mm–HH:mm », le lieu, et les icônes modifier/supprimer.
  - `Dialog` de quart ; `AlertDialog` « Supprimer ce quart ? ».
- **Entités de données utilisées** :
  - `employes` (8) : `id, filialeId, nom, poste, email, statut (actif|en_conge|inactif)`.
  - `planningEntries` (7) : `id, employeId, jour (lundi…dimanche), debut "HH:mm", fin "HH:mm", lieu, note?`.
  - Constante `JOURS`.
- **Interactions** :
  - Formulaire :
    - `employeId` : select sur les employés du site.
    - `jour` : select.
    - `debut` et `fin` : `type=time`, 08:00/16:00 par défaut.
    - `lieu` : texte.
    - `note` : texte.
  - Requis : employé, début, fin et lieu. **Aucune vérification fin > début** : les quarts de nuit, comme 22:00–06:00, sont permis. Aucun contrôle de chevauchement.
  - Toasts « Quart ajouté. », « Quart mis à jour. » et « Quart supprimé. ».
  - Le statut de l'employé (`en_conge`) n'est ni affiché ni filtré.
- **Rôles / scoping** :
  - Scope sans la holding.
  - super_admin : sélecteur des 6 filiales.
  - admin_filiale : sa filiale, **quelle qu'elle soit** (y compris comptable).
  - Pas de CRUD des employés.
- **Endpoints API nécessaires** (`SUPER_ADMIN`, `ADMIN_FILIALE` scopé + module `planning`) :
  - `GET /api/admin/planning?site=&semaine=YYYY-MM-DD` : `{employes[], quarts[]}`.
  - `POST /api/admin/planning` `{employeUuid, dateDebut, dateFin, lieu, notes?}`.
  - `PATCH /api/admin/planning/[uuid]`.
  - `DELETE /api/admin/planning/[uuid]`.
  - Le serveur vérifie que l'employé appartient au site.
  - Recommandé : `GET/POST/PATCH /api/admin/employes` (D10).
- **Écart avec `prisma/schema.prisma`** :
  - **Modèle différent** : le prototype est un gabarit hebdomadaire récurrent (`jour` + heures), le schéma est daté (`dateDebut`/`dateFin` DateTime) (E18).
  - `lieu` manquant (E18).
  - `titre` requis dans le schéma mais inexistant dans le prototype (E18).
  - `Employe.statut` 3 états contre `actif Boolean` (E19).

## `/admin/mon-planning`  (`routes/admin.mon-planning.tsx`)

- **Composants clés** : en-tête « Mon planning » avec « {nom} — {poste} » ou « Aucun dossier employé associé à votre compte. », total d'heures « cette semaine » ; liste des 7 jours (« Congé » si vide).
- **Entités de données utilisées** : `employes` et `planningEntries`. **Lien User→Employe par égalité d'email** (`employes.email === user.email`).
- **Interactions** :
  - Lecture seule.
  - Total en heures arrondi à 0.1 ; les quarts de nuit sont gérés (+24 h si la fin est avant le début).
  - Pas de navigation entre semaines.
- **Rôles / scoping** : sidebar réservée à l'employé. Aucune garde : un admin qui y va voit « aucun dossier ».
- **Endpoints API nécessaires** : `GET /api/admin/mon-planning?semaine=` (`EMPLOYE`). Le serveur résout l'employé par `secure.userId`, jamais par un paramètre client.
- **Écart avec `prisma/schema.prisma`** : **aucun lien `User`↔`Employe`** (E11). Le modèle de quart diffère (E18).

## `/admin/comptable`  (`routes/admin.comptable.tsx`)

- **Composants clés** :
  - En-tête « Dossiers clients » : « n dossiers · n en retard ».
  - `Select` de statut, bouton « Ajouter ».
  - Lignes : entreprise, contact · email · forfait · échéance, notes, Badge de statut, icônes modifier/supprimer.
  - `Dialog` ; `AlertDialog`.
- **Entités de données utilisées** : `clientsComptables` (4) : `id, entreprise, contact, email, forfait (Mensuel|Trimestriel|Annuel), prochaineEcheance (date), statut (a_jour|en_retard|en_traitement), notes?`. C'est une collection **distincte** de `clients`, alors que « Atelier EG / Étienne Gagnon » est présent dans les deux.
- **Interactions** :
  - Formulaire : `entreprise`, `contact`, `email` (type email), `forfait` (select), `prochaineEcheance` (type date), `statut` (select), `notes` (textarea).
  - Requis : entreprise, contact, email et échéance.
  - Tri par échéance croissante. Filtre de statut.
  - Toasts « Dossier ajouté. », « Dossier mis à jour. » et « Dossier supprimé. ».
  - **Aucun document ni upload.**
- **Rôles / scoping** : sidebar si le scope contient `comptable`. **Route non gardée** : n'importe quel admin y accède par URL. Pas de filtre filiale, la collection est globale.
- **Endpoints API nécessaires** (`SUPER_ADMIN`, ou `ADMIN_FILIALE` de `comptable` ; module `comptable`) :
  - `GET /api/admin/comptable/dossiers?statut=`
  - `POST /api/admin/comptable/dossiers` : transaction qui crée `Client` + `DossierComptable`, ou rattache un `clientUuid` existant.
  - `PATCH /api/admin/comptable/dossiers/[uuid]`
  - `DELETE /api/admin/comptable/dossiers/[uuid]` (supprime le dossier seul ou le client aussi : à trancher).
- **Écart avec `prisma/schema.prisma`** :
  - `forfait` manquant.
  - `statut` du dossier manquant (aucun enum).
  - `typeDeclaration` et `documentsKeys` existent mais ne sont pas utilisés par le prototype.
  - `contact` et `entreprise` sont portés par `Client` (`nom`, `entreprise`) : cohérent avec la décision ouverte n°2.
  - Voir E20.

## `/admin/placement`  (`routes/admin.placement.tsx`)

- **Composants clés** : `Tabs` Candidats / Demandes / Candidatures / Offres (avec compteurs), `Select` de statut par ligne, `Switch` de publication, `Badge` Publiée / Hors ligne.
- **Entités de données utilisées** :
  - `candidats` (4) : `id, nom, email, telephone, poste, categorie (Manutention|Chauffeur classe 1|3|5|Entretien|Autre), disponibilite, statut (disponible|en_process|place), origine (local|international)`.
  - `demandesClients` (3) : `id, entreprise, contact, email, poste, categorie, quantite, debut, statut (ouverte|pourvue|annulee)`.
  - `candidatures` (3) : `id, offreId|null, nom, email, telephone, posteVise, experience, cvNom?, documents?[], statut (recue|en_revue|entrevue|refusee|embauchee), date`.
  - `offresEmploi` (4) : `id, titre, categorie, lieu, typeContrat (Temps plein|Temps partiel|Temporaire), salaire, description, publiee, date`.
- **Interactions** :
  - Candidats : recherche (`nom, poste, categorie, email`), statut modifiable. **Pas de création, d'édition ni de suppression. Pas de CV.**
  - Demandes :
    - statut modifiable ;
    - bloc « Candidats correspondants » (même `categorie`, statut ≠ `place`) avec bouton « Assigner », qui met seulement le candidat à `place`, **sans lien enregistré** ;
    - `Switch` « Publier comme offre d'emploi » : **jointure par égalité `offre.titre === demande.poste`**, fragile. Il crée une offre dont `lieu = nom de l'entreprise cliente` (**exposition publique du client**), `salaire:"À discuter"` et `typeContrat:"Temps plein"`.
  - Candidatures : statut modifiable ; documents affichés **par nom seulement** (pas de téléchargement).
  - Offres : `Switch` de publication.
- **Rôles / scoping** : sidebar si le scope contient `placement`. **Route non gardée.** Aucun filtre filiale.
- **Endpoints API nécessaires** (`SUPER_ADMIN`, ou `ADMIN_FILIALE` de `placement` ; module `placement`) :
  - `GET /api/admin/placement/candidats?q=&statut=&page=` ; `PATCH /api/admin/placement/candidats/[uuid]` `{statut}` (+ POST/DELETE si le vivier doit être alimenté manuellement).
  - `GET /api/admin/placement/demandes` (avec correspondances calculées côté serveur) ; `PATCH /api/admin/placement/demandes/[uuid]` `{statut, publiee, champs d'offre…}`.
  - `POST /api/admin/placement/demandes/[uuid]/affectations` `{candidatUuid}`.
  - `GET /api/admin/placement/candidatures?statut=&page=` ; `PATCH /api/admin/placement/candidatures/[uuid]` `{statut}`.
  - CV et documents via `GET /api/files/[key]` (`PRIVE`, scoping filiale existant).
  - Offres : selon E14.
- **Écart avec `prisma/schema.prisma`** :
  - `Candidat` : il manque `categorie`, `disponibilite`, `statut`, `origine` (E21).
  - `DemandeClient` : il manque `contact`, `email`, `categorie`, `quantite`, `dateDebut`, `statut` (E22).
  - `OffreEmploi` : absente du schéma (E14).
  - `Candidature` : `experience` manquant ; enum 5 valeurs contre 4 ; `cvKey` requis alors que le prototype a une candidature sans CV ; `adresseComplete` requis et absent du prototype (E23).
  - Aucune relation d'affectation Candidat↔Demande (E24).

---

## Écarts détectés (périmètre Holding + admin)

1. **E1 : `Company` sans image de couverture.**
   - **Prototype** : `imagePlaceholder` (Unsplash) affiché sur `/` (Companies).
   - **Schéma** : seulement `logoKey`.
   - **Proposition** : ajouter `imageKey String?` (Fichier `PUBLIC`).
2. **E2 : `Company` sans ordre d'affichage.**
   - **Prototype** : ordre implicite par `id` 1–6 et numéro « 0{id} » affiché.
   - **Schéma** : rien.
   - **Proposition** : ajouter `ordre Int @default(0)` et afficher `index+1`, jamais un id.
3. **E3 : contenu `Company` du seed ≠ prototype.**
   - **Prototype** : `mockdata.ts` a des `secteur` et `description` complets.
   - **Seed** : `prisma/seed.ts` a des secteurs abrégés et pas de description filiale.
   - **Proposition** : le script `migrate-mockdata-to-seed` prend `mockdata.ts` comme source, en le recoupant avec PROJECT_CONTEXT §2, qui fait foi (le comptable doit mentionner « création et régularisation d'entreprise »).
4. **E4 : `MembreEquipe.bio` manquant.**
   - **Prototype** : `bio` affichée sur `/a-propos` et éditée dans le CMS.
   - **Schéma** : pas de champ.
   - **Proposition** : ajouter `bio String? @db.Text`.
5. **E5 : `Partenaire.typeRelation` manquant.**
   - **Prototype** : affiché sous le nom (« Membre », « Partenaire financier »…).
   - **Schéma** : seulement `siteUrl`.
   - **Proposition** : ajouter `typeRelation String?` et garder `siteUrl`, non utilisé mais utile.
6. **E6 : images en URL externes, contre upload de fichiers.**
   - **Prototype** : champs texte « Adresse de l'image/photo/logo » ; mock en Unsplash, pravatar (visages de stock sous des noms de vraies personnes) et dicebear **SVG**.
   - **Schéma** : `imageKey`/`photoKey`/`logoKey` pointant vers `Fichier` ; `storage.ts` n'accepte que pdf/png/jpeg/webp ; la CSP bloque les hôtes externes.
   - **Proposition** : upload dans le CMS via `POST /api/admin/files` (visibilité `PUBLIC`). Au seed : télécharger les images Unsplash vers le stockage avec création des `Fichier`, laisser photos et logos à `null` avec un repli sur les initiales en UI. Ne pas conserver les photos pravatar comme photos d'équipe réelles.
7. **E7 : statut des messages.**
   - **Prototype** : `nouveau | en_cours | traite`, badge et select.
   - **Schéma** : `lu Boolean`.
   - **Proposition** : remplacer par `enum StatutMessage { NOUVEAU EN_COURS TRAITE }` `@default(NOUVEAU)` et supprimer `lu`, ou garder `lu` et simplifier l'UI à lu/non lu. Je recommande l'enum : le prototype a été validé avec 3 états.
8. **E8 : site d'origine d'un message.**
   - **Prototype** : le formulaire holding route le message vers la filiale choisie ; l'origine est perdue.
   - **Schéma** : idem.
   - **Proposition** : accepter la perte (le sujet généré « Demande — X » suffit), ou ajouter `origine String?`. Faible priorité.
9. **E9 : `Company.employesCount` absent.**
   - **Prototype** : dashboard et filiales (42/28/12/18/24/9) ; somme 133 incohérente avec les « 150+ » de `/` et les « 130+ » de `/a-propos`.
   - **Schéma** : rien. Le nombre de lignes `Employe` (1 à 3 par filiale) ne correspond pas.
   - **Proposition** : ajouter `effectif Int?` saisi par le super_admin, et aligner les chiffres marketing de `/` et `/a-propos` sur une source unique (config `shared/config/holding.ts` ou somme des `effectif`). **Le client doit donner le bon chiffre.**
10. **E10 : `Company.statutSite` absent.**
    - **Prototype** : badge actif / en maintenance / en construction (CCDPAA « en_maintenance ») ; **ne pilote rien** (aucune page publique ne le lit, `UnderConstruction` est du code mort).
    - **Schéma** : rien.
    - **Proposition** : le retirer, car c'est un badge décoratif interdit par PROJECT_CONTEXT §6. Sinon, le rendre fonctionnel (`enum StatutSite` + page de maintenance servie sur `/[slug]`).
11. **E11 : lien User↔Employe absent.**
    - **Prototype** : `mon-planning` associe par égalité d'email ; comptes démo différents du seed (employée `entretien@groupecd.ca`, alors que le seed a `employe@entretien.groupecd.ca`).
    - **Schéma** : aucun lien.
    - **Proposition** : ajouter `Employe.userId Int? @unique` avec la relation vers `User` (`onDelete: SetNull`) et résoudre par `secure.userId`. Aligner le seed : un employé lié au compte employé démo.
12. **E12 : `PageContenu` (onglet « Sections ») absent.**
    - **Prototype** : 15 sections éditables (hero, filiales, contact…) qu'**aucune page publique ne lit** ; textes publics en dur et différents.
    - **Schéma** : pas d'entité ; la checklist ne l'inclut pas.
    - **Proposition** : **retirer l'onglet** (textes éditoriaux en dur ou en config, fidèles au prototype affiché), et remplacer l'activité « contenu modifié » du dashboard par `updatedAt` des entités CMS. Alternative plus coûteuse : un modèle `SectionContenu(companyId, cle, titre, contenu)` branché sur chaque héros public. C'est au client de dire s'il veut éditer ces textes.
13. **E13 : `ordre` et `imageKey` de `Service` non exposés.**
    - **Prototype** : aucun réordonnancement ; ajout en tête ; pas d'image service.
    - **Schéma** : `ordre`, `imageKey` présents.
    - **Proposition** : ajout en fin de liste (`max(ordre)+1`) et réordonnancement simple haut/bas dans le composant CMS générique. `imageKey` de service : ne pas l'exposer tant qu'aucune page publique ne l'affiche (à vérifier par l'agent filiales).
14. **E14 : `OffreEmploi` absente, contre `DemandeClient.publiee`.**
    - **Prototype** : entité distincte (`titre, categorie, lieu, typeContrat, salaire, description, publiee, date`). 2 offres sur 4 sans demande. Jointure par titre. La demande publiée expose le nom du client comme lieu.
    - **Schéma et PROJECT_CONTEXT §7** : `DemandeClient` devient l'offre quand `publiee=true` (PROJECT_CONTEXT fait foi).
    - **Proposition** : conserver la décision de PROJECT_CONTEXT et ajouter à `DemandeClient` les champs publics nullables `titreOffre`, `lieu`, `typeContrat` (enum), `salaire`, `descriptionPublique`, `datePublication`, avec une zod qui les exige quand `publiee=true`. **Ne jamais exposer `entrepriseCliente` publiquement.** Les offres sans demande du mock deviennent des demandes « internes ». Alternative : un modèle `OffreEmploi` avec `demandeId?`, qui contredit PROJECT_CONTEXT. À toi de trancher. L'onglet « Offres » disparaît ou devient un filtre `publiee` de `/admin/placement/demandes`.
15. **E15 : réalisations holding sans vitrine.**
    - **Prototype** : 2 réalisations holding éditables dans le CMS mais affichées nulle part (pas de `/realisations` holding).
    - **Schéma** : OK.
    - **Proposition** : exclure la holding du CMS des réalisations (comme pour les services), ou ajouter une section réalisations sur `/a-propos`. À trancher.
16. **E16 : modules par filiale.**
    - **Prototype** : planning ouvert à toute filiale ; comptable et placement conditionnés par slug ; réservations conditionnées par ccdpaa.
    - **Schéma** : pas de notion de module.
    - **Proposition** : une constante partagée `shared/config/modules.ts` (slug → modules[]) et un helper serveur `requireModule(event, module)` qui vérifie le rôle et le slug de la filiale. Périmètre planning à trancher : PROJECT_CONTEXT (entretien, transport, ccdpaa) contre prototype (toutes).
17. **E17 : unicité des clients.**
    - **Prototype** : dédoublonnage par email sur tous les clients, toutes filiales confondues.
    - **Schéma** : aucune contrainte.
    - **Proposition** : `@@unique([companyId, email])` (email nullable : Postgres autorise plusieurs NULL), dédoublonnage **par filiale** et 409 sur conflit.
18. **E18 : modèle de `PlanningEntry`.**
    - **Prototype** : gabarit hebdomadaire récurrent (`jour`, `debut`/`fin` "HH:mm", `lieu`, `note`), quarts de nuit permis.
    - **Schéma** : `titre` requis, `dateDebut`/`dateFin` DateTime, `notes`, pas de `lieu`.
    - **Proposition** : garder les dates réelles (planning réel, historique, semaines successives), ajouter `lieu String`, rendre `titre` optionnel ou le supprimer ; UI en grille semaine avec navigation par semaine ; zod `dateFin > dateDebut` (le passage de nuit est géré naturellement par les dates).
    - **Coût** : saisie semaine par semaine. Prévoir plus tard une action « dupliquer la semaine ».
19. **E19 : statut `Employe`.**
    - **Prototype** : `actif | en_conge | inactif`.
    - **Schéma** : `actif Boolean`.
    - **Proposition** : `enum StatutEmploye { ACTIF EN_CONGE INACTIF }`, ou garder le booléen si « en congé » n'a pas d'effet métier (le prototype ne l'utilise pas). Faible priorité.
20. **E20 : `DossierComptable`.**
    - **Prototype** : `forfait` (Mensuel / Trimestriel / Annuel) et `statut` (à jour / en traitement / en retard) ; aucun document.
    - **Schéma** : `typeDeclaration String?`, `echeance`, `documentsKeys[]`, `notes` ; ni forfait ni statut.
    - **Proposition** : ajouter `forfait enum ForfaitComptable?` et `statut enum StatutDossier @default(A_JOUR)`. Garder `documentsKeys` (upload à ajouter à l'UI ou à reporter). Le doublon « Atelier EG » dans `clients` et `clientsComptables` soutient la décision ouverte n°2 (Dossier étend Client). Le seed rattache par email.
21. **E21 : `Candidat` incomplet.**
    - **Prototype** : `categorie` (enum 6), `disponibilite`, `statut` (disponible / en_process / placé), `origine` (local / international). Le rapprochement demande↔candidat repose sur `categorie`.
    - **Schéma** : `nomComplet, email, telephone?, posteRecherche?, cvKey?, notes?`.
    - **Proposition** : ajouter `categorie enum CategoriePoste`, `disponibilite String?`, `statut enum StatutCandidat @default(DISPONIBLE)`, `origine enum OrigineCandidat`.
22. **E22 : `DemandeClient` incomplète.**
    - **Prototype** : `contact`, `email`, `categorie`, `quantite`, `debut`, `statut` (ouverte / pourvue / annulée).
    - **Schéma** : `entrepriseCliente, posteRecherche, description, publiee`.
    - **Proposition** : ajouter `contactNom`, `contactEmail`, `categorie CategoriePoste`, `quantite Int @default(1)`, `dateDebut DateTime?`, `statut enum StatutDemande @default(OUVERTE)`. Envisager un `clientId?` vers `Client` pour relier au CRM.
23. **E23 : `Candidature`.**
    - **Prototype** : `experience` (texte) ; statut `recue / en_revue / entrevue / refusee / embauchee` ; `cvNom` optionnel ; pas d'adresse.
    - **Schéma** : pas d'`experience` ; `StatutCandidature` NOUVELLE / EN_REVISION / RETENUE / REJETEE (aligné sur la checklist, donc sur les retours client) ; `cvKey` et `adresseComplete` requis.
    - **Proposition** : garder l'enum et les champs requis du schéma (retours client post-démo) et ajouter `experience String? @db.Text`. Correspondance au seed : recue→NOUVELLE, en_revue et entrevue→EN_REVISION, refusee→REJETEE, embauchee→RETENUE. **Ne pas seeder les candidatures** (pas de CV réel), ou les seeder avec un PDF factice. À trancher.
24. **E24 : affectation Candidat↔Demande non tracée.**
    - **Prototype** : « Assigner » passe seulement le candidat à `place`.
    - **Schéma** : aucune relation.
    - **Proposition** : ajouter une table `Affectation(candidatId, demandeId, dateAffectation)` avec `@@unique([candidatId, demandeId])`, ou un `demandeId?` sur `Candidat`. La table est préférable (historique).
25. **E25 : `SuggestionProduit` invisible en admin.**
    - **Prototype** : collection séparée (`produit, origine, commentaire`) jamais affichée dans l'admin.
    - **Schéma** : `MessageContact` de type `SUGGESTION_PRODUIT` avec `produitSouhaite` ; pas de pays d'origine.
    - **Proposition** : l'afficher dans `/admin/messages` (badge de type et filtre `type`) et ajouter `origineProduit String?`. Le champ exact est à confirmer par l'agent CCDPAA / Boissons.
26. **E26 : sécurité et scoping à ne PAS reproduire.**
    - **Prototype** :
      - Comptable et placement non gardés.
      - Employé redirigé vers le dashboard avec les messages de sa filiale.
      - Réservations non filtrées.
      - Mots de passe démo affichés sur le login.
    - **Proposition** :
      - `requireRole` + `requireModule` sur chaque `/api/admin/**`.
      - Middleware front : `EMPLOYE` redirigé vers `/admin/mon-planning`.
      - Encart démo supprimé.
27. **E27 : gestion des comptes absente (D10).**
    - **Prototype et checklist** : ni création de comptes, ni reset, ni changement de mot de passe, ni CRUD des employés.
    - **Proposition** : ajouter à la checklist `/admin/utilisateurs` (SUPER_ADMIN : CRUD `User` et lien `Employe`) et `/admin/equipe-operations` ou un CRUD employés dans `/admin/planning`. Sinon, le produit dépend du seed pour tout nouvel employé.
28. **E28 : Loi 25 (Québec), hors prototype.**
    - **Constat** : les formulaires collectent nom, email, téléphone et CV ; le footer pointe « Politique de confidentialité » vers `#`.
    - **Proposition** : ajouter une page `/confidentialite` et une mention de consentement sous chaque formulaire public. Contenu fourni par le client. À ajouter à la checklist Holding.
29. **E29 : défauts du prototype à ne pas porter.**
    - **Constats** :
      - CTA Hero `#contact` sans cible sur `/`.
      - Liens sociaux et légaux en `href="#"`.
      - Coordonnées factices (`+1 (514) 000-0000`).
      - Google Fonts externes (impact CSP de nuxt-security).
    - **Proposition** :
      - CTA vers `/contact`.
      - Liens sociaux masqués tant que les URLs sont inconnues.
      - Coordonnées dans `shared/config/holding.ts`.
      - Polices auto-hébergées (`@nuxt/fonts`) pour rester compatible avec la CSP.
30. **Divergences de routes D1 à D10** (voir la table de correspondance) :
    - **D1** : `/admin/dashboard` contre `/admin`.
    - **D2** : Sections absentes de la checklist.
    - **D3** : réservations en onglet contre route dédiée.
    - **D4** : planning, une route scopée contre trois routes, et périmètre différent.
    - **D5** : `/admin/mon-planning` absente de la checklist.
    - **D6** : `/admin/comptable` contre `/admin/comptable/dossiers`.
    - **D7** : onglets placement contre routes, et onglet Offres sans contrepartie.
    - **D8** : `/admin/filiales` absente.
    - **D9** : `/admin/parametres` absente.
    - **D10** : gestion des comptes absente partout.
    - **Proposition** : ajouter D5, D8, D9 et D10 à la checklist. Pour D1, garder `/admin` comme dashboard (conforme à `ADMIN_HOME_PATH`). Pour D4, D6 et D7, suivre la recommandation donnée sous la table.

## Mockdata Holding/transverse

Les collections de `prototype_react/cd-holding-nexus/src/data/mockdata.ts` utiles au script `scripts/migrate-mockdata-to-seed.ts` :

| Collection | Nb | Champs | Cible Prisma / remarque seed |
|---|---|---|---|
| `companies` | 6 (pas d'entrée holding) | `id, slug, nom, secteur, description, couleurAccent, imagePlaceholder, employesCount, statutSite` | `Company` (FILIALE), upsert par `slug`. `ordre` = position dans le tableau. Image → E1/E6. `employesCount`/`statutSite` → E9/E10. La holding reste créée par le seed actuel (`slug:'holding'`). |
| `users` | 3 | `id, nom, email, motDePasse, role, filialeId` | **Ne pas migrer les mots de passe.** Les comptes restent pilotés par `.env` (seed actuel). Aligner le choix de la filiale démo (comptable dans le prototype, entretien dans le seed). |
| `pagesContenu` | 15 (holding 3) | `id, filialeId, section, titre, contenu, derniereModification` | Aucune cible (E12). À ignorer sauf décision contraire. |
| `services` | 26 (entretien 5, transport 4, comptable 5, placement 4, ccdpaa 4, boissons 4 ; holding 0) | `id, filialeId, titre, description` | `Service`. `ordre` = index dans la filiale selon l'ordre du tableau, pas l'id : les ids 25/26 sont en fin de filiale. Clé d'idempotence `(companyId, titre)`. |
| `equipe` | 15 (holding 3, 2 par filiale) | `id, filialeId, nom, poste, photoPlaceholder, bio` | `MembreEquipe` (+ `bio`, E4). `photoKey` null (E6). |
| `realisations` | 16 (holding 2, entretien 3, transport 3, autres 2) | `id, filialeId, titre, description, imagePlaceholder, date` | `Realisation` (`date` → `dateRealisation`). Image téléchargée → `Fichier PUBLIC` (E6). Holding : E15. |
| `partenaires` | 15 (holding 3, 2 par filiale) | `id, filialeId, nom, logoPlaceholder, typeRelation` | `Partenaire` (+ `typeRelation`, E5). `logoKey` null (SVG dicebear refusé). |
| `messagesContact` | 7 (holding 1, 1 par filiale) | `id, filialeId, nom, email, telephone?, sujet, message, statut, date` | `MessageContact` (`date` → `createdAt`, statut → E7). Données de démo uniquement. |
| `suggestionsProduits` | 2 (ccdpaa 1, boissons 1) | `id, filialeId, nom, email, produit, origine, commentaire, date` | `MessageContact` `type=SUGGESTION_PRODUIT` (`produit` → `produitSouhaite`, `commentaire` → `message`, `origine` → E25). Démo. |
| `reservationsRestaurant` | 3 (pas de `filialeId`, implicitement ccdpaa) | `id, nom, email, telephone, date, heure, personnes, note?, statut, creeLe` | `ReservationRestaurant` (`date`+`heure` → `dateReservation`, `personnes` → `nombrePersonnes`). Démo. |
| `employes` | 8 (entretien 3, transport 2, comptable 1, ccdpaa 1, boissons 1) | `id, filialeId, nom, poste, email, statut` | `Employe` (statut → E19, lien `userId` → E11). Démo. |
| `planningEntries` | 7 | `id, employeId, jour, debut, fin, lieu, note?` | `PlanningEntry` : il faut convertir `jour` en date réelle, par exemple sur la semaine courante du seed (E18). Démo. |
| `clients` | 5 (entretien, transport, comptable, boissons, ccdpaa) | `id, nom, entreprise, email, telephone, filialeId, statut, notes, creeLe` | `Client` (`actif` → `CLIENT_ACTIF`, `creeLe` → `dateAjout`). Démo. |
| `clientsComptables` | 4 | `id, entreprise, contact, email, forfait, prochaineEcheance, statut, notes?` | `Client` (companyId comptable, `contact` → `nom`) + `DossierComptable` (`prochaineEcheance` → `echeance` ; forfait/statut → E20). Dédoublonner « Atelier EG » par email avec `clients`. Démo. |
| `candidats` | 4 | `id, nom, email, telephone, poste, categorie, disponibilite, statut, origine` | `Candidat` (companyId placement ; E21). Démo. |
| `demandesClients` | 3 | `id, entreprise, contact, email, poste, categorie, quantite, debut, statut` | `DemandeClient` (E22). Démo. |
| `offresEmploi` | 4 (3 publiées) | `id, titre, categorie, lieu, typeContrat, salaire, description, publiee, date` | Selon E14 : fusion dans `DemandeClient` (champs publics) ou modèle dédié. Démo, mais **contenu public** de `/placement/offres`. |
| `candidatures` | 3 (1 spontanée, 1 sans CV) | `id, offreId, nom, email, telephone, posteVise, experience, cvNom?, documents?, statut, date` | `Candidature` : `cvKey` et `adresseComplete` requis, donc non seedable sans fichier factice (E23). |
| `JOURS` (constante) | 7 | `lundi…dimanche` | Libellés UI du planning, à mettre dans `shared/config`. |

**Contenu réel validé par le client** (priorité du script) : `companies`, `services`, `equipe`, `realisations`, `partenaires`. Tout le reste est de la **donnée de démonstration** : à seeder seulement en dev ou démo, derrière un drapeau (`SEED_DEMO_DATA=true`), jamais en production.

Fichiers de référence :
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/data/mockdata.ts`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/lib/admin-scope.ts`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/admin/CollectionEditor.tsx`
- `/home/cabrel/projects/cd-holding/prisma/schema.prisma`
- `/home/cabrel/projects/cd-holding/prisma/seed.ts`
- `/home/cabrel/projects/cd-holding/server/api/public/contact.post.ts`
- `/home/cabrel/projects/cd-holding/server/utils/auth.ts`
- `/home/cabrel/projects/cd-holding/shared/utils/roles.ts`


---

<a id="partie-2"></a>

# Partie 2 — Inventaire de conversion : filiales `entretien` + `transport`

## Ce qui change par rapport à ta demande

Tu as demandé un inventaire par fichier de route. Quatre points s'écartent de cette lecture littérale :

- **Les 12 fichiers de route ne contiennent aucune logique.** Chacun ne fait que monter un composant partagé (`SubLayout`, `SubHome`, `SubServicesPage`, `SubRealisationsPage`, `SubAboutPage`, `SubContactPage`) avec `slug="entretien"` ou `slug="transport"`. Ce qui distingue vraiment les deux filiales, c'est `subConfig.ts` (textes, champs du formulaire, email, téléphone) et les données filtrées par `filialeId`. J'ai donc tout décrit une fois dans la section « Composants filiale partagés ». Les entrées par route ne donnent que les différences.
- **Les formulaires de contact ont un vrai problème de modèle.** Le prototype colle les champs structurés dans le texte de `message`. Le endpoint existant `server/api/public/contact.post.ts` dit en commentaire qu'il « sera dupliqué/adapté par filiale ». Je propose plutôt un seul endpoint, avec un zod qui choisit les champs selon la filiale, et une colonne JSON pour ces champs. Détail : écart 9.
- **J'ai relevé deux écarts que le brief ne demandait pas explicitement :**
  - deux violations du §6 dans le prototype (dégradés) et un id numérique affiché à l'écran ;
  - un risque légal (Loi 25) : le formulaire collecte des données personnelles, alors que la politique de confidentialité n'est qu'un lien `#`.
- **Le retour client « supermarchés » n'est qu'à moitié appliqué dans le prototype.** Le service existe dans `mockdata.ts`, mais il n'apparaît pas dans l'aperçu de l'accueil, ni dans le texte d'accroche, ni dans la meta description SEO, ni dans les options du formulaire. Détail : écart 16.

---

## Composants filiale partagés

Ces composants sont utilisés par les 6 filiales. Chemins : `prototype_react/cd-holding-nexus/src/components/subsidiary/…`

| Composant | Rôle | Données lues |
|---|---|---|
| `SubLayout.tsx` | Coquille de la filiale (`Outlet`). Construit la nav : Accueil, Services, [Restaurant pour ccdpaa], [Offres pour placement], Réalisations, À propos, Contact. Pas d'entrée conditionnelle pour entretien/transport. | `companies` (via `slug`), `SUB_CONFIG[slug]` : `shortName`, `email`, `phone` |
| `SubHeader.tsx` | Header fixe. Fond crème floué dès que `scrollY > 12`. Lien retour « Groupe CD » (desktop). Nav avec état actif `exact`. CTA « Nous joindre » (couleur d'accent) vers `/<slug>/contact`, doublon de l'entrée « Contact ». Menu mobile animé en hauteur et opacité (`AnimatePresence`), sans `aria-expanded`. | props : `name`, `accent`, `nav[]`, `contactTo` |
| `SubFooter.tsx` | Footer navy : `company.secteur` (couleur d'accent), `company.nom`, texte fixe « Une filiale du Groupe CD… », email, téléphone, adresse (« Montréal, Québec, Canada » par défaut). Trois icônes sociales et deux liens légaux, tous en `href="#"`. Bordure d'accent au survol, gérée en JS. | `Company` (`nom`, `secteur`, `couleurAccent`), `{email, phone}` |
| `SubHero.tsx` | Hero sur 12 colonnes. Forme SVG « blob » en accent à 14 % d'opacité. h1 en trois lignes (`headlineLead` / *`headlineAccent`* en italique / `headlineTail`), puis `heroPitch`, CTA `ctaLabel` et « Découvrir nos services ». Image au format 4/5. | `SUB_CONFIG` : `tagline`, `headline*`, `heroPitch`, `heroImage`, `ctaLabel`, `shortName` ; `company.couleurAccent` |
| `pages/SubHome.tsx` | Hero, puis aperçu de 3 services en liste numérotée « 01…03 » (bordure haute, 12 colonnes), puis aperçu de 3 réalisations sur fond navy (3 colonnes, celle du milieu décalée `md:mt-16`), puis CTA final « Un projet à discuter ? ». | `services.slice(0,3)`, `realisations.slice(0,3)` |
| `pages/SubServicesPage.tsx` | En-tête éditorial avec `heroPitch`. Chaque service est affiché en rangée alternée gauche/droite : grand numéro, titre, description, et un bloc visuel **en dégradé linéaire** qui affiche **`String(s.id).padStart(2,"0")`**. Encadré CTA navy « Un besoin qui ne rentre pas exactement dans une case ? ». | `services` : `id`, `titre`, `description` |
| `pages/SubRealisationsPage.tsx` | Portfolio en grille de 12 colonnes. Les tailles suivent un motif fixe de 6 cases (8/4/5/7/6/6) pour éviter une grille répétitive. Image avec zoom au survol (1.03, 700 ms), date au format `fr-CA` {year, month:long}, titre, description. | `realisations` : `id`, `titre`, `description`, `imagePlaceholder`, `date` |
| `pages/SubAboutPage.tsx` | Trois sections. (1) Histoire : `company.description` + paragraphe fixe + monogramme (1re lettre de `shortName`) sur un **dégradé radial**. (2) Équipe sur fond navy : photo ronde, poste, nom, `bio`. (3) Partenaires : logo 56 px, `nom`, `typeRelation`. | `company.description`, `equipe`, `partenaires` |
| `pages/SubContactPage.tsx` | 5 colonnes de texte (`contactIntro`, `contactHeadline` avec `pre-line`, `contactBaselinE`, email, téléphone, « Montréal, Québec ») et 7 colonnes de formulaire. | `SUB_CONFIG` |
| `GenericContactForm.tsx` | Formulaire généré à partir de `SUB_CONFIG[slug].fields` (`text`, `email`, `tel`, `select`, `date`, `textarea`). react-hook-form avec `required: true` sans message. À l'envoi : faux délai de 500 ms, puis `messages.add({ filialeId, nom, email, telephone, sujet: cfg.contactIntro, message: "k: v · k: v…", statut: "nouveau", date })`. Toast `sonner` : succès « Demande reçue — Merci {nom}, {successMsg}. », ou erreur « Formulaire incomplet ». Remise à zéro du formulaire. | `SUB_CONFIG.fields`, `successMsg`, `contactIntro` |
| `formStyles.ts` | Classes `inputBase`, `labelBase`, `errorText`. | — |
| `subConfig.ts` | `SUB_CONFIG` : un objet par filiale (textes marketing et définition des champs du formulaire). Ce n'est **pas** dans `mockdata.ts`. | — |

**Mouvements à reproduire** (framer-motion, à porter vers `@vueuse/motion`) :

- **Hero** : h1 en fondu + montée de 20 px (0,7 s) ; image en fondu + échelle 0,96 → 1 (0,9 s).
- **Apparitions au défilement, jouées une seule fois** :

| Élément | Décalage entre éléments | Autres réglages |
|---|---|---|
| Rangées de services (accueil) | 0,06 s | — |
| Réalisations (accueil) | 0,08 s | — |
| Rangées de services (page Services) | — | durée 0,6 s, marge -100 px |
| Articles de réalisations | (i % 3) × 0,05 s | marge -80 px |
| Membres de l'équipe | 0,08 s | — |

- **Header et menu mobile** : transition du header au scroll ; ouverture/fermeture du menu mobile en hauteur.
- **Toasts** du formulaire de contact.

Aucune modale, aucun onglet, aucun filtre sur ces 12 routes.

**Composants `ui/**` réellement utilisés** : aucun, à part `sonner` (toast). Tout est en Tailwind brut. En Vue : `Input`, `Select`, `Textarea`, `Label` et `Button` de shadcn-vue, avec la même apparence que `formStyles`.

---

## Layout `/entretien/**` (`routes/entretien.tsx`)
- **Composants clés** : `SubLayout` (+ `SubHeader` et `SubFooter`). Meta `head` : title « Chaudetcha Entretiens et Sanitations — Entretien ménager à Montréal », description et og:title/og:description (« bureaux, résidences et chantiers »).
- **Entités de données utilisées** : `Company` (`slug`, `nom`, `secteur`, `couleurAccent`) ; `SUB_CONFIG.entretien` (`shortName`, `email` = `entretien@groupe-cd.ca`, `phone` = `+1 (514) 000-1001`).
- **Interactions** : menu mobile (bascule), header qui change au scroll, nav active. Aucun formulaire.
- **Endpoints API nécessaires** : `GET /api/public/companies/[slug]` (public) → `{ uuid, slug, nom, nomCourt, secteur, description, couleurAccent, email, telephone, adresse, heroImageUrl }`. Le slug est validé contre une liste fixe des 7 slugs (holding comprise, pour réutiliser l'endpoint côté holding), 404 sinon. `select` explicite, aucun `id` ni FK. Mis en cache via l'ISR de la page.
- **Écart avec prisma/schema.prisma** : `Company` n'a ni `nomCourt`, ni `email`, ni `telephone`, ni `adresse`, ni `heroImageKey` (écarts 3 et 4). `Company.description` n'est pas seedée pour les filiales (écart 5). La meta ne mentionne pas les supermarchés (écart 16).

## `/entretien` (`routes/entretien.index.tsx` → `SubHome`)
- **Composants clés** : `SubHero`, puis aperçu des services, aperçu des réalisations (fond navy), CTA final.
- **Entités de données utilisées** :
  - `Service` (`id`, `filialeId`, `titre`, `description`), les 3 premiers ;
  - `Realisation` (`id`, `filialeId`, `titre`, `imagePlaceholder`, `date`), les 3 premières ;
  - `SUB_CONFIG.entretien` (`tagline`, `headlineLead`/`headlineAccent`/`headlineTail`, `heroImage`, `heroPitch`, `ctaLabel` = « Obtenir une soumission », `shortName`) ;
  - `Company.couleurAccent`.
- **Interactions** : aucun formulaire. Mouvements : hero, puis apparitions au défilement des services (décalage 0,06 s) et des réalisations (décalage 0,08 s, colonne du milieu décalée). Liens vers `/entretien/services`, `/entretien/realisations`, `/entretien/contact`.
- **Endpoints API nécessaires** (publics) : `GET /api/public/companies/[slug]/services?limit=3` → `[{ uuid, titre, description, imageUrl }]` trié par `ordre` ; `GET /api/public/companies/[slug]/realisations?limit=3` → `[{ uuid, titre, description, imageUrl, dateRealisation }]` trié par `ordre`. `limit` : zod `int` de 1 à 50.
- **Écart avec prisma/schema.prisma** :
  - `imagePlaceholder` (URL Unsplash) correspond à `imageKey` (clé `Fichier`), à migrer (écart 13) ;
  - `date` au format `YYYY-MM-DD` correspond à `dateRealisation DateTime?` : risque de décalage de fuseau (écart 12) ;
  - les textes du hero n'ont pas de modèle (écart 7).

## `/entretien/services` (`routes/entretien.services.tsx` → `SubServicesPage`)
- **Composants clés** : en-tête éditorial, rangées de services alternées, encadré CTA navy. Meta : « Services d'entretien — Chaudetcha Entretiens », description « Entretien de bureaux, résidentiel régulier, nettoyage après construction et désinfection » (sans les supermarchés).
- **Entités de données utilisées** : `Service` (`id`, `filialeId`, `titre`, `description`), 5 éléments : ids 1, 2, 3, 4 et **25 « Nettoyage et entretien des supermarchés »** ; `SUB_CONFIG.entretien.heroPitch` ; `Company.couleurAccent`.
- **Interactions** : apparition au défilement de chaque rangée (0,6 s). Aucun formulaire.
- **Endpoints API nécessaires** : `GET /api/public/companies/[slug]/services` (public, tous, triés par `ordre`).
- **Écart avec prisma/schema.prisma** : champs couverts (`titre`, `description`, `ordre` déduit de l'index). Le prototype n'utilise pas `Service.imageKey` et le remplace par un dégradé qui affiche l'id numérique (écart 14). Retour client : présent dans les données mais peu visible (écart 16).

## `/entretien/realisations` (`routes/entretien.realisations.tsx` → `SubRealisationsPage`)
- **Composants clés** : en-tête « Portfolio », grille éditoriale aux tailles variées. Meta : « Réalisations — Chaudetcha Entretiens ».
- **Entités de données utilisées** : `Realisation` (`id`, `filialeId`, `titre`, `description`, `imagePlaceholder`, `date`), 3 éléments (ids 3, 4, 5).
- **Interactions** : apparitions au défilement (décalage (i%3)×0,05 s), zoom de l'image au survol. Aucun filtre ni pagination.
- **Endpoints API nécessaires** : `GET /api/public/companies/[slug]/realisations` (public).
- **Écart avec prisma/schema.prisma** : écarts 12 (date) et 13 (image). Avec 3 éléments seulement, le motif de tailles (8/4/5) laisse 7 colonnes vides sur desktop : à traiter en phase 3 avec un motif adapté au nombre d'éléments.

## `/entretien/a-propos` (`routes/entretien.a-propos.tsx` → `SubAboutPage`)
- **Composants clés** : sections Histoire, Équipe (navy) et Partenaires.
- **Entités de données utilisées** :
  - `Company.description` ;
  - `MembreEquipe` (`id`, `filialeId`, `nom`, `poste`, `photoPlaceholder`, `bio`), 2 éléments : Jean Tremblay, Awa Diallo ;
  - `Partenaire` (`id`, `filialeId`, `nom`, `logoPlaceholder`, `typeRelation`), 2 éléments : Groupe Immobilier Solaris, Écolo Produits ;
  - `SUB_CONFIG.shortName`.
- **Interactions** : apparition au défilement des membres (décalage 0,08 s). Aucun formulaire.
- **Endpoints API nécessaires** : `GET /api/public/companies/[slug]/equipe` → `[{ uuid, nom, poste, bio, photoUrl }]` ; `GET /api/public/companies/[slug]/partenaires` → `[{ uuid, nom, typeRelation, siteUrl, logoUrl }]`. Tous deux publics, triés par `ordre`.
- **Écart avec prisma/schema.prisma** :
  - **`MembreEquipe.bio` absent** (écart 1) ;
  - **`Partenaire.typeRelation` absent** (écart 2) ;
  - `Company.description` non seedée pour les filiales (écart 5) ;
  - dégradé radial, contraire au §6 (écart 15) ;
  - photos pravatar et logos dicebear à ne pas migrer (écart 13).

## `/entretien/contact` (`routes/entretien.contact.tsx` → `SubContactPage` + `GenericContactForm`)
- **Composants clés** : colonne de texte (« Obtenir une soumission », « Parlez-nous de votre espace. »), formulaire générique. Meta : « Contact — Chaudetcha Entretiens ».
- **Entités de données utilisées** : `MessageContact` tel que créé par le prototype (`filialeId`, `nom`, `email`, `telephone`, `sujet` = `contactIntro`, `message` = champs concaténés, `statut: "nouveau"`, `date`) ; `SUB_CONFIG.entretien` (`fields`, `successMsg`, `email`, `phone`).
- **Interactions** : formulaire avec 6 champs, tous obligatoires :
  - `nom` : texte ;
  - `telephone` : tel ;
  - `email` : email, pleine largeur ;
  - `type` « Type de propriété » : select parmi [Bureau / commerce, Résidence / condo, Chantier / rénovation, Autre] ;
  - `frequence` : select parmi [Unique, Hebdomadaire, Bi-mensuelle, Mensuelle] ;
  - `message` « Détails » : textarea de 4 lignes, pleine largeur.

  Validation attendue (zod côté client **et** serveur) : nom de 2 à 120 caractères ; email valide ; téléphone de 7 à 30 caractères, format nord-américain toléré ; `type` et `frequence` dans leur enum ; message de 10 à 5 000 caractères ; honeypot `website` vide. Erreurs affichées sous chaque champ (dans le prototype, l'échec de validation est **silencieux** : écart 17). Toast de succès avec `successMsg`, puis remise à zéro.
- **Endpoints API nécessaires** : `POST /api/public/contact` (public, déjà en place, à étendre). Corps : `{ companySlug: "entretien", nom, email, telephone, website, details: { typePropriete, frequence }, message }`. Réponses : `201 { ok: true }`, `400` (zod), `404` (slug inconnu), `413`, `429` (limite de débit). `sujet` est calculé côté serveur, jamais fourni par le client.
- **Écart avec prisma/schema.prisma** :
  - pas de colonne pour les champs structurés (`type`, `frequence`) : écart 9 ;
  - statut en 3 états dans le prototype contre `lu Boolean` dans le schéma : écart 10 ;
  - `telephone` obligatoire ici mais optionnel dans le schéma et le zod actuel : à imposer dans le zod de la filiale, sans toucher au schéma ;
  - aucune option supermarché dans le select : écart 16.

---

## Layout `/transport/**` (`routes/transport.tsx`)
- **Composants clés** : `SubLayout` (idem entretien). Meta : « Chaudetcha Transport et Logistique — Transport et déménagement au Québec », avec og:title et og:description.
- **Entités de données utilisées** : `Company` id 2 (`nom`, `secteur` = « Transport, déménagement et logistique », `couleurAccent` `#D85A30`) ; `SUB_CONFIG.transport` (`shortName` « Chaudetcha Transport », `email` `transport@groupe-cd.ca`, `phone` `+1 (514) 000-1002`).
- **Interactions** : idem entretien.
- **Endpoints API nécessaires** : `GET /api/public/companies/[slug]` (public).
- **Écart avec prisma/schema.prisma** : écarts 3, 4 et 5 comme pour entretien. En plus, le `secteur` de mockdata diffère de celui du seed, qui suit PROJECT_CONTEXT §2 (écart 6).

## `/transport` (`routes/transport.index.tsx` → `SubHome`)
- **Composants clés** : identiques à `/entretien`.
- **Entités de données utilisées** : `Service` (3 premiers sur 4 : ids 5, 6, 7) ; `Realisation` (ids 6, 7, 8) ; `SUB_CONFIG.transport` (headline « Transporter, / *déménager,* / livrer. », `ctaLabel` « Demander un devis », `heroImage` Unsplash).
- **Interactions** : identiques à `/entretien`.
- **Endpoints API nécessaires** : `GET /api/public/companies/[slug]/services?limit=3` ; `GET /api/public/companies/[slug]/realisations?limit=3`.
- **Écart avec prisma/schema.prisma** : écarts 7, 12 et 13.

## `/transport/services` (`routes/transport.services.tsx` → `SubServicesPage`)
- **Composants clés** : identiques à `/entretien/services`. Meta : « Services — Chaudetcha Transport ».
- **Entités de données utilisées** : `Service`, 4 éléments (ids 5 à 8 : Déménagement résidentiel, Déménagement commercial, Transport de marchandises, Logistique du dernier kilomètre).
- **Interactions** : apparition au défilement.
- **Endpoints API nécessaires** : `GET /api/public/companies/[slug]/services`.
- **Écart avec prisma/schema.prisma** : aucun champ manquant. Dégradé et id affiché : écart 14.

## `/transport/realisations` (`routes/transport.realisations.tsx` → `SubRealisationsPage`)
- **Composants clés** : identiques. Meta : « Réalisations — Chaudetcha Transport ».
- **Entités de données utilisées** : `Realisation`, 3 éléments (ids 6, 7, 8).
- **Interactions** : identiques.
- **Endpoints API nécessaires** : `GET /api/public/companies/[slug]/realisations`.
- **Écart avec prisma/schema.prisma** : écarts 12 et 13. Même trou de grille avec 3 éléments.

## `/transport/a-propos` (`routes/transport.a-propos.tsx` → `SubAboutPage`)
- **Composants clés** : identiques.
- **Entités de données utilisées** : `MembreEquipe`, 2 éléments (Marc Bélanger, Sofia Rivera ; avec `bio`) ; `Partenaire`, 2 éléments (Distribution Boréale « Client logistique », Assurances Trans-Canada « Partenaire assurances ») ; `Company.description`.
- **Interactions** : identiques.
- **Endpoints API nécessaires** : `GET /api/public/companies/[slug]/equipe` ; `GET /api/public/companies/[slug]/partenaires`.
- **Écart avec prisma/schema.prisma** : écarts 1, 2, 5, 13 et 15.

## `/transport/contact` (`routes/transport.contact.tsx` → `SubContactPage` + `GenericContactForm`)
- **Composants clés** : identiques. Textes : « Demander un devis », « Décrivez-nous votre trajet. ». Meta : « Devis — Chaudetcha Transport ».
- **Entités de données utilisées** : `MessageContact` (même correspondance qu'entretien, `sujet` = « Demander un devis ») ; `SUB_CONFIG.transport.fields`.
- **Interactions** : formulaire avec 8 champs, tous obligatoires :
  - `nom` : texte ;
  - `telephone` : tel ;
  - `email` : pleine largeur ;
  - `type` « Type de transport » : select parmi [Déménagement résidentiel, Déménagement commercial, Transport de marchandises, Dernier kilomètre] ;
  - `date` « Date souhaitée » : date ;
  - `origine` : « Ville / code postal » ;
  - `destination` : « Ville / code postal » ;
  - `message` « Détails » : textarea de 4 lignes.

  Validation attendue : comme entretien, plus `date` au format ISO et **postérieure ou égale à aujourd'hui (fuseau America/Toronto)**, `origine` et `destination` de 2 à 120 caractères. Toast de succès « …notre répartiteur vous recontacte rapidement ».
- **Endpoints API nécessaires** : `POST /api/public/contact` (public). Corps `{ companySlug: "transport", …, details: { typeTransport, dateSouhaitee, origine, destination } }`.
- **Écart avec prisma/schema.prisma** : 4 champs structurés sans colonne (écart 9) ; écart 10.

---

## Endpoints transverses (hors routes publiques, pour que le contenu soit administrable)

Ils sont servis par `/admin/contenu/*` et `/admin/messages` côté holding. Je les liste pour que la cartographie soit complète, pas à construire dans ce périmètre.

- **CMS, pour chaque ressource `services` | `realisations` | `equipe` | `partenaires`** :
  - `GET /api/admin/<ressource>?companySlug=` ;
  - `POST /api/admin/<ressource>` ;
  - `PATCH /api/admin/<ressource>/[uuid]` ;
  - `DELETE /api/admin/<ressource>/[uuid]` ;
  - `PATCH /api/admin/<ressource>/ordre` (corps `{ uuids: string[] }`).

  Rôles : `SUPER_ADMIN`, ou `ADMIN_FILIALE` limité de force à sa `companyId` de session (le `companySlug` fourni est ignoré, ou 403 s'il ne correspond pas). Images : `POST /api/admin/files` (existant) crée un `Fichier` `PUBLIC`.
- **Messages** : `GET /api/admin/messages` (existant, à paginer) ; `PATCH /api/admin/messages/[uuid]` (statut). Mêmes règles de rôle.

---

## Écarts détectés (entretien + transport)

**Règle d'arrêt de la phase 1 : ne pas modifier le schéma Prisma avant ta confirmation.**

1. **`MembreEquipe.bio`**. Le prototype affiche `bio` (1 phrase par membre, sur toutes les filiales) ; le schéma n'a pas ce champ. → Ajouter `bio String? @db.Text`.
2. **`Partenaire.typeRelation`**. Le prototype l'affiche sous chaque logo (« Client-partenaire », « Fournisseur certifié », « Client logistique », « Partenaire assurances ») ; le schéma n'a pas ce champ. → Ajouter `typeRelation String?` en texte libre : les valeurs sont trop variées pour une enum.
3. **Coordonnées de la filiale sur `Company`**. `SUB_CONFIG` contient `shortName`, `email`, `phone`, et l'adresse est codée en dur (« Montréal, Québec ») ; le schéma n'a rien de tout ça. Ces données sont réutilisées par le header, le footer, la page contact et les futures données structurées SEO (`LocalBusiness`). → Ajouter `nomCourt String?`, `email String?`, `telephone String?`, `adresse String?` sur `Company`.
4. **Image du hero de la filiale**. Le prototype a `Company.imagePlaceholder` et `SUB_CONFIG.heroImage` (même photo Unsplash) ; le schéma n'a que `logoKey`. → Ajouter `heroImageKey String?` (clé `Fichier` `PUBLIC`).
5. **`Company.description` des filiales non seedée**. Le prototype l'affiche en tête de `/a-propos` ; le seed ne la renseigne que pour la holding. → Le script `migrate-mockdata-to-seed` la remplit depuis `companies[].description` (mise à jour seulement si le champ est null). Aucun changement de schéma.
6. **`Company.secteur` de transport**. Le prototype dit « Transport, déménagement et logistique », le seed et PROJECT_CONTEXT §2 disent « Transport de marchandises, déménagement, logistique ». → PROJECT_CONTEXT fait foi : le script **n'écrase pas** `secteur`. Même règle pour les 6 filiales.
7. **Textes marketing de la filiale**. `SUB_CONFIG` (`tagline`, `headlineLead`/`Accent`/`Tail`, `heroPitch`, `ctaLabel`, `contactIntro`, `contactHeadline`, `contactBaselinE`, `successMsg`, `fields[]`) n'a pas de modèle. → Garder ces textes dans une config typée versionnée `shared/config/filiales.ts`. Les `fields` sont liés au schéma zod serveur, ils doivent donc rester dans le code. Ne pas créer de modèle tant que le client ne demande pas à les modifier.
8. **`PageContenu`** (admin « Sections » : `id`, `filialeId` numérique, `section`, `titre`, `contenu`, `derniereModification`). Il n'a pas de modèle, et les pages publiques du prototype **ne le lisent jamais**. Pire, il contredit `SUB_CONFIG` : « …sans compromis. » d'un côté, « …sans y penser. » de l'autre. → À ouvrir comme décision dans PROJECT_STATE, à trancher avec `/admin/contenu` (holding). Ma recommandation : ne pas le porter, parce que dans le prototype cette fonction ne change rien au site public.
9. **Champs structurés des formulaires de contact**. Le prototype concatène `type`, `frequence` (entretien) et `type`, `date`, `origine`, `destination` (transport) dans `message` ; `MessageContact` n'a pas de colonnes pour ça, et `contact.post.ts` prévoit d'être « dupliqué par filiale ». → Ajouter `details Json?` sur `MessageContact`, alimenté par **un seul** endpoint dont le zod choisit les champs selon `companySlug` (une branche par filiale). Compromis : on garde des données filtrables et affichables dans l'admin (ou convertibles en fiche `Client`), au prix d'une colonne JSON dont la forme n'est garantie que par zod.
10. **Statut des messages**. Le prototype a `StatutMessage` = `nouveau` | `en_cours` | `traite` ; le schéma a `lu Boolean`. → Enum `StatutMessage { NOUVEAU EN_COURS TRAITE }` à la place de `lu`. À trancher lors de `/admin/messages` : ça concerne toutes les filiales.
11. **`POST /api/public/contact` existant**. Le client fournit `sujet`, `telephone` est optionnel, il n'y a pas de champs par filiale, et le commentaire parle de duplication. → Calculer `sujet` côté serveur à partir de la config de la filiale, rendre `telephone` obligatoire pour entretien et transport (dans le zod, pas dans le schéma), et ne rien dupliquer (voir écart 9).
12. **Dates des réalisations**. Le prototype a `date: "2022-06-01"` formatée avec `toLocaleDateString("fr-CA")` ; le schéma a `dateRealisation DateTime?`. Bug : un minuit UTC affiché à Montréal donne **« mai 2022 » au lieu de « juin 2022 »**, et le serveur (UTC) et le client ne rendent pas le même texte, ce qui casse l'hydratation. 5 des 6 dates d'entretien/transport sont concernées. → Passer en `@db.Date` et formater avec `timeZone: 'UTC'` dans un utilitaire partagé couvert par un test unitaire.
13. **Images externes**. Le prototype a `imagePlaceholder` (Unsplash), `photoPlaceholder` (pravatar) et `logoPlaceholder` (dicebear SVG) ; le schéma attend des clés `Fichier`. La CSP par défaut de `nuxt-security` (`img-src 'self' data:`) les bloquerait de toute façon. → Le script télécharge **uniquement les images Unsplash** dans le stockage et crée un `Fichier` `PUBLIC` rattaché à la filiale. **Ne pas migrer pravatar** (visages aléatoires de vraies personnes, présentés comme l'équipe : risque légal) **ni dicebear** (SVG) : `photoKey` et `logoKey` restent null, avec des initiales en repli dans le composant. Les vraies photos viennent du client.
14. **Visuel de la page Services**. Le prototype utilise un `linear-gradient` et affiche `String(s.id)`, qui montrerait « 25 » pour le service supermarchés ; le §6 interdit les dégradés et CLAUDE.md § Identifiants interdit d'exposer un id. → Utiliser `Service.imageKey` (déjà dans le schéma, jamais exploité par le prototype), avec en repli un aplat d'accent. Numérotation `String(i+1).padStart(2,'0')`, ce qui corrige aussi le « 010 » que produirait « 0{i+1} » à partir du 10e service.
15. **Monogramme de la page À propos**. Le prototype utilise un `radial-gradient`, contraire au §6. → Aplat d'accent à faible opacité avec une forme SVG (même langage que le « blob » du hero), ou `heroImageKey`.
16. **Retour client « Nettoyage et entretien des supermarchés »** (PROJECT_STATE). Le service existe (mockdata id 25, 5e position), donc la page `/entretien/services` le reflète. En revanche :
    - il est **absent de l'aperçu de l'accueil** (`slice(0,3)`) ;
    - il manque dans le `heroPitch` et dans les meta descriptions de `/entretien` et `/entretien/services` ;
    - le select « Type de propriété » du formulaire n'a pas d'option correspondante.

    → Seed avec `ordre` d'après l'ordre de mockdata, puis demander au client s'il veut le mettre en avant (par ex. `ordre` 0). Ajouter l'option « Supermarché / commerce alimentaire » au formulaire. Ajouter « supermarchés » aux meta descriptions. Pour transport : aucun retour client documenté, le prototype correspond à PROJECT_CONTEXT §2.
17. **Validation du formulaire**. Le prototype utilise `register(name, { required: true })` sans message : `handleSubmit` bloque l'envoi mais aucune erreur ne s'affiche, et la branche `toast.error` ne sert qu'aux valeurs faites d'espaces. → VeeValidate + zod avec erreurs sous chaque champ, et le même schéma zod importé par le serveur.
18. **Liens morts et Loi 25**. Le footer a des réseaux sociaux et des liens « Politique de confidentialité » / « Conditions » en `href="#"`, alors que le formulaire collecte nom, email et téléphone : une politique de confidentialité est obligatoire au Québec (Loi 25). → Ajouter une ligne à la checklist PROJECT_STATE : page `/confidentialite` commune au groupe, lien depuis chaque formulaire. Masquer les icônes sociales tant qu'il n'y a pas d'URL réelle (champ `reseaux Json?` sur `Company`, ou config).
19. **Coordonnées fictives**. Le prototype utilise des emails `@groupe-cd.ca` alors que les comptes utilisateurs sont en `@groupecd.ca`, et des téléphones `+1 (514) 000-100x`. → Ne pas les migrer comme vraies données : `null` dans le seed, et repli d'affichage masqué. Demander les vraies coordonnées au client (à ajouter aux décisions ouvertes, avec le nom officiel du groupe).
20. **Idempotence du script de migration**. `PROMPT_CONVERSION` demande des « upserts », mais `Service`, `Realisation`, `MembreEquipe` et `Partenaire` n'ont aucune clé unique naturelle, alors que Prisma `upsert` exige un `where` unique. → Dans le script : `findFirst({ companyId, titre|nom })` puis `create` ou `update`, sans contrainte de schéma. Autre option : `@@unique([companyId, titre])`, qui renforce la qualité des données mais impose de gérer un 409 au renommage dans le CMS.
21. **ISR sur la racine des filiales**. `nuxt.config.ts` déclare `'/entretien/**'` ; il faut vérifier sur le build de production que la règle couvre bien `/entretien` lui-même (sans sous-chemin). Sinon, ajouter `'/entretien'` explicitement pour les 6 filiales.

---

## Mockdata entretien + transport

Source : `prototype_react/cd-holding-nexus/src/data/mockdata.ts`, plus `components/subsidiary/subConfig.ts`. Dans `mockdata.ts`, le rattachement se fait par `filialeId` (le slug), sauf `companies` (id 1 = entretien, 2 = transport) et `pagesContenu` (`filialeId` **numérique** 1 ou 2).

| Collection | Entretien | Transport | Champs | Destination Prisma / remarque migration |
|---|---|---|---|---|
| `companies` | 1 (id 1) | 1 (id 2) | `id, slug, nom, secteur, description, couleurAccent, imagePlaceholder, employesCount, statutSite` | `Company` par `slug` : remplir `description` si null ; `imagePlaceholder` → `heroImageKey` (écart 4) ; **ne pas écraser `secteur`, `nom`, `couleurAccent`** (seed / PROJECT_CONTEXT). `employesCount` et `statutSite` ne sont pas utilisés par ces pages (inventaire holding). |
| `SUB_CONFIG` (subConfig.ts) | 1 objet, 6 `fields` | 1 objet, 8 `fields` | `shortName, tagline, headlineLead, headlineAccent, headlineTail, heroImage, heroPitch, email, phone, ctaLabel, contactIntro, contactHeadline, contactBaselinE, successMsg, fields[{name,label,type?,placeholder?,options?,required?,fullWidth?,rows?}]` | À recopier dans `shared/config/filiales.ts` (écart 7), **pas dans le seed**. `shortName` → `Company.nomCourt`. `email` et `phone` fictifs (écart 19). |
| `services` | 5 (ids 1, 2, 3, 4, 25) | 4 (ids 5–8) | `id, filialeId, titre, description` | `Service` : `ordre` = index dans le sous-tableau de la filiale ; id ignoré ; `imageKey` null. |
| `realisations` | 3 (ids 3, 4, 5) | 3 (ids 6, 7, 8) | `id, filialeId, titre, description, imagePlaceholder, date` | `Realisation` : `date` → `dateRealisation` (écart 12) ; image Unsplash téléchargée → `Fichier` `PUBLIC` → `imageKey` (écart 13) ; `ordre` = index. |
| `equipe` | 2 (ids 4, 5) | 2 (ids 6, 7) | `id, filialeId, nom, poste, photoPlaceholder, bio` | `MembreEquipe` : `bio` (écart 1) ; `photoPlaceholder` pravatar **non migré** → `photoKey` null. |
| `partenaires` | 2 (ids 4, 5) | 2 (ids 6, 7) | `id, filialeId, nom, logoPlaceholder, typeRelation` | `Partenaire` : `typeRelation` (écart 2) ; `logoPlaceholder` dicebear **non migré** ; `siteUrl` absent de mockdata → null. |
| `pagesContenu` | 2 (ids 4, 5 : hero, services) | 2 (ids 6, 7 : hero, services) | `id, filialeId(number), section, titre, contenu, derniereModification` | Aucun modèle ; décision ouverte (écart 8). Ne pas migrer. |
| `messagesContact` | 1 (id 2) | 1 (id 3) | `id, filialeId, nom, email, telephone?, sujet, message, statut, date` | Données de démonstration, **pas du contenu** : seed de dev seulement (le seed a déjà 1 message par filiale). `statut` → écart 10. |
| `employes` (hors périmètre, planning) | 3 | 2 | `id, filialeId, nom, poste, email, statut("actif"/"en_conge"/"inactif")` | `Employe` n'a que `actif Boolean`, sans « en congé » : à inventorier avec `/admin/<slug>/planning`. |
| `planningEntries` (hors périmètre) | 4 (employés 1, 1, 1, 2) | 2 (employés 4, 5) | `id, employeId, jour, debut("HH:mm"), fin, lieu, note?` | `PlanningEntry` a `titre, dateDebut, dateFin, notes`, **sans `lieu`**, et le prototype travaille sur une semaine type (`jour`) et non sur des dates : gros écart à trancher lors de la route planning. |
| `clients` (hors périmètre, CRM) | 1 | 1 | `id, nom, entreprise, email, telephone, filialeId, statut, notes, creeLe` | `Client` : correspondance directe (`creeLe` → `dateAjout`, `statut` → `StatutClient`). |
| `users` | 1 (Awa Diallo, employe) | 0 | `id, nom, email, motDePasse, role, filialeId` | **Ne jamais migrer** (mot de passe en clair) ; le seed gère ses comptes depuis `.env`. |

Totaux de contenu à migrer pour ces deux filiales :

| Filiale | Services | Réalisations | Membres d'équipe | Partenaires | Images Unsplash (réalisations + hero) |
|---|---|---|---|---|---|
| Entretien | 5 | 3 | 2 | 2 | 4 |
| Transport | 4 | 3 | 2 | 2 | 4 |

Fichiers de référence :
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/subConfig.ts`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/pages/SubServicesPage.tsx` (dégradé et id affiché)
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/pages/SubAboutPage.tsx` (dégradé radial)
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/GenericContactForm.tsx`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/data/mockdata.ts`
- `/home/cabrel/projects/cd-holding/server/api/public/contact.post.ts`
- `/home/cabrel/projects/cd-holding/prisma/schema.prisma`
- `/home/cabrel/projects/cd-holding/prisma/seed.ts`
- `/home/cabrel/projects/cd-holding/nuxt.config.ts`


---

<a id="partie-3"></a>

# Partie 3 — Inventaire phase 1 : filiales `comptable` et `placement`

## CHALLENGE

**Hypothèses retenues**
- Seules les routes publiques sont inventoriées. Les routes `/admin/comptable/**` et `/admin/placement/**` ne sont pas détaillées. Elles apparaissent quand même dans les écarts, parce qu'elles décident de la forme de `DossierComptable`, `Candidat`, `DemandeClient` et `Candidature`.
- Les endpoints publics partagés (services, réalisations, équipe, partenaires, company) sont définis par l'agent « subsidiary ». Je les cite sous la forme `GET /api/public/filiales/[slug]/…` sans les redéfinir.
- Je n'ai pas fait les captures Playwright (`conversion-captures/`). Mon mandat était en lecture seule, sans aucun fichier écrit. Elles restent à faire.

**Angles morts du brief**
- **Loi 25 (Québec).** Le site collecte publiquement des CV et des documents personnels (permis, diplômes, pièces d'immigration pour le PTET). Rien de prévu ni dans le prototype ni dans le schéma : pas de consentement, pas de durée de conservation, pas de politique de confidentialité, pas de purge.
- **Fuite du client confidentiel.** Dans le prototype, le bouton « Publier comme offre » recopie `lieu = d.entreprise`. Le nom de l'entreprise cliente devient donc public (`admin.placement.tsx:198`).
- **Formats de CV incompatibles avec le stockage.** Le prototype accepte `.pdf,.doc,.docx`. `server/utils/storage.ts` n'accepte que PDF, PNG, JPEG et WebP. Un CV Word recevrait un 415.
- **Taille totale de la requête.** `nuxt-security` plafonne une requête d'upload à 10 Mo + 64 Ko (`nuxt.config.ts:61`). Un CV plus plusieurs documents dans un seul multipart dépasse ce plafond.
- **Cache ISR.** La règle `/placement/**` a un ISR de 3600 s. Une offre retirée resterait visible, et ouverte aux candidatures, jusqu'à une heure.

**Meilleure approche (proposée, rien n'est appliqué)**
- Un seul composant `CandidatureForm` pour l'onglet « candidat » de `/contact` et pour la candidature à une offre.
- Des champs d'offre publics explicites sur `DemandeClient`, séparés des champs internes.
- Upload atomique : tous les fichiers sont validés avant d'en écrire un seul.
- Remplacer le modal par une page `/placement/offres/[uuid]`, à trancher (écart n°5).

**À retirer**
- La création automatique d'un `Candidat` à chaque candidature spontanée, comme le fait le prototype (`placement.contact.tsx:163`). Elle duplique des données personnelles et pollue le vivier. À remplacer par une action admin « Ajouter au vivier ».
- La double écriture `DemandeClient` + `MessageContact` pour le formulaire employeur.

**Changements par rapport au brief littéral**
- J'ai ajouté des points transversaux (Loi 25, SEO JobPosting, ISR, atomicité des uploads) et les incohérences des mocks qui feraient échouer le seed.

---

## /comptable  (`comptable.tsx` layout + `comptable.index.tsx`)
- **Composants clés** : `SubLayout slug="comptable"` (`SubHeader`, `Outlet`, `SubFooter`) et `SubHome` (`SubHero`, aperçu de 3 services, aperçu de 3 réalisations, bandeau CTA). Rien de propre à la filiale hors `SUB_CONFIG.comptable` : shortName « CD Tenue de Livre », tagline, headline « La rigueur / comptable, / au service de votre PME. », heroImage, heroPitch, email `comptable@groupe-cd.ca`, téléphone `+1 (514) 000-1003`, ctaLabel « Prendre rendez-vous ». Meta du layout : title, description, og:title, og:description.
- **Entités de données utilisées** :
  - `Company` : slug, nom, couleurAccent `#185FA5`, description, secteur.
  - `Service` : id, filialeId, titre, description. Les 3 premiers dans l'ordre du tableau : ids 9, 10, 11.
  - `Realisation` : id, filialeId, titre, description, imagePlaceholder, date. Ids 9 et 10.
- **Interactions** : aucun formulaire. Apparitions `motion` avec `whileInView` sur les aperçus. Nav : Accueil, Services, Réalisations, À propos, Contact.
- **Endpoints API nécessaires** : `GET /api/public/filiales/[slug]` plus services et réalisations (partagés, publics, sans rôle).
- **Écart avec prisma/schema.prisma** : aucun propre à la filiale. Écarts partagés : `Company.imagePlaceholder/employesCount/statutSite` n'existent pas au schéma, et `SUB_CONFIG` est du contenu statique hors base. Retour client partiellement absent : la meta description et `heroPitch` parlent encore de « paie, TPS/TVQ, impôt corporatif » (écart n°1).

## /comptable/services  (`comptable.services.tsx`)
- **Composants clés** : `SubServicesPage slug="comptable"`, avec liste éditoriale et `cfg.heroPitch`.
- **Entités de données utilisées** : `Service` (id, filialeId, titre, description), 5 éléments : 9 « Production des états financiers », 10 « Déclaration d'impôt des particuliers (T1) », 11 « … sociétés (T2) », 12 « Création d'entreprise », 26 « Régularisation d'entreprise et contrôle fiscal ».
- **Interactions** : apparitions `motion`/`whileInView` échelonnées. Aucun formulaire.
- **Endpoints API nécessaires** : `GET /api/public/filiales/[slug]/services` (partagé, public), trié par `ordre`.
- **Écart avec prisma/schema.prisma** : aucun. Le mock n'a pas d'image (`Service.imageKey` nullable, conforme). Le seed doit dériver `ordre` de la position dans le tableau, pas de l'id : l'id 26 est affiché en dernier. Le retour client est bien présent dans les services. La meta description (« paie, taxes, états financiers et impôt corporatif ») n'est pas alignée.

## /comptable/realisations  (`comptable.realisations.tsx`)
- **Composants clés** : `SubRealisationsPage slug="comptable"`.
- **Entités de données utilisées** : `Realisation` (id, filialeId, titre, description, imagePlaceholder = URL Unsplash, date ISO) : 9 « Mise à niveau d'un dossier de 3 ans » (2024-12-01) et 10 « Implantation d'une paie hebdomadaire » (2025-04-05).
- **Interactions** : `motion`/`whileInView`. Date formatée `fr-CA` (mois et année).
- **Endpoints API nécessaires** : `GET /api/public/filiales/[slug]/realisations` (partagé, public).
- **Écart avec prisma/schema.prisma** : `date` correspond à `dateRealisation`. `imagePlaceholder` est une URL externe alors que `imageKey` est une clé `Fichier` PUBLIC : le seed doit rapatrier l'image ou la laisser nulle (point partagé). La réalisation n°10 parle de paie, service absent de la liste mise à jour (écart n°1).

## /comptable/a-propos  (`comptable.a-propos.tsx`)
- **Composants clés** : `SubAboutPage slug="comptable"` : récit (`company.description`, `cfg.shortName`), grille équipe, liste partenaires.
- **Entités de données utilisées** :
  - `MembreEquipe` (id, filialeId, nom, poste, photoPlaceholder, bio) : 8 Marc Tremblay « Chef de pratique », 9 Isabelle Roy « Technicienne comptable senior ».
  - `Partenaire` (id, filialeId, nom, logoPlaceholder, typeRelation) : 8 « Ordre des CPA du Québec » / « Adhésion professionnelle », 9 « QuickBooks Canada » / « ProAdvisor certifié ».
- **Interactions** : `motion`/`whileInView`.
- **Endpoints API nécessaires** : `GET /api/public/filiales/[slug]/equipe` et `…/partenaires` (partagés, publics).
- **Écart avec prisma/schema.prisma** : `MembreEquipe.bio` et `Partenaire.typeRelation` n'existent pas au schéma (écart partagé, n°14). Point de vigilance : afficher « Ordre des CPA du Québec — Adhésion professionnelle » laisse entendre que le cabinet est membre de l'Ordre. Si ce n'est pas le cas, l'affichage est trompeur, voire illégal (titre réservé). À valider avec le client avant le seed.

## /comptable/contact  (`comptable.contact.tsx`)
- **Composants clés** : `SubContactPage slug="comptable"` : colonne texte (`contactIntro` « Consultation gratuite », `contactHeadline`, `contactBaselinE`, email, téléphone, « Montréal, Québec ») et `GenericContactForm`.
- **Entités de données utilisées** : `MessageContact`, écrit par le prototype avec filialeId, nom, email, telephone, sujet = `cfg.contactIntro`, message = concaténation `clé: valeur · …` des autres champs, statut `nouveau`, date.
- **Interactions** :
  - Champs, tous requis : `nom` (Nom complet), `entreprise` (Nom d'entreprise), `email` (type email), `telephone` (tel), `type` = « Structure », une liste : Travailleur autonome / Société incorporée / OBNL / Autre ; `besoin` = « Besoin principal », une liste : Tenue de livres régulière / Paie / TPS / TVQ / États financiers / impôt / Reprise de dossier en retard ; `message` = « Contexte », zone de texte de 4 lignes, pleine largeur.
  - Validation du prototype : seulement « non vide », vérifiée en JS à l'envoi avec un toast d'erreur. Pas de format email, pas de longueur.
  - Toast de succès « Demande reçue… nous vous confirmons un créneau par courriel ». Remise à zéro. Pas de modal.
- **Endpoints API nécessaires** : `POST /api/public/contact` (existant, public, rate-limité, honeypot), avec `companySlug: "comptable"`.
- **Écart avec prisma/schema.prisma** : `entreprise`, `type` et `besoin` n'ont pas de colonne. Il faut soit les concaténer côté serveur, soit ajouter `MessageContact.entreprise` (écart n°13). Les options de `besoin` ne reflètent pas les services mis à jour : il manque T1, T2, création et régularisation d'entreprise (écart n°1). Pour le port : ajouter un schéma zod par filiale dans `shared/validation/` (email, longueurs) à la place de la validation « non vide ».

---

## /placement  (`placement.tsx` layout + `placement.index.tsx`)
- **Composants clés** :
  - Layout : `SubLayout slug="placement"`. La nav insère **« Offres » entre Services et Réalisations** (`SubLayout.tsx:18`).
  - Page d'accueil **sur mesure** (pas de `SubHome` ni de `SubHero`) :
    - Hero : sur-titre « Placement de personnel · Recrutement international », H1 « Les bonnes personnes, au *bon moment*. », panneau d'accent à 8 % d'opacité sur la moitié droite.
    - Deux cartes audience : navy « Vous cherchez du personnel », qui mène à `/placement/contact?audience=employeur` ; corail « Vous cherchez un emploi », qui mène à `?audience=candidat`.
    - Aperçu de 3 services numérotés 01 à 03.
    - Section navy « Placements récents » avec 2 réalisations.
  - Icônes lucide : Briefcase, UserPlus, ArrowRight.
- **Entités de données utilisées** :
  - `Company` (slug, couleurAccent `#D4537E`).
  - `Service` (id, filialeId, titre, description) : ids 13, 14, 15.
  - `Realisation` (id, filialeId, titre, description, imagePlaceholder, date) : ids 11 et 12.
- **Interactions** : animations d'entrée `motion` (H1 en 0,7 s ; cartes en 0,6 s avec délais de 0,1 et 0,2 s). Flèche des cartes en translate-x au survol. Lien avec paramètre `audience`.
- **Endpoints API nécessaires** : `GET /api/public/filiales/[slug]` plus services et réalisations (partagés, publics).
- **Écart avec prisma/schema.prisma** : aucun. Le hero est codé en dur et non piloté par `SUB_CONFIG` : à garder comme page dédiée `pages/placement/index.vue`, pas comme variante de `SubHome`.

## /placement/services  (`placement.services.tsx`)
- **Composants clés** : `SubServicesPage slug="placement"`.
- **Entités de données utilisées** : `Service` (id, filialeId, titre, description) : 13 « Placement de manutentionnaires », 14 « Chauffeurs classe 1, 3 et 5 », 15 « Recrutement international (PTET) », 16 « Accompagnement candidats ».
- **Interactions** : `motion`/`whileInView`.
- **Endpoints API nécessaires** : `GET /api/public/filiales/[slug]/services` (partagé).
- **Écart avec prisma/schema.prisma** : aucun.

## /placement/realisations  (`placement.realisations.tsx`)
- **Composants clés** : `SubRealisationsPage slug="placement"`.
- **Entités de données utilisées** : `Realisation` : 11 « Recrutement PTET, secteur agroalimentaire » (2024-09-20) et 12 « Placement en manutention express » (2025-03-01). Champs id, filialeId, titre, description, imagePlaceholder, date.
- **Interactions** : `motion`/`whileInView`.
- **Endpoints API nécessaires** : `GET /api/public/filiales/[slug]/realisations` (partagé).
- **Écart avec prisma/schema.prisma** : même point partagé `imagePlaceholder` vers `imageKey`.

## /placement/a-propos  (`placement.a-propos.tsx`)
- **Composants clés** : `SubAboutPage slug="placement"`.
- **Entités de données utilisées** :
  - `MembreEquipe` : 10 Fatoumata Keita « Directrice recrutement », 11 Luc Gagnon « Chargé de comptes employeurs ». Champs nom, poste, photoPlaceholder, bio.
  - `Partenaire` : 10 « Service Canada · EIMT » / « Partenaire institutionnel », 11 « Cabinet d'immigration Latour » / « Partenaire immigration ». Champs nom, logoPlaceholder, typeRelation.
- **Interactions** : `motion`/`whileInView`.
- **Endpoints API nécessaires** : `GET /api/public/filiales/[slug]/equipe` et `…/partenaires` (partagés).
- **Écart avec prisma/schema.prisma** : `bio` et `typeRelation` manquent (écart n°14). Point de vigilance : présenter Service Canada comme « Partenaire institutionnel » peut être contesté, car une EIMT est une procédure et non un partenariat. À valider avec le client.

## /placement/contact  (`placement.contact.tsx`)
- **Composants clés** :
  - Page sur mesure, sans `SubContactPage` (`SUB_CONFIG.placement.fields = []`).
  - En-tête centré « Un formulaire par audience. ».
  - Sélecteur à deux boutons : « Je suis employeur » (fond navy quand actif) et « Je suis candidat » (fond accent quand actif). Onglet initial tiré du paramètre de requête `audience` (`employeur` ou `candidat`, validé par zod ; par défaut `emp`).
  - `EmployerForm` et `CandidateForm`. Styles `inputBase`, `labelBase` et `errorText` tirés de `formStyles.ts`.
- **Entités de données utilisées** (écritures du prototype) :
  - Employeur : `DemandeClient` { entreprise, contact, email, poste, categorie (dérivée du libellé du poste), quantite (chiffres extraits de `nombre`, sinon 1), debut = aujourd'hui, statut `ouverte` } **et** `MessageContact` { filialeId, nom, email, telephone, sujet « Besoin de personnel — {poste} », message « {entreprise} · {nombre} poste(s) · {message} », statut, date }.
  - Candidat : `Candidature` { offreId: null, nom, email, telephone, posteVise, experience = « {experience} — {message} », cvNom (nom de fichier seulement), documents (noms séparés par des virgules), statut `recue`, date } **et** `Candidat` { nom, email, telephone, poste, categorie (dérivée ; par défaut « Entretien »), disponibilite = experience, statut `disponible`, origine = `local` si le pays contient « canada », sinon `international` }.
- **Interactions** :
  - **Formulaire employeur** (zod) :
    - `nom` min 2 ; `entreprise` min 2 ; `email` au format email ; `telephone` min 7.
    - `poste`, une liste obligatoire : Manutention / Chauffeur classe 1 / Chauffeur classe 3 / 5 / Recrutement international (PTET) / Autre.
    - `nombre` : texte min 1, exemple « Ex. 5 ».
    - `message` = « Contexte », min 5, exemple « Lieu, horaires, urgence… ».
    - Envoi : bouton navy, texte « Envoi… » pendant l'envoi, puis toast « Demande reçue » et remise à zéro.
  - **Formulaire candidat** (zod) :
    - `nom` min 2 ; `pays` = « Pays de résidence », min 2 ; `email` ; `telephone` (« Téléphone / WhatsApp ») min 7.
    - `poste`, une liste obligatoire : Manutention / entrepôt, Chauffeur classe 1, Chauffeur classe 3 / 5, Autre.
    - `experience`, une liste obligatoire : Moins de 1 an / 1 à 3 ans / 3 à 5 ans / Plus de 5 ans.
    - `cvNom` : fichier `.pdf,.doc,.docx`, **requis** (seul le nom est vérifié).
    - `documents` : fichiers multiples, **optionnels**, sans filtre `accept`.
    - `message` = « À propos de vous », min 5.
    - Envoi : bouton accent, toast « Candidature reçue », remise à zéro.
  - Pas de modal. Chorégraphie : transition de couleur du sélecteur d'onglets.
- **Endpoints API nécessaires** :
  - `POST /api/public/placement/demandes` : JSON, public, rate-limité, honeypot. Crée une `DemandeClient` non publiée. Proposition : **ne pas** créer en plus un `MessageContact` (doublon, voir écart n°4).
  - `POST /api/public/placement/candidatures` : multipart, public, rate-limité strictement, honeypot, sans `demandeUuid`, donc candidature spontanée. Le même endpoint sert à `/placement/offres`. Contrat détaillé plus bas.
- **Écart avec prisma/schema.prisma** : important, voir les écarts n°2 à 4 et 6 à 11.
  - Retours client **non reflétés** : pas d'`adresseComplete` ; « Autre » sans mini-champ `posteAutrePrecision` ; `.doc`/`.docx` refusés par le stockage.
  - `pays`, `experience` et `message` n'ont pas de colonne.
  - Le formulaire employeur n'a pas de champs contact, nombre ou statut côté `DemandeClient`.
  - Point à vérifier au port : l'onglet initial dépend du paramètre de requête alors que la page est en ISR. Si le cache ignore la requête, l'onglet SSR peut être faux. Lire `audience` côté client ou exclure la route de l'ISR.

## /placement/offres  (`placement.offres.tsx`, avec modal de candidature)
- **Composants clés** :
  - Liste éditoriale séparée par des traits (`divide-y`), pas une grille de cartes.
  - H1 dynamique « {n} mandats à pourvoir en ce moment. ». État vide : « Aucune offre publiée… candidature spontanée ».
  - Chaque `article` affiche titre, description, puis lieu (icône MapPin), typeContrat (icône Clock) et salaire (icône Banknote), avec un bouton « Postuler ».
  - Lien final vers `/placement/contact?audience=candidat`.
  - `Dialog` shadcn (`max-h-[85vh] overflow-y-auto sm:max-w-lg`) : titre « Postuler — {titre} », description « {lieu} · {typeContrat} · {salaire} », contenu `PostulerForm`.
- **Entités de données utilisées** :
  - `OffreEmploi` (id, titre, categorie, lieu, typeContrat, salaire, description, publiee, date), filtrée sur `publiee`.
  - Écriture `Candidature` { offreId, nom, email, telephone, posteVise = titre de l'offre, experience, cvNom, documents[], statut `recue`, date }.
- **Interactions** :
  - Apparition au défilement de chaque offre (`whileInView`, 0,35 s, délai i × 0,05, une seule fois).
  - Le modal s'ouvre et se ferme via un état local ; il se ferme après envoi.
  - **Formulaire du modal** (zod) : `nom` min 2 ; `email` ; `telephone` min 7 ; `experience` = zone de texte « Expérience pertinente », min 5 ; `cvNom` requis (`.pdf,.doc,.docx`) ; `documents` optionnels, multiples (« Autres documents (permis, diplômes) »).
  - Toast « Candidature envoyée ».
  - **Retours client non reflétés** : ni adresse, ni sélection de poste avec « Autre », ni pays.
- **Endpoints API nécessaires** :
  - `GET /api/public/placement/offres` : public, sans rôle.
    - Condition : `DemandeClient.publiee = true` (et `statut = OUVERTE` si l'écart n°3 est accepté), filiale `placement` résolue côté serveur.
    - Réponse : `[{ uuid, titre, lieu, typeContrat, salaire, description, publieeLe }]` avec un `select` explicite. **Jamais** `entrepriseCliente`, contact ou id.
    - Tri : `publieeLe desc`.
  - `POST /api/public/placement/candidatures` : multipart, public.
    - Champs texte :
      - `demandeUuid?` (uuid, doit désigner une demande publiée et ouverte de la filiale, sinon 404) ;
      - `nomComplet`, `email`, `telephone` (7 à 30 caractères, format international libre), `adresseComplete`, `pays` ;
      - `posteRecherche` : une liste fermée partagée, **ignorée si `demandeUuid` est fourni** (dérivée de la demande côté serveur) ;
      - `posteAutrePrecision` : requis si et seulement si le poste vaut « Autre » ;
      - `experience`, `message?` ;
      - `consentement` = `true` ;
      - `website` : honeypot, vide.
    - Fichiers : `cv` (1, requis) et `documents` (0 à 5).
    - Réponse 201 `{ ok: true }`, sans aucune clé ni uuid.
    - Erreurs : 400 (validation, CV manquant), 404 (offre introuvable ou retirée), 413 (taille), 415 (type), 429 (limite de débit).
  - Admin induits (hors de ce périmètre) :
    - `GET /api/admin/placement/candidatures` ;
    - `PATCH /api/admin/placement/candidatures/[uuid]` (statut) ;
    - `PATCH /api/admin/placement/demandes/[uuid]` (publiee et champs d'offre) ;
    - fichiers via `GET /api/files/[key]`.
    - Rôles : SUPER_ADMIN, ou ADMIN_FILIALE de `placement` seulement.
- **Écart avec prisma/schema.prisma** : important. `OffreEmploi` n'a pas de modèle, et `DemandeClient` n'a ni titre, ni lieu, ni typeContrat, ni salaire, ni date de publication (écart n°2). Statuts de candidature divergents (n°7). Cache ISR (n°12). Choix entre modal et page (n°5).

---

## Écarts détectés (comptable + placement)

1. **Services comptables : retour client appliqué seulement en partie.** `services` est à jour (états financiers, T1, T2, création, régularisation). Restent en ancienne version : `SUB_CONFIG.comptable.heroPitch` (« paie, TPS/TVQ… impôts corporatifs »), les options `besoin` du contact (Paie, TPS / TVQ, sans T1, T2 ni création d'entreprise), la meta du layout et de `/services`, `companies[comptable].secteur/description`, `pagesContenu` n°9 et la réalisation n°10 (paie). Or `PROJECT_CONTEXT` §2 cite encore « paie ». **Proposition** : demander au client si la paie et la TPS/TVQ restent offertes. En attendant, aligner les options `besoin` sur les 5 services plus « Tenue de livres régulière » et « Autre », et réécrire les meta et le pitch à partir de §2.
2. **`OffreEmploi` (prototype) contre `DemandeClient.publiee` (schéma, qui fait foi).**
   - Prototype : une collection séparée { titre, categorie, lieu, typeContrat, salaire, description, publiee, date }, reliée à la demande **par égalité de chaîne sur le titre**.
   - Schéma : `DemandeClient` { entrepriseCliente, posteRecherche, description, publiee } seulement.
   - **Proposition** : ajouter à `DemandeClient` les champs d'offre publique `titreOffre String?`, `lieu String?`, `typeContrat TypeContrat?` (enum TEMPS_PLEIN, TEMPS_PARTIEL, TEMPORAIRE), `salaire String?`, `descriptionPublique String? @db.Text` (distincte de `description`, qui est interne) et `publieeLe DateTime?`.
   - Contrôle zod admin : publication refusée tant que titre, lieu, typeContrat et descriptionPublique sont vides.
   - Ces champs structurés alimentent aussi le JSON-LD `JobPosting` (SEO Google for Jobs).
3. **`DemandeClient` : champs internes absents.**
   - Le prototype a contact, email, quantite, debut, categorie et statut (`ouverte`, `pourvue`, `annulee`). Le schéma n'en a aucun.
   - **Proposition** : ajouter `contactNom`, `contactEmail`, `contactTelephone String?`, `nombrePostes Int @default(1)`, `dateDebut DateTime?` et `statut StatutDemande @default(OUVERTE)` (OUVERTE, POURVUE, ANNULEE).
   - Règle publique : `publiee && statut = OUVERTE`.
   - `categorie` n'est pas retenue : elle se dérive du poste.
4. **Formulaire employeur : double écriture `DemandeClient` + `MessageContact`**, avec « Autre » sans précision et `nombre` en texte libre. **Proposition** : écrire seulement la `DemandeClient` (pour qu'elle apparaisse dans les compteurs du tableau de bord), faire de `nombrePostes` un entier de 1 à 999, et ajouter un mini-champ `posteAutrePrecision` si le poste vaut « Autre ». Il faut alors un `DemandeClient.posteAutrePrecision String?`, ou bien écrire directement le texte libre dans `posteRecherche`.
5. **Candidature à une offre : modal (prototype) ou page (`PROJECT_STATE` laisse le choix).** Avec le formulaire complet (adresse, pays, poste, expérience, 2 champs fichier, consentement), le modal dépasse largement 85vh à 375 px. **Proposition** : une page `/placement/offres/[uuid]` (détail, formulaire, JSON-LD, lien partageable), où le bouton « Postuler » de la liste mène. C'est un écart au prototype validé : à faire trancher par l'utilisateur, puis à documenter dans `PROJECT_STATE`. À défaut, garder le modal et ajouter un lien profond `?postuler=<uuid>`.
6. **`Candidature` : champs du prototype absents du schéma.** `experience` (liste dans `/contact`, zone de texte dans le modal), `message` (« À propos de vous ») et `pays`. **Proposition** : ajouter `experience NiveauExperience?` (MOINS_1_AN, UN_A_TROIS_ANS, TROIS_A_CINQ_ANS, PLUS_5_ANS), `message String? @db.Text` et `pays String`. Unifier les deux formulaires sur un seul composant `CandidatureForm` avec une prop `demande?`.
7. **Statuts de `Candidature` divergents.** Le prototype en a 5 (`recue`, `en_revue`, `entrevue`, `refusee`, `embauchee`), le schéma et `PROJECT_STATE` en ont 4 (NOUVELLE, EN_REVISION, RETENUE, REJETEE). **Proposition** : garder le schéma. Correspondance pour le seed : recue → NOUVELLE, en_revue → EN_REVISION, entrevue → EN_REVISION, embauchee → RETENUE, refusee → REJETEE. Signaler au client que l'étape « entrevue » disparaît.
8. **Retours client non reflétés dans le prototype (le schéma les couvre déjà).** `adresseComplete` est absente des deux formulaires. Le « poste + Autre avec mini-champ » manque : « Autre » existe dans `/contact` sans le mini-champ, et le modal n'a pas de sélection de poste. **Proposition** : les ajouter au `CandidatureForm`. Liste fermée de postes partagée dans `shared/` : Manutention / entrepôt, Chauffeur classe 1, Chauffeur classe 3 / 5, **Entretien** (absent de la liste candidat alors que l'offre n°3 et le candidat n°3 sont en entretien), Recrutement international (PTET) ?, Autre. `posteAutrePrecision` est requis côté zod client **et** serveur (`superRefine`).
9. **Formats de CV : prototype contre stockage.** Le prototype accepte `.pdf,.doc,.docx` pour le CV et n'a aucun filtre pour les documents. `storage.ts` n'accepte que PDF, PNG, JPEG et WebP. **Proposition** : CV en PDF seulement ; documents en PDF, JPEG ou PNG ; `accept` aligné côté UI, avec un message explicite. Si le client exige le Word, n'ajouter que DOCX, avec un contrôle du zip (`PK\x03\x04` plus présence de `[Content_Types].xml` et `word/`), jamais `.doc` (format OLE historique à macros). C'est une décision client.
10. **Taille totale et atomicité de l'upload public.** `requestSizeLimiter` et `MAX_UPLOAD_BYTES` valent 10 Mo **par requête**. Or CV plus N documents passent dans un seul multipart, lu en mémoire par `readMultipartFormData`, et sans authentification. `saveUploadedFile` ne nettoie que son propre fichier. **Proposition** :
    - plafond **total** de 10 Mo par candidature et 5 documents au maximum, pour que la limite existante reste valable sans surcharge par route ;
    - rejet 413 sur `Content-Length` avant lecture ;
    - validation de **tous** les fichiers (taille, détection du type réel) avant toute écriture, puis écriture, puis `Candidature` en transaction. En cas d'échec : suppression de toutes les clés écrites et de leurs `Fichier` ;
    - un helper `saveUploadedFiles` (lot avec retour arrière) dans `server/utils/storage.ts`.
11. **`Fichier` pour les uploads publics, cohérence et conservation.**
    - Règles : `visibilite = PRIVE` forcée ; `companyId` = id de la filiale `placement` résolu côté serveur par slug constant, jamais fourni par le client, jamais null.
    - `cvKey` et `autresDocumentsKeys` sont des chaînes sans clé étrangère. Supprimer une `Candidature` laisse donc des fichiers personnels orphelins, alors que la Loi 25 impose un droit à l'effacement et une durée de conservation.
    - **Proposition** : suppression des `Fichier` et des objets stockés dans le même handler que la `Candidature`, plus un balayage périodique des `Fichier` PRIVE non référencés. Même règle pour `Candidat.cvKey` et `DossierComptable.documentsKeys`.
    - Pour les PRIVE, servir en `Content-Disposition: attachment` plutôt qu'`inline`.
    - Ajouter à `Candidature` `consentementLe DateTime` (case obligatoire avec lien vers une politique de confidentialité, route à créer, absente du prototype). Durée de conservation à fixer avec le client.
12. **Cache ISR sur `/placement/**` (3600 s).** Une offre dépubliée reste affichée jusqu'à une heure. **Proposition** : `routeRules['/placement/offres'] = { isr: 60 }` ou un rendu SSR sans cache, **et** une vérification serveur de l'état « publiée et ouverte » à chaque `POST` de candidature. C'est cette vérification qui fait foi, pas la page.
13. **`MessageContact` : champs structurés perdus.** Le contact comptable envoie `entreprise`, `type` et `besoin`, que le prototype concatène dans `message`. Le mock a en outre `statut` (nouveau, en_cours, traite) alors que le schéma a `lu Boolean`. **Proposition** : ajouter `MessageContact.entreprise String?`, utile aussi pour CCDPAA, Boissons et l'employeur. Le serveur compose `sujet` (« Consultation — {besoin} ») et `message` à partir des champs restants. Le statut est un point partagé, tranché par l'agent chargé des messages.
14. **Contenu CMS (partagé, mais bloque le seed de ces filiales).** `MembreEquipe.bio` et `Partenaire.typeRelation` manquent au schéma. `photoPlaceholder`, `logoPlaceholder` et `imagePlaceholder` sont des URL externes (pravatar, dicebear, unsplash) alors que le schéma attend des clés `Fichier`. **Proposition** : ajouter `bio String? @db.Text` et `typeRelation String?`. Le seed rapatrie les images en `Fichier` PUBLIC, ou laisse la clé nulle avec une image de repli côté composant.
15. **`DossierComptable` / `Client` contre `clientsComptables` (admin, décision ouverte n°2).**
    - Prototype : { entreprise, contact, email, forfait (Mensuel, Trimestriel, Annuel), prochaineEcheance, statut (a_jour, en_retard, en_traitement), notes? }.
    - Schéma : `Client` { nom, entreprise, email, telephone, statut StatutClient, notes } plus `DossierComptable` { typeDeclaration, echeance, documentsKeys, notes }.
    - Manquent `forfait` et le statut du dossier. `typeDeclaration` n'existe pas dans le prototype. Le champ `notes` existe en double (Client et Dossier).
    - **Proposition** : ajouter `forfait FrequenceForfait` (MENSUEL, TRIMESTRIEL, ANNUEL) et `statut StatutDossier @default(A_JOUR)` (A_JOUR, EN_RETARD, EN_TRAITEMENT) à `DossierComptable` ; garder `typeDeclaration` en nullable ; réserver `notes` au dossier pour le suivi comptable.
    - Correspondance pour le seed : contact → `Client.nom`, entreprise → `Client.entreprise`, email → `Client.email`, prochaineEcheance → `echeance`, `Client.statut = CLIENT_ACTIF`.
    - Dédoublonnage par email : `clients` n°3 et `clientsComptables` n°1 (Étienne Gagnon, Atelier EG) sont la même personne.
16. **`Candidat` (vivier) : champs et alimentation.**
    - Le prototype a categorie, disponibilite, statut (disponible, en_process, place) et origine (local, international). Le schéma n'en a aucun. `telephone` est obligatoire dans le mock, facultatif au schéma.
    - Le prototype crée un `Candidat` à chaque candidature spontanée.
    - **Proposition** : ajouter `disponibilite String?`, `statut StatutCandidat @default(DISPONIBLE)` et `origine OrigineCandidat` (LOCAL, INTERNATIONAL). Ne **pas** créer de `Candidat` automatiquement : prévoir une action admin « Ajouter au vivier » à partir d'une `Candidature` (qui copie la référence au CV) et un lien `Candidature.candidatId Int?` pour la traçabilité. Dédoublonnage par email et par filiale (`@@unique([companyId, email])` à envisager).
17. **Données du mock incompatibles avec le schéma (le seed échouerait).** `candidatures` n°3 n'a pas de `cvNom`, alors que `cvKey` n'est pas nullable. Aucune candidature du mock n'a d'`adresseComplete` (non nullable). `cvNom` et `documents` sont des noms de fichiers sans contenu. **Proposition** : le seed génère des PDF factices enregistrés comme `Fichier` PRIVE de placement et une adresse fictive explicite. Sinon, exclure la candidature n°3 du seed.
18. **Publication d'une offre qui expose le client (prototype `admin.placement.tsx:195-203`).** `lieu = d.entreprise`, `salaire = "À discuter"` et `typeContrat = "Temps plein"` y sont codés en dur. **Proposition** : ne jamais dériver un champ public de `entrepriseCliente` ; les champs d'offre sont saisis explicitement au moment de publier (voir n°2).
19. **Rate-limit public pour les candidatures et les demandes.** Seul le contact est limité (5 requêtes par 10 min). **Proposition** : une portée `candidature` plus stricte (3 par heure et par IP) à cause du coût des uploads, et une portée `demande` alignée sur le contact.
20. **Notifications : exclues.** Le toast promet qu'« un conseiller vous rappelle sous 48 heures » et « nous vous confirmons un créneau par courriel », mais il n'y a pas de service d'email dans la stack. **Exclu de cette conversion** : les compteurs du tableau de bord suffisent pour le moment. Revoir le texte des toasts pour ne pas promettre un accusé de réception par courriel.

## Mockdata comptable + placement

| Collection (`mockdata.ts`) | Éléments pour ces filiales | Champs réels | Cible Prisma et notes de seed |
|---|---|---|---|
| `companies` | 2 (id 3 `comptable`, id 4 `placement`) | id, slug, nom, secteur, description, couleurAccent, imagePlaceholder, employesCount, statutSite | `Company` (type FILIALE). imagePlaceholder, employesCount et statutSite n'ont pas de colonne. |
| `users` | 1 (id 2 Marc Tremblay, admin_filiale, filialeId 3) | id, nom, email, motDePasse, role, filialeId | `User`. **Mot de passe en clair dans le mock : ne jamais le seeder**, le lire depuis `.env`. |
| `pagesContenu` | 4 (ids 8 et 9 comptable ; 10 et 11 placement ; `filialeId` numérique 3 et 4) | id, filialeId, section, titre, contenu, derniereModification | Aucun modèle. Utilisé seulement par le CMS admin. |
| `services` | 5 comptable (9, 10, 11, 12, 26) et 4 placement (13 à 16) | id, filialeId (slug), titre, description | `Service`. `ordre` = position dans le tableau. |
| `equipe` | 2 comptable (8, 9) et 2 placement (10, 11) | id, filialeId, nom, poste, photoPlaceholder, bio | `MembreEquipe`. `bio` manquant ; photo en URL externe. |
| `realisations` | 2 comptable (9, 10) et 2 placement (11, 12) | id, filialeId, titre, description, imagePlaceholder, date | `Realisation` (date → dateRealisation). |
| `partenaires` | 2 comptable (8, 9) et 2 placement (10, 11) | id, filialeId, nom, logoPlaceholder, typeRelation | `Partenaire`. `typeRelation` manquant. |
| `messagesContact` | 1 comptable (id 4) et 1 placement (id 5) | id, filialeId, nom, email, telephone?, sujet, message, statut, date | `MessageContact`. statut → lu (traite = true). date → createdAt. |
| `employes` | 1 comptable (id 6 Marc Tremblay) ; 0 placement | id, filialeId, nom, poste, email, statut | `Employe` (statut → actif). Aucune `planningEntries` pour ces filiales. |
| `clientsComptables` | 4 | id, entreprise, contact, email, forfait, prochaineEcheance, statut, notes? | `Client` + `DossierComptable` (écart n°15). |
| `clients` (CRM) | 1 comptable (id 3) | id, nom, entreprise, email, telephone, filialeId, statut, creeLe | `Client` (creeLe → dateAjout). Doublon de `clientsComptables` n°1 à fusionner. |
| `candidats` | 4 (tous placement ; aucun filialeId dans le mock) | id, nom, email, telephone, poste, categorie, disponibilite, statut, origine | `Candidat` (nom → nomComplet, poste → posteRecherche). categorie, disponibilite, statut et origine manquants. |
| `demandesClients` | 3 (placement, sans filialeId) | id, entreprise, contact, email, poste, categorie, quantite, debut, statut | `DemandeClient` (entreprise → entrepriseCliente, poste → posteRecherche). Le schéma exige `description`, absente du mock : à générer. |
| `offresEmploi` | 4 (3 publiées) | id, titre, categorie, lieu, typeContrat, salaire, description, publiee, date | Pas de modèle. Sera fusionné dans `DemandeClient` (écart n°2). **Aucune offre ne correspond à une demande du mock** (l'offre 1 Lachine ne recoupe pas la demande 1 Beauce) : le seed devra créer 4 `DemandeClient` supplémentaires, avec une `entrepriseCliente` fictive interne. |
| `candidatures` | 3 | id, offreId (1, 2, null), nom, email, telephone, posteVise, experience, cvNom?, documents?, statut, date | `Candidature` (offreId → demandeId via l'offre fusionnée, posteVise → posteRecherche, date → dateEnvoi). Statuts à convertir (écart n°7) ; n°3 sans CV et adresse absente partout (écart n°17). |
| `SUB_CONFIG` (`subConfig.ts`, hors `mockdata.ts`) | 2 (`comptable`, `placement`) | shortName, tagline, headlineLead, headlineAccent, headlineTail, heroImage, heroPitch, email, phone, ctaLabel, contactIntro, contactHeadline, contactBaselinE, successMsg, fields[] (name, label, type, placeholder, options, required, fullWidth, rows) | Config statique à porter dans `app/` ou `shared/`, pas en base. Emails en `@groupe-cd.ca` alors que les users sont en `@groupecd.ca` : incohérence de domaine à faire trancher. |

## Fichiers consultés
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/routes/placement.contact.tsx`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/routes/placement.offres.tsx`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/routes/placement.index.tsx`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/routes/admin.placement.tsx` (lignes 180-210, publication d'une offre)
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/subConfig.ts`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/SubLayout.tsx`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/GenericContactForm.tsx`
- `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/data/mockdata.ts`
- `/home/cabrel/projects/cd-holding/prisma/schema.prisma`
- `/home/cabrel/projects/cd-holding/server/utils/storage.ts`
- `/home/cabrel/projects/cd-holding/server/api/files/[key].get.ts`
- `/home/cabrel/projects/cd-holding/server/api/public/contact.post.ts`
- `/home/cabrel/projects/cd-holding/nuxt.config.ts` (ISR 3600 s, `requestSizeLimiter`)
- `/home/cabrel/projects/cd-holding/shared/config/upload.ts`

**Règle d'arrêt (`PROMPT_CONVERSION.md`)** : la liste des écarts n'est pas vide. Il faut la confirmation de l'utilisateur avant la phase 2, en priorité sur les écarts 1, 2, 5, 9 et 11 (consentement Loi 25).


---

<a id="partie-4"></a>

# Partie 4 — Inventaire de conversion : filiales `ccdpaa` et `boissons` (Phase 1, aucun fichier écrit)

## CHALLENGE (avant l'inventaire)

- **Hypothèses implicites du brief**
  - Le brief parle de « widget Assistant Import-Export » et de « Q&A pré-écrites ». Dans le prototype, ce n'est ni un widget flottant ni une FAQ. C'est une **section intégrée à `/ccdpaa/services` uniquement** : un questionnaire guidé en 5 étapes, puis une recommandation calculée par une règle fixe (seule la réponse « volume » compte), puis l'envoi d'un lead.
  - `PROJECT_STATE.md` renvoie à `PROJECT_CONTEXT.md` pour le retour client « pas une vraie IA ». **`PROJECT_CONTEXT.md` n'en dit rien.** Ce retour client n'est donc pas dans la source de vérité.
- **Angles morts**
  - Aucun e-mail ne peut partir dans le projet. Pourtant la réservation promet « Réservation confirmée par courriel dans l'heure qui suit ».
  - L'assistant enregistre un message avec `email: ""`. Le schéma et le zod serveur le refusent.
  - Le prototype ne montre les suggestions de produit dans aucun écran admin : elles sont écrites puis jamais relues.
  - Aucune validation métier sur la réservation : date passée, lundi (fermé) ou heure hors ouverture sont acceptés, et le nombre de personnes est un texte libre.
  - La CSP `nuxt-security`, déjà active, va bloquer les images Unsplash/pravatar/dicebear si elles restent en liens externes.
  - Loi 25 (Québec) : 4 formulaires publics collectent des données personnelles, sans aucune mention de confidentialité.
- **Meilleure approche proposée**
  - Q&A de l'assistant : **données statiques versionnées** dans un fichier partagé client/serveur, avec des clés d'option stables. Pas de base de données (justification plus bas).
  - Réservation : liste de créneaux générée depuis une config d'horaires, plutôt qu'un `input type=time` libre.
  - Tous les formulaires publics passent par `MessageContact`, avec un champ `details Json` validé par zod selon la filiale et le type. Sinon il faudrait une colonne par filiale.
- **À retirer / simplifier**
  - Le filtre `s.id !== 20` (id numérique en dur) sur l'accueil CCDPAA.
  - La promesse de confirmation par courriel tant qu'aucun envoi de mail n'existe.
- **Périmètre réel plus large que demandé**
  - Il faut aussi l'admin des réservations (dans le prototype c'est un onglet de `/admin/messages`, pas `/admin/ccdpaa/reservations`).
  - Il faut afficher les suggestions dans `/admin/messages`.
  - L'endpoint existant `server/api/public/contact.post.ts` est à corriger.
  - Le planning du restaurant a des écarts de schéma, notés en annexe des mockdata.

---

## /ccdpaa (layout)  (`src/routes/ccdpaa.tsx` → `SubLayout slug="ccdpaa"`)
- **Composants clés** : `SubLayout` (partagé). Spécificité CCDPAA : un lien de nav « Restaurant » `/ccdpaa/restaurant` ajouté entre Services et Réalisations (`slug === "ccdpaa"` en dur dans `SubLayout`). `SubHeader` reçoit `SUB_CONFIG.ccdpaa.shortName` = "CCDPAA" et l'accent `#BA7517`. `SubFooter` reçoit `email: ccdpaa@groupe-cd.ca`, `phone: +1 (514) 000-1005`.
- **Entités de données utilisées** : `companies[slug=ccdpaa]` → `couleurAccent`, plus les champs passés au footer (`nom`, `description`…). `SUB_CONFIG.ccdpaa` (statique, hors mockdata).
- **Interactions** : aucune en propre. Meta SEO : title « CCDPAA — Import de produits d'Afrique et restaurant Les Ambassades d'Afrique », description + og:title / og:description.
- **Endpoints API nécessaires** : `GET /api/public/companies/ccdpaa` (public) → `nom, secteur, description, couleurAccent, logoKey` (endpoint partagé, à aligner sur l'inventaire commun).
- **Écart avec prisma/schema.prisma** : pas de colonnes `email` ni `telephone` de contact sur `Company` (aujourd'hui dans `SUB_CONFIG`) ; voir écart 13. Nav par filiale conditionnée en dur : à passer par config (6ᵉ page CCDPAA, Offres Placement).

## /ccdpaa  (`src/routes/ccdpaa.index.tsx`, page **propre**, pas `SubHome`)
- **Composants clés** :
  - Hero éditorial : eyebrow « Deux métiers, un même continent », H1 « De la *terre africaine* à la table québécoise. ».
  - 2 cartes-image : Import-export (col-7, lien `/ccdpaa/services`) et Les Ambassades d'Afrique (col-5, lien `/ccdpaa/restaurant` « Réserver une table »). Légende en bandeau navy rgba 0.85 (pas de dégradé).
  - Aperçu « Notre catalogue import-export » : 3 cartes service.
  - Section navy « Réalisations récentes » : 3 articles, celui du milieu décalé `md:mt-16`, sans date (contrairement à `SubHome`).
  - Pas de section CTA finale (contrairement à `SubHome`).
- **Entités de données utilisées** :
  - `companies` : `couleurAccent`.
  - `services` : `id, filialeId, titre, description`, filtré sur `filialeId==="ccdpaa" && id !== 20`, puis `slice(0,3)`.
  - `realisations` : `id, filialeId, titre, imagePlaceholder`, `slice(0,3)`.
  - Images hero : Unsplash en dur (`photo-1488459716781…`, `photo-1555939594…`).
- **Interactions** : aucun formulaire. Chorégraphie : H1 en fondu montant (0.7 s), cartes hero en fondu montant avec délais 0.15 s puis 0.25 s. Aucune animation au scroll.
- **Endpoints API nécessaires** (publics, SSR/ISR, lecture) :
  - `GET /api/public/companies/ccdpaa/services?limit=3`
  - `GET /api/public/companies/ccdpaa/realisations?limit=3`
  - Tri par `ordre`.
- **Écart avec prisma/schema.prisma** :
  - Exclusion du service « Restaurant » (id 20) par id numérique en dur (écart 11).
  - `Realisation.imagePlaceholder` (URL externe) contre `imageKey` (écart 15).

## /ccdpaa/services  (`src/routes/ccdpaa.services.tsx` → `SubServicesPage slug="ccdpaa"` + `ImportExportAssistant`)
- **Composants clés** :
  - `SubServicesPage` (partagé). Il affiche les 4 services, y compris « Restaurant Les Ambassades d'Afrique » ; `heroPitch` vient de `SUB_CONFIG.ccdpaa`.
  - **`ImportExportAssistant`**, section sous la liste, décrit dans sa propre section plus bas.
  - Meta : « Catalogue import-export — CCDPAA ».
- **Entités de données utilisées** : `services` (ccdpaa : ids 17–20 → `id, filialeId, titre, description`). `SUB_CONFIG.ccdpaa.heroPitch`.
- **Interactions** : celles de l'assistant (voir sa section). CTA navy « Un besoin qui ne rentre pas exactement dans une case ? » → `/ccdpaa/contact`.
- **Endpoints API nécessaires** :
  - `GET /api/public/companies/ccdpaa/services` (public).
  - `POST /api/public/ccdpaa/assistant-import-export` (public, voir la section de l'assistant).
- **Écart avec prisma/schema.prisma** :
  - Le composant partagé affiche l'**id numérique** (`String(s.id).padStart(2,"0")`) et utilise un `linear-gradient` interdit par §6 (à traiter côté inventaire partagé).
  - Pas d'image de service dans la mockdata (`imageKey` restera null).

## Assistant Import-Export  (`src/components/subsidiary/ImportExportAssistant.tsx`, monté **uniquement** sur `/ccdpaa/services`)
- **Composants clés** :
  - Carte navy, eyebrow « Assistant import-export », H2 « Cinq questions pour bâtir votre plan d'approvisionnement. ».
  - Barre de progression en 5 segments (accent si fait, sinon blanc 20 %).
  - Étape courante : question, texte d'aide, puis soit des options en boutons pill (choix unique), soit un input texte.
  - Navigation : « Retour » (à partir de l'étape 2), « Continuer » ou « Obtenir ma recommandation », compteur « Étape n sur 5 ».
  - État final : « Notre recommandation » (texte), récap des 4 réponses en `dl`, mention « sous 48 heures ouvrables », bouton « Recommencer ».
- **Contenu scripté (dans le composant, pas dans mockdata)**, constante `STEPS` :
  1. `profil` : « Quel est votre profil ? » → Épicerie spécialisée | Restaurant | Grossiste / distributeur | Exportateur en Afrique
  2. `categorie` : « Quelle catégorie vous intéresse ? » → Tubercules et féculents | Épices et condiments | Fruits et légumes | Produits transformés
  3. `volume` : « Quel volume envisagez-vous par mois ? » → Moins de 200 kg | 200 à 1 000 kg | 1 à 5 tonnes | Plus de 5 tonnes
  4. `delai` : « Pour quelle échéance ? » → Dès que possible | Dans 1 à 3 mois | Dans plus de 3 mois | Exploration seulement
  5. `contact` : « Où pouvons-nous vous répondre ? », **un seul champ texte libre**, placeholder « Nom, entreprise, courriel »
  - `recommandation()` ne dépend **que** de `volume` : ≥ 1 t → conteneur 20 pieds Douala/Dakar ; 200–1 000 kg → groupage palettisé mensuel ; sinon → commande test depuis le stock de Montréal, livrée en 72 h. Chaque texte d'aide contient une promesse commerciale (6 à 8 semaines, etc.) à faire valider par le client.
- **Entités de données utilisées** : écrit dans `messages` (MessageContact) : `filialeId:"ccdpaa"`, `nom: answers.contact`, **`email: ""`**, `sujet:"Assistant import-export"`, `message: "profil: … · categorie: … · volume: … · delai: … · contact: …"`, `statut:"nouveau"`.
- **Interactions** :
  - Validation actuelle : réponse non vide seulement, sinon toast erreur « Réponse requise ». Aucune validation d'e-mail.
  - Chorégraphie : `AnimatePresence mode="wait"` entre étapes (entrée y 10 → 0, sortie y → −8, 0.2 s), fondu de l'état final, toast succès « Votre plan d'approvisionnement est prêt ».
  - Le récap affiche les **clés brutes** (`profil`, `categorie`…) comme libellés : à remplacer par de vrais libellés.
- **Validation cible (proposée)** :
  - Étapes 1–4 : `z.enum` sur des **clés stables** (ex. `epicerie`, `plus_5t`), pas sur les libellés français.
  - Étape 5 éclatée en `nom` (2–120), `entreprise` (optionnel, ≤ 160), `email` (email), `telephone` (optionnel), avec honeypot `website`.
  - Bouton « Continuer » désactivé tant qu'aucune réponse n'est donnée, au lieu du toast d'erreur.
- **Où vivent les Q&A** : **fichier statique versionné partagé** (ex. `shared/content/ccdpaa/assistant-import-export.ts`, `as const`). Il contient les étapes, les options `{ key, label }`, la fonction `recommandation(volumeKey)`, et le schéma zod dérivé, utilisé à l'identique par le client et le serveur. Pourquoi pas la base :
  1. aucun écran d'édition dans le prototype ni dans la checklist ;
  2. la règle de recommandation est couplée aux options, donc éditer une option en base casserait la règle en silence ;
  3. le serveur doit valider les réponses contre la même liste ;
  4. zéro requête en SSR/ISR.
  - **Exclu** : modèle `AssistantEtape` / `AssistantOption`, à ouvrir seulement si le client demande à éditer le questionnaire depuis le dashboard.
  - Aucun appel LLM, aucune interface de chat : conforme au retour client « pas une vraie IA ».
- **Endpoints API nécessaires** : `POST /api/public/ccdpaa/assistant-import-export` (public, sans rôle).
  - Rate-limit sur le même bucket que contact, borne de taille du corps (même pattern que `contact.post.ts`).
  - Filiale fixée côté serveur (`ccdpaa`), jamais fournie par le client.
  - Crée un `MessageContact` et renvoie `201 { ok: true }`. Erreurs : `400` (validation), `413`, `429`.
  - La recommandation est calculée côté client avec la fonction partagée ; le serveur ne renvoie rien d'identifiant.
- **Écart avec prisma/schema.prisma** : aucun type `TypeMessage` pour l'assistant, aucun champ structuré pour les 4 réponses, e-mail invalide dans le prototype (écart 3).

## /ccdpaa/realisations  (`src/routes/ccdpaa.realisations.tsx` → `SubRealisationsPage slug="ccdpaa"`)
- **Composants clés** : `SubRealisationsPage` (partagé, grille éditoriale à spans variés). Meta « Réalisations — CCDPAA ».
- **Entités de données utilisées** : `realisations` ccdpaa (ids 13, 14) → `id, filialeId, titre, description, imagePlaceholder, date`.
- **Interactions** : animations d'apparition au scroll (partagées), aucun formulaire.
- **Endpoints API nécessaires** : `GET /api/public/companies/ccdpaa/realisations` (public).
- **Écart avec prisma/schema.prisma** : `date` → `dateRealisation` (correspondance simple). `imagePlaceholder` URL → `imageKey` (écart 15). Pas d'`ordre` dans la mockdata : le déduire de l'ordre du tableau.

## /ccdpaa/a-propos  (`src/routes/ccdpaa.a-propos.tsx` → `SubAboutPage slug="ccdpaa"`)
- **Composants clés** : `SubAboutPage` (partagé : histoire avec `company.description`, équipe sur fond navy, partenaires). Meta « À propos — CCDPAA ».
- **Entités de données utilisées** :
  - `companies.description`.
  - `equipe` ccdpaa (ids 12, 13) → `id, filialeId, nom, poste, photoPlaceholder, bio`.
  - `partenaires` ccdpaa (ids 12, 13) → `id, filialeId, nom, logoPlaceholder, typeRelation`.
- **Interactions** : animations au scroll (partagées).
- **Endpoints API nécessaires** (publics) :
  - `GET /api/public/companies/ccdpaa` (description)
  - `GET /api/public/companies/ccdpaa/equipe`
  - `GET /api/public/companies/ccdpaa/partenaires`
- **Écart avec prisma/schema.prisma** :
  - `MembreEquipe.bio` absent, `Partenaire.typeRelation` absent (écart 14).
  - `Company.description` absente du seed actuel.
  - `radial-gradient` dans le composant partagé (§6).

## /ccdpaa/contact  (`src/routes/ccdpaa.contact.tsx` → `SubContactPage slug="ccdpaa"` + `SuggestionProduitForm slug="ccdpaa"`)
- **Composants clés** :
  - `SubContactPage` + `GenericContactForm` (partagés), textes de `SUB_CONFIG.ccdpaa` : intro « Distribution B2B », H1 « Demandez notre\ncatalogue. », baseline « Épiceries spécialisées, restaurateurs, grossistes… », successMsg.
  - **`SuggestionProduitForm`** (spécifique ccdpaa/boissons) : icône Lightbulb, H2 **« Un produit manque à notre catalogue ? »**, texte « …sur nos étals ».
  - Meta « Distribution B2B — CCDPAA ».
- **Entités de données utilisées** :
  - Formulaire contact → `messages` : `filialeId, nom, email, telephone, sujet (= "Distribution B2B"), message (sérialisé "k: v · …"), statut:"nouveau", date`.
  - Suggestion → `suggestions` : `filialeId, nom, email, produit, origine, commentaire, date`.
- **Interactions** :
  - **Formulaire contact CCDPAA** (tous requis, seule validation : champ non vide + toast « Formulaire incomplet ») :
    - `nom` (texte), `entreprise` (texte), `email` (email), `telephone` (tél.)
    - `produits` : select « Catégorie » : Fruits et légumes | Épices et condiments | Produits transformés | Tout le catalogue
    - `volume` : texte, placeholder « Ex. 500 kg / mois »
    - `message` : textarea « Détails », 3 lignes
    - Toast succès « Demande reçue ».
  - **Formulaire suggestion** (zod dans le prototype) :
    - `nom` : min 2
    - `email` : email
    - `produit` : min 2, placeholder « Ex. Fonio précuit »
    - `origine` : min 2, placeholder « Ex. Sénégal »
    - `commentaire` : **min 5**, label « Pourquoi ce produit ? »
    - Bouton « Proposer ce produit ». Toast « Suggestion enregistrée — Merci {nom}, notre équipe évalue « {produit} » ».
  - Cible commune aux deux formulaires : ajouter max length, trim, honeypot et mention Loi 25.
- **Endpoints API nécessaires** (publics) :
  - `POST /api/public/contact` (existe) : `type: CONTACT`, `companySlug: ccdpaa`, avec les champs propres à ccdpaa.
  - `POST /api/public/contact` avec `type: SUGGESTION_PRODUIT` → `produitSouhaite` = `produit`, `message` = `commentaire`, pays d'origine à stocker (écart 1).
  - Admin : `GET /api/admin/messages?type=SUGGESTION_PRODUIT&page=` (SUPER_ADMIN, ADMIN_FILIALE limité à sa filiale). L'endpoint existe mais **sans filtre `type` ni pagination**.
  - `PATCH /api/admin/messages/[uuid]` pour le statut ou `lu` (à créer).
- **Écart avec prisma/schema.prisma** :
  - Pas de colonne pour `origine` (écart 1).
  - Pas de colonnes pour `entreprise`, `produits`, `volume` (écart 2).
  - L'endpoint existant accepte `SUGGESTION_PRODUIT` pour n'importe quelle filiale, laisse `produitSouhaite` optionnel et exige `message` ≥ 10 alors que le client autorise `commentaire` ≥ 5 : un commentaire de 5 à 9 caractères donnera un **400** (écart 5).
  - Libellé : le prototype affiche « Un produit manque à notre catalogue ? », `PROJECT_STATE` dit « Vous ne trouvez pas ce que vous cherchez ? » (écart 19).

## /ccdpaa/restaurant  (`src/routes/ccdpaa.restaurant.tsx`, 6ᵉ page)
- **Composants clés** :
  - Hero : eyebrow « Restaurant · Plateau Mont-Royal », H1 « Les *Ambassades* d'Afrique. », pitch (treize cuisines, bar complet avec permis d'alcool, midi et soir).
  - Bloc infos « Ouverture : Mardi — dimanche 11h30 · 22h00 » et « Adresse : Plateau Mont-Royal, Montréal » (**pas d'adresse précise**).
  - Image salle 4/5 (Unsplash).
  - Section menu « Un aperçu de la carte / Treize cuisines, une même table. » : grille de 4 plats, cartes paires décalées `md:mt-10`.
  - `ReservationForm` : carte à fond accent `#BA7517`, texte blanc.
  - Meta : title « Les Ambassades d'Afrique — Restaurant panafricain à Montréal », description, og:*.
- **Entités de données utilisées** :
  - `companies.couleurAccent`.
  - `menu` **en dur dans la route**, 4 entrées `{plat, origine, img}` : Yassa poulet / Sénégal, Ndolé aux crevettes / Cameroun, Kitfo épicé / Éthiopie, Tajine d'agneau aux abricots / Maroc.
  - Écrit dans `reservations` : `nom, email, telephone, date, heure, personnes (Number(v)||1), note, statut:"en_attente", creeLe`.
- **Interactions** :
  - **Formulaire de réservation, zod du prototype** :
    - `nom` : min 2
    - `email` : email
    - `telephone` : min 7
    - `date` : `type=date`, min 1
    - `heure` : `type=time`, min 1
    - `personnes` : **input texte**, `string.min(1)`, placeholder « 4 »
    - `notes` : optionnel, textarea 2 lignes, « Allergies, occasion spéciale… »
  - Le prototype ne contrôle ni date passée, ni jour fermé, ni horaires, ni plafond de personnes ; « abc » personnes devient 1.
  - Bouton « Réserver ma table » (« Envoi… » pendant la soumission). Toast « Réservation reçue — À bientôt {nom}, nous confirmons votre table par courriel. », puis reset.
  - Chorégraphie : H1 en fondu montant 0.7 s ; plats en apparition au scroll `once`, décalage `i*0.06` s ; bouton qui monte au survol.
- **Validation cible (proposée, source unique `shared/validation/reservation.ts`, constantes nommées dans `shared/config/restaurant.ts`)** :
  - `RESTAURANT_TIMEZONE = "America/Montreal"`, `JOURS_OUVERTURE = [2..7]` (mardi → dimanche), `HEURE_OUVERTURE = "11:30"`, `DERNIER_SERVICE = "21:30"` (hypothèse : 30 min avant la fermeture de 22h00), `PAS_CRENEAU_MIN = 30`, `RESERVATION_MAX_JOURS_AVANCE = 90`, `RESERVATION_DELAI_MIN_HEURES = 2`, `RESERVATION_MAX_PERSONNES = 20`. La mock contient une réservation de 14 : le plafond doit être au moins 14 ; au-delà, passer par le contact « groupe ».
  - `date` au format `YYYY-MM-DD` : ≥ aujourd'hui (heure de Montréal), ≤ aujourd'hui + 90 j, jour ouvré.
  - `heure` dans les créneaux générés : **Select de créneaux** au lieu d'un `time` libre (écart visuel mineur à valider). Si la date est aujourd'hui : heure ≥ maintenant + 2 h.
  - `nombrePersonnes` : `z.coerce.number().int().min(1).max(20)`, champ number ou select.
  - `telephone` : trim, 7–30 caractères, regex `[0-9+().\s-]`. `email` : lowercase, ≤ 254. `notes` : ≤ 1000. Honeypot `website`.
  - Le serveur combine `date` et `heure` en fuseau Montréal puis stocke `dateReservation` en UTC.
  - Pas de gestion de capacité (exclu : aucune donnée de capacité ; confirmation manuelle via le statut).
- **Endpoints API nécessaires** :
  - `POST /api/public/ccdpaa/reservations` (public ; filiale `ccdpaa` fixée côté serveur, jamais fournie par le client).
    - Contrôles : rate-limit (bucket `reservation`), borne de taille du corps, zod.
    - Réponse : `201 { ok: true }`. Erreurs : `400`, `413`, `429`.
  - `GET /api/admin/reservations?statut=&du=&au=&page=` (admin).
    - Rôles : SUPER_ADMIN, ou ADMIN_FILIALE dont la filiale est `ccdpaa` ; une autre filiale reçoit `403`.
    - `select` explicite : `uuid, nom, email, telephone, nombrePersonnes, dateReservation, notes, statut, createdAt`.
  - `PATCH /api/admin/reservations/[uuid]` `{ statut }` (mêmes rôles).
    - Paramètre `z.string().uuid()`.
    - Transitions proposées : `EN_ATTENTE → CONFIRMEE | ANNULEE`, `CONFIRMEE → ANNULEE`, `ANNULEE` terminal.
    - Erreurs : `404` (introuvable ou hors périmètre), `409` (transition interdite).
- **Écart avec prisma/schema.prisma** :
  - `date` + `heure` séparés contre `dateReservation` unique.
  - Renommages : `note` → `notes`, `personnes` → `nombrePersonnes`, `creeLe` → `createdAt`.
  - Pas de `filialeId` dans la mock.
  - Pas d'`updatedAt` (utile pour tracer le changement de statut).
  - Menu, horaires et adresse sans modèle.
  - Promesse de courriel sans infra (écarts 6–9).
  - La route admin `/admin/ccdpaa/reservations` de `PROJECT_STATE` ne correspond pas au prototype, où c'est un onglet de `/admin/messages` (écart 18).

---

## /boissons (layout)  (`src/routes/boissons.tsx` → `SubLayout slug="boissons"`)
- **Composants clés** : `SubLayout` (partagé), nav standard à 5 entrées. `shortName` « CD Boissons d'Afrique », accent `#A32D2D`, footer `boissons@groupe-cd.ca` / `+1 (514) 000-1006`.
- **Entités de données utilisées** : `companies[slug=boissons]`, `SUB_CONFIG.boissons`.
- **Interactions** : aucune. Meta « CD Boissons d'Afrique — Distribution de boissons africaines au Canada » + og:*.
- **Endpoints API nécessaires** : `GET /api/public/companies/boissons` (public).
- **Écart avec prisma/schema.prisma** : identique au layout ccdpaa (e-mail et téléphone de contact hors schéma, écart 13).

## /boissons  (`src/routes/boissons.index.tsx` → `SubHome slug="boissons"`)
- **Composants clés** : `SubHome` + `SubHero` (partagés). Textes : tagline « Distribution de boissons · Canada », H1 « Les boissons *d'Afrique* au Canada. », heroImage Unsplash, CTA « Devenir point de vente ».
- **Entités de données utilisées** : `services` boissons (ids 21–24 → `id, filialeId, titre, description`, 3 premiers). `realisations` boissons (ids 15, 16 → `titre, imagePlaceholder, date`).
- **Interactions** : animations partagées, aucun formulaire.
- **Endpoints API nécessaires** (publics) :
  - `GET /api/public/companies/boissons/services?limit=3`
  - `GET /api/public/companies/boissons/realisations?limit=3`
- **Écart avec prisma/schema.prisma** : `imagePlaceholder` → `imageKey` (écart 15). Rien d'autre de spécifique.

## /boissons/services  (`src/routes/boissons.services.tsx` → `SubServicesPage slug="boissons"`)
- **Composants clés** : `SubServicesPage` (partagé). Meta « Services — CD Boissons d'Afrique ». **Pas d'assistant.**
- **Entités de données utilisées** : `services` boissons (4) ; `SUB_CONFIG.boissons.heroPitch`.
- **Interactions** : CTA vers `/boissons/contact`.
- **Endpoints API nécessaires** : `GET /api/public/companies/boissons/services` (public).
- **Écart avec prisma/schema.prisma** : aucun propre à la filiale. Défauts du composant partagé déjà signalés : id affiché et dégradé. Angle mort : un distributeur de marques **sans catalogue de marques**, `pagesContenu` id 15 « Nos marques » n'étant lu par aucune page publique (écart 24).

## /boissons/realisations  (`src/routes/boissons.realisations.tsx` → `SubRealisationsPage slug="boissons"`)
- **Composants clés** : `SubRealisationsPage` (partagé). Meta « Réalisations — CD Boissons d'Afrique ».
- **Entités de données utilisées** : `realisations` boissons (ids 15, 16) → `id, filialeId, titre, description, imagePlaceholder, date`.
- **Interactions** : animations au scroll.
- **Endpoints API nécessaires** : `GET /api/public/companies/boissons/realisations` (public).
- **Écart avec prisma/schema.prisma** : `date` → `dateRealisation` ; image (écart 15).

## /boissons/a-propos  (`src/routes/boissons.a-propos.tsx` → `SubAboutPage slug="boissons"`)
- **Composants clés** : `SubAboutPage` (partagé). Meta « À propos — CD Boissons d'Afrique ».
- **Entités de données utilisées** : `companies.description` ; `equipe` boissons (ids 14, 15 → `nom, poste, photoPlaceholder, bio`) ; `partenaires` boissons (ids 14, 15 → `nom, logoPlaceholder, typeRelation`).
- **Interactions** : animations au scroll.
- **Endpoints API nécessaires** (publics) :
  - `GET /api/public/companies/boissons`
  - `GET /api/public/companies/boissons/equipe`
  - `GET /api/public/companies/boissons/partenaires`
- **Écart avec prisma/schema.prisma** : `bio` et `typeRelation` absents (écart 14).

## /boissons/contact  (`src/routes/boissons.contact.tsx` → `SubContactPage slug="boissons"` + `SuggestionProduitForm slug="boissons"`)
- **Composants clés** :
  - `SubContactPage` + `GenericContactForm` : intro « Devenir point de vente », H1 « Distribuez nos\nmarques. », baseline « SAQ agence, épicerie, restaurant ou bar ? ».
  - `SuggestionProduitForm` : texte « …dans notre portefeuille de marques », placeholder produit « Ex. Bissap pétillant ».
  - Meta « Distribution — CD Boissons d'Afrique ».
- **Entités de données utilisées** : `messages` (même forme que ccdpaa, `sujet = "Devenir point de vente"`) ; `suggestions` (même forme).
- **Interactions** :
  - **Formulaire contact Boissons** (tous requis, validation : champ non vide) :
    - `nom`, `etablissement` (texte)
    - `type` : select « Type d'établissement » : SAQ agence / épicerie | Restaurant | Bar / lounge | Hôtel | Grossiste
    - `email`, `telephone`, `ville` (texte)
    - `marques` : select « Marques d'intérêt » : Toutes nos marques | Boissons alcoolisées | Boissons non alcoolisées | Sodas et rafraîchissements
    - `message` : textarea 3 lignes
  - **Formulaire suggestion** : champs et validation identiques à ccdpaa.
- **Endpoints API nécessaires** : identiques à `/ccdpaa/contact`, avec `companySlug: boissons` (public) et `GET /api/admin/messages?type=` côté admin.
- **Écart avec prisma/schema.prisma** : pas de colonnes pour `etablissement`, `type`, `ville`, `marques` (écart 2) ; `origine` (écart 1) ; endpoint `contact.post.ts` (écart 5).

---

## Écarts détectés (ccdpaa + boissons)

Chaque écart est suivi d'une seule proposition de résolution. Rien n'a été appliqué.

1. **`MessageContact`, pays d'origine d'une suggestion.** Le prototype a `origine` (requis, min 2) ; aucune colonne dans le schéma.
   - → Ajouter `paysOrigine String?` à côté de `produitSouhaite`, obligatoire en zod quand `type = SUGGESTION_PRODUIT`.
2. **`MessageContact`, champs propres à chaque filiale.** ccdpaa : `entreprise`, `produits`, `volume`. boissons : `etablissement`, `type`, `ville`, `marques`. Le prototype les sérialise en texte dans `message`.
   - → Ajouter `entreprise String?` (sert aussi la conversion « Ajouter aux clients » du CRM) et `details Json?`, validé côté serveur par un schéma zod par filiale, issu d'une config partagée qui remplace `SUB_CONFIG.fields`.
   - Repli sans migration : sérialisation côté serveur dans `message`, au prix de ne plus pouvoir filtrer.
3. **`MessageContact`, assistant.** Le prototype enregistre `email: ""` (invalide au schéma et au zod) et un contact en texte libre.
   - → Ajouter la valeur d'enum `TypeMessage.ASSISTANT_IMPORT_EXPORT`, éclater l'étape contact en `nom` / `entreprise` / `email` / `telephone?`, stocker les 4 réponses en clés stables dans `details`.
4. **`MessageContact`, statut.** La mock a `statut` nouveau / en_cours / traite (msg 6 ccdpaa `en_cours`, msg 7 boissons `nouveau`) ; le schéma a `lu Boolean`.
   - → Enum `StatutMessage { NOUVEAU EN_COURS TRAITE }` à la place de `lu`. Décision partagée avec l'inventaire `/admin/messages`.
5. **`server/api/public/contact.post.ts`.**
   - `SUGGESTION_PRODUIT` est accepté pour toute filiale.
   - `produitSouhaite` est optionnel même pour une suggestion.
   - `message.min(10)` contre `commentaire.min(5)` côté client : 400 pour un commentaire de 5 à 9 caractères.
   - → `z.discriminatedUnion('type')`, suggestion limitée à `ccdpaa | boissons`, `produitSouhaite` requis, minimums alignés dans un fichier `shared/validation/contact.ts` unique.
6. **`ReservationRestaurant`, forme des données.** Le prototype a `date` + `heure` séparés ; le schéma a `dateReservation DateTime`. Mock sans `filialeId`. Renommages `note` → `notes`, `personnes` → `nombrePersonnes`. Pas d'`updatedAt`.
   - → Combiner date et heure en fuseau `America/Montreal` puis stocker en UTC. Ajouter `updatedAt DateTime @updatedAt` et `@@index([companyId, statut])`. Le seed rattache les 3 réservations à `ccdpaa`.
7. **`ReservationRestaurant`, validation absente du prototype.** Personnes en texte libre, date passée, lundi ou heure hors ouverture acceptés.
   - → Règles serveur et client partagées (voir la section `/ccdpaa/restaurant`), créneaux issus de `shared/config/restaurant.ts`. Capacité exclue.
8. **Promesse de courriel sans infrastructure.** « Réservation confirmée par courriel dans l'heure », « nous confirmons votre table par courriel » ; aucun envoi de mail dans le projet.
   - → Reformuler en « Nous vous recontactons pour confirmer » tant qu'aucun envoi de mail n'existe. L'ajout d'un mailer est une décision ouverte.
9. **Menu, horaires et adresse du restaurant en dur.** 4 plats `{plat, origine, img}`, « Mardi — dimanche 11h30 · 22h00 », « Plateau Mont-Royal », sans modèle.
   - → Contenu statique versionné (`shared/content/ccdpaa/restaurant.ts`), horaires partagés avec la validation des créneaux. Modèle `PlatRestaurant` (nom, origine, imageKey, ordre) seulement si le client veut éditer le menu. Adresse précise à obtenir du client.
10. **Q&A de l'assistant dans le composant.** La règle de recommandation dépend des libellés français.
    - → Fichier statique versionné, clés stables, zod dérivé, partagé client et serveur. Stockage en base exclu (raisons dans la section de l'assistant).
11. **Accueil CCDPAA : `services.filter(s => s.id !== 20)`**, id numérique en dur pour exclure « Restaurant Les Ambassades d'Afrique ».
    - → Retirer ce service du seed : le restaurant a sa propre page et sa propre carte en hero. Sinon, `ordre` en dernier + `take(3)`, mais c'est fragile si l'admin réordonne.
12. **`Company` : champs mock absents du schéma.** `imagePlaceholder`, `employesCount`, `statutSite` (**ccdpaa = `en_maintenance`**). Le seed actuel diverge aussi : secteur ccdpaa sans « et restauration », `description` absente pour les deux filiales.
    - → Le seed reprend `secteur` et `description` depuis la mockdata. `statutSite` est une décision ouverte : s'il masque le site public, ccdpaa serait masquée. Proposer `actif` pour toutes.
13. **`SUB_CONFIG.ccdpaa` / `.boissons`** (textes, e-mail, téléphone, CTA, champs de formulaire) hors schéma. Les domaines d'e-mail sont incohérents : `@groupe-cd.ca` dans `SUB_CONFIG`, `@groupecd.ca` dans employés et users.
    - → Config statique versionnée `shared/config/filiales.ts` ; `email` et `telephone` de contact sur `Company` si le client veut les éditer. Trancher le domaine.
14. **`MembreEquipe.bio` et `Partenaire.typeRelation`** absents. La mock ccdpaa et boissons en contient 4 de chaque.
    - → Ajouter `bio String? @db.Text` et `typeRelation String?`. Décision partagée avec l'inventaire commun.
15. **Images en liens externes** : Unsplash (hero, restaurant, menu, réalisations), pravatar (équipe), dicebear (logos). Le schéma utilise `*Key` → `Fichier`, et la CSP `nuxt-security` bloquera ces domaines.
    - → Le script de migration télécharge les images de contenu, les enregistre en `Fichier` `PUBLIC` et remplit `imageKey`. Les images de décor des pages vont en assets versionnés. Pravatar et dicebear ne vont jamais en production.
16. **`pagesContenu` (ids 12–15 ccdpaa/boissons)** : pas de modèle `PageContenu`, `filialeId` numérique (5/6) contrairement aux autres collections, non lu par les pages publiques.
    - → À trancher dans l'inventaire de `/admin/contenu`. En l'état, ne pas migrer.
17. **Suggestions invisibles dans l'admin du prototype** (collection écrite, jamais lue).
    - → Filtre `type` dans `/admin/messages` et ajout à la checklist `PROJECT_STATE`.
18. **Admin des réservations** : `PROJECT_STATE` prévoit `/admin/ccdpaa/reservations`, le prototype en fait un onglet de `/admin/messages`, visible si la filiale est dans le périmètre.
    - → Garder la route dédiée de `PROJECT_STATE` et documenter l'écart au prototype.
19. **Retour client, libellé.** Le prototype affiche « Un produit manque à notre catalogue ? », `PROJECT_STATE` dit « Vous ne trouvez pas ce que vous cherchez ? ».
    - → Adopter le libellé de `PROJECT_STATE` (retour client probable) et le confirmer.
20. **Retour client non tracé.** « Assistant scripté, PAS une vraie IA » est cité dans `PROJECT_STATE` comme venant de `PROJECT_CONTEXT`, qui ne le contient pas.
    - → Ajouter une ligne dans `PROJECT_CONTEXT` §2 ou §7 (questionnaire à 5 étapes, recommandation fixe, aucun LLM).
21. **Composants partagés utilisés par ces routes** : `linear-gradient` (`SubServicesPage`) et `radial-gradient` (`SubAboutPage`) interdits par §6 ; id numérique affiché (`SubServicesPage`).
    - → À corriger dans l'inventaire partagé (index d'affichage au lieu de l'id).
22. **Loi 25 (Québec)** : 4 formulaires publics collectent des données personnelles (contact, suggestion, réservation, assistant) sans mention de confidentialité.
    - → Mention et lien vers une politique de confidentialité sous chaque formulaire (le texte vient du client).
23. **Boissons alcoolisées** : ni vérification d'âge ni mention légale.
    - → Question au client (règles publicitaires RACJ). Pas de vérification d'âge par défaut.
24. **« Catalogue » sans entité.** « Découvrir le catalogue », « Recevoir le catalogue », « Nos marques » : pas d'entité `Produit` ni `Marque`, pas de PDF ; ce sont les services qui tiennent lieu de catalogue.
    - → Hors périmètre. Confirmer avec le client que les services suffisent pour la v1.
25. **Planning restaurant (hors routes demandées, données ccdpaa).** La mock `PlanningEntry` est récurrente (`jour`, `debut`, `fin`, `lieu`) alors que le schéma a `dateDebut` / `dateFin` datés et pas de `lieu`. `Employe.statut` a 3 valeurs contre `actif Boolean`.
    - → À traiter dans l'inventaire planning.

## Mockdata ccdpaa + boissons

Source : `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/data/mockdata.ts`

| Collection | Nb (ccdpaa / boissons) | Ids | Champs réels | Cible Prisma / notes de mapping |
|---|---|---|---|---|
| `companies` | 1 / 1 | 5, 6 | `id, slug, nom, secteur, description, couleurAccent, imagePlaceholder, employesCount, statutSite` | `Company` par `slug` ; `imagePlaceholder`, `employesCount`, `statutSite` sans colonne (écart 12) |
| `services` | 4 / 4 | 17–20 / 21–24 | `id, filialeId, titre, description` | `Service` ; `ordre` = position dans le tableau ; id 20 à retirer ou mettre en dernier (écart 11) |
| `equipe` | 2 / 2 | 12, 13 / 14, 15 | `id, filialeId, nom, poste, photoPlaceholder, bio` | `MembreEquipe` ; `bio` sans colonne ; pravatar interdit en prod |
| `realisations` | 2 / 2 | 13, 14 / 15, 16 | `id, filialeId, titre, description, imagePlaceholder, date` | `Realisation` ; `date` → `dateRealisation` ; image → `Fichier` |
| `partenaires` | 2 / 2 | 12, 13 / 14, 15 | `id, filialeId, nom, logoPlaceholder, typeRelation` | `Partenaire` ; `typeRelation` sans colonne ; `siteUrl` absent de la mock |
| `messagesContact` | 1 / 1 | 6 / 7 | `id, filialeId, nom, email, sujet, message, statut, date` (`telephone?` absent sur les deux) | `MessageContact` `type = CONTACT` ; `statut` contre `lu` (écart 4) ; données **démo**, seed de dev uniquement |
| `suggestionsProduits` | 1 / 1 | 1 / 2 | `id, filialeId, nom, email, produit, origine, commentaire, date` | `MessageContact` `type = SUGGESTION_PRODUIT` : `produit` → `produitSouhaite`, `commentaire` → `message`, `origine` → écart 1 ; démo |
| `reservationsRestaurant` | 3 / — | 1–3 | `id, nom, email, telephone, date, heure, personnes, note?, statut, creeLe` (pas de `filialeId`) | `ReservationRestaurant` rattaché à `ccdpaa` ; `date` + `heure` → `dateReservation` (fuseau Montréal) ; `statut` en minuscules → enum ; démo |
| `employes` | 1 / 1 | 7 / 8 | `id, filialeId, nom, poste, email, statut` | `Employe` ; `statut` 3 valeurs contre `actif` ; Kwame Mensah est « Directeur commercial » dans `equipe` et « Représentant HoReCa » dans `employes` |
| `planningEntries` | 1 / 0 | 7 (employeId 7) | `id, employeId, jour, debut, fin, lieu, note?` | `PlanningEntry` : modèle récurrent contre dates précises (écart 25) |
| `clients` | 1 / 1 | 5 / 4 | `id, nom, entreprise, email, telephone, filialeId, statut, notes, creeLe` | `Client` : `prospect` → `PROSPECT`, `creeLe` → `dateAjout` ; démo |
| `pagesContenu` | 2 / 2 | 12, 13 / 14, 15 | `id, filialeId (5/6 numérique), section, titre, contenu, derniereModification` | Aucun modèle (écart 16) ; ne pas migrer en l'état |
| `users` | 0 / 0 | — | — | Pas d'admin ccdpaa ni boissons en mock ; le seed devra créer un `ADMIN_FILIALE` ccdpaa pour tester l'admin des réservations (mot de passe lu depuis `.env`) |

**Contenu statique hors mockdata** (à versionner, pas à mettre en seed) :
- `SUB_CONFIG.ccdpaa` / `SUB_CONFIG.boissons` (`src/components/subsidiary/subConfig.ts`) : `shortName, tagline, headlineLead, headlineAccent, headlineTail, heroImage, heroPitch, email, phone, ctaLabel, contactIntro, contactHeadline, contactBaselinE, successMsg, fields[]` (7 champs ccdpaa, 8 champs boissons).
- `menu` du restaurant (`src/routes/ccdpaa.restaurant.tsx`) : 4 entrées `{plat, origine, img}`.
- `STEPS` de l'assistant (`src/components/subsidiary/ImportExportAssistant.tsx`) : 5 étapes `{key, question, help, options?, placeholder?}`, 16 options au total, plus la fonction `recommandation()` à 3 branches.
- Images hero de l'accueil CCDPAA et du restaurant : Unsplash en dur dans les routes.

**Périmètre du script `migrate-mockdata-to-seed`** : selon `PROMPT_CONVERSION` phase 2, seulement `Service`, `Realisation`, `Partenaire`, `MembreEquipe` (+ `Company.secteur` / `description`). Les données opérationnelles (messages, suggestions, réservations, clients, employés, planning) sont de la **démo** : seed de dev uniquement, jamais en production.

**Règle d'arrêt** : la liste des écarts n'est pas vide (25 points, dont 1, 2, 3, 4, 6, 12, 14 qui touchent au schéma). Aucune modification Prisma avant confirmation de l'utilisateur.



---
