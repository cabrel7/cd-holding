# Spec Phase 2 : fondations communes (Groupe CD)

Spec en lecture seule. Aucun fichier n'a été modifié. Sources lues : CLAUDE.md, PROJECT_STATE.md (décisions du 2026-09-25), CONVERSION_INVENTORY.md (4 parties), PROMPT_CONVERSION.md (phase 2), PROJECT_CONTEXT.md, et le code existant : schéma et seed Prisma, `server/**`, `shared/**`, `app/**`, `nuxt.config.ts`, `vitest.config.ts`, plus le prototype (`mockdata.ts`, `subConfig.ts`, composants holding et filiales, routes spécifiques). Skills appliqués : nitro, vue3, ui-ux.

---

## 0. CHALLENGE

**Hypothèses implicites du brief**
- Le script de migration « écrit en base ». Or c'est un script ponctuel, supprimable, et le prototype peut disparaître. Si le contenu n'existe qu'en base de dev, une base de prod neuve n'a aucun moyen de le recevoir, sauf un dump.
- Le script peut « lire les textes en dur des routes spécifiques ». En pratique, ces textes sont du JSX qui importe framer-motion et tanstack, absents de `node_modules`. Les extraire par un parseur serait fragile. Et la moitié de ces textes doit de toute façon être réécrite : supermarchés, pitch comptable, promesses de courriel, Loi 25, libellé de la suggestion.
- « Ne jamais écraser `nom`, `secteur`, `couleurAccent` » ne suffit plus maintenant que tout est éditable. Un seed relancé écraserait n'importe quelle correction faite par le client, et ressusciterait les fiches qu'il a supprimées.

**Angles morts**
- Sans invalidation, le cache ISR à 3600 s rend l'édition « invisible » pendant une heure. Le parcours « éditer → publier » n'a jamais été validé, même dans le prototype.
- Le premier test e2e demandé (« l'accent change par filiale ») n'a aucune page filiale sur laquelle tourner en phase 2.
- `app/app.vue` n'a pas de `<NuxtLayout>` : aucun layout ne s'appliquerait.
- Les pages admin existantes recevraient le layout public par défaut.
- `server/api/admin/messages/index.get.ts` lit `lu`, supprimé par DEC-11 : le typecheck casse.
- `nuxt.config.ts` duplique la liste des slugs (`publicSections`).
- Les composants shadcn `select`, `textarea` et `switch` sont absents du dépôt.
- Contraste WCAG : l'or `#C9A227` sur crème donne environ 2,2:1. Le texte blanc sur les accents corail, orange et terracotta reste sous 4,5:1.
- Tailwind v4 sans `@custom-variant dark` applique les classes `dark:` des composants shadcn selon le mode sombre de l'OS.

**Meilleure approche retenue**
1. **Script = générateur**, pas écrivain en base. Il produit des fichiers versionnés (`prisma/seed-data/prototype.generated.ts` et `prisma/seed-assets/images/*.jpg`) que `prisma/seed.ts` consomme. Le seed reste reproductible en prod, le prototype et le script peuvent être supprimés.
2. **Textes JSX transcrits à la main** dans `prisma/seed-data/sections.ts`, avec la référence `fichier:ligne` de la source. Les corrections client y sont appliquées au même endroit.
3. **Seed de contenu en « amorçage »**. Pour les collections, insertion uniquement si la filiale n'a aucune ligne de cette entité. Pour les sections, création seulement si le couple (site, page, clé) manque. Aucune mise à jour : les éditions admin ne sont jamais écrasées, les suppressions jamais ressuscitées.
4. **Contenu éditable = catalogue défini dans le code, valeurs en base** (modèle `SectionContenu`). Les clés, types et schémas zod sont versionnés ; seules les valeurs vivent en base, et l'admin ne crée ni ne supprime de clé. Pas de table `PageContenu` libre (voir §1.2).
5. **Invalidation ISR** : purge complète du cache des routes à chaque écriture de contenu public. Assez simple pour être sûr sur une quarantaine de pages.
6. **Le périmètre de phase 2 s'étend à `/[filiale]/a-propos`** (même composition que `/a-propos` holding : sections, équipe, partenaires). Le test e2e d'accent devient réel sur 7 sites, et la route dynamique `[filiale]` ainsi que l'ISR sont validés.

**À retirer / simplifier**
- `couleurAccent` n'est **pas** éditable dans l'admin (§6 non négociable).
- Pas de table de journalisation des courriels : envoi « au mieux » et journal d'échec sans donnée personnelle.
- Pas de glisser-déposer pour réordonner : boutons haut/bas accessibles au clavier.
- Le questionnaire de l'assistant (étapes, clés d'options) reste du code, car c'est une structure de formulaire couplée au zod. Seuls les textes d'introduction et de recommandation sont éditables.

**Périmètre réel plus large que demandé**
- Fichiers oubliés par le brief : `app/app.vue`, `app/pages/admin/{index,login}.vue` (`layout: false`), `app/middleware/admin.ts` (rôles par page), `server/api/admin/messages/index.get.ts`, `server/utils/storage.ts` (extraction du sniff, réutilisé par le seed), `nuxt.config.ts`, `.env.example`, `components/ui/{select,textarea,switch}`.
- Le schéma absorbe **toutes** les décisions DEC-01…39, y compris placement, comptable et planning : une migration unique maintenant, pour éviter de désynchroniser les filiales plus tard.

**Changements par rapport au brief littéral** : points 1, 2, 3, 6 ci-dessus. S'y ajoutent des clés étrangères vers `Fichier` sur les colonnes d'image et de CV, un effectif à source unique avec chiffres calculés, un modèle `ReglagesRestaurant` dédié, et la dépendance `nodemailer`.

---

## 1. Schéma Prisma cible

### 1.1 Enums (nouveaux ou modifiés)

```prisma
enum StatutSite       { ACTIF EN_MAINTENANCE EN_CONSTRUCTION }            // DEC-09 (fonctionnel)
enum PageSite         { COMMUN ACCUEIL SERVICES REALISATIONS A_PROPOS CONTACT RESTAURANT OFFRES CONFIDENTIALITE MENTIONS_LEGALES }
enum StatutMessage    { NOUVEAU EN_COURS TRAITE }                          // DEC-11 (remplace lu)
enum TypeMessage      { CONTACT SUGGESTION_PRODUIT ASSISTANT_IMPORT_EXPORT } // DEC-14
enum CategoriePoste   { MANUTENTION CHAUFFEUR_CLASSE_1 CHAUFFEUR_CLASSE_3 CHAUFFEUR_CLASSE_5 ENTRETIEN AUTRE } // DEC-19/23
enum NiveauExperience { MOINS_1_AN UN_A_TROIS_ANS TROIS_A_CINQ_ANS PLUS_5_ANS } // DEC-18
enum StatutCandidat   { DISPONIBLE EN_PROCESSUS PLACE }                    // DEC-23
enum OrigineCandidat  { LOCAL INTERNATIONAL }
enum TypeContrat      { TEMPS_PLEIN TEMPS_PARTIEL TEMPORAIRE }             // DEC-16
enum StatutDemande    { OUVERTE POURVUE ANNULEE }                          // DEC-17
enum ForfaitComptable { MENSUEL TRIMESTRIEL ANNUEL }                       // DEC-26
enum StatutDossier    { A_JOUR EN_RETARD EN_TRAITEMENT }
```
Les enums `CompanyType`, `Role`, `StatutClient`, `StatutCandidature` (4 valeurs, DEC-18), `StatutReservation` et `VisibiliteFichier` ne changent pas.

### 1.2 Contenu éditable : décision tranchée

| Nature du contenu | Où il vit | Pourquoi |
|---|---|---|
| Identité et réglages structurels, réutilisés sur plusieurs pages, en SEO `LocalBusiness` et en admin (coordonnées, nom court, image hero, ordre, effectif, statut du site, réseaux) | **Colonnes typées sur `Company`** | Interrogeables, typées par Prisma, lues par le layout. Aucune migration en phase 3. |
| Collections (services, réalisations, équipe, partenaires) | Tables existantes enrichies | Déjà modélisées. |
| Textes éditoriaux (héros, en-têtes de section, CTA, SEO, textes de formulaire, textes légaux, menu, recommandations de l'assistant) | **`SectionContenu`** : une ligne par (company, page, clé), `donnees Json` validé par zod selon le type déclaré dans un **catalogue versionné** `shared/content/sections/` | Une seule table au lieu d'une quinzaine. Typage de bout en bout via le catalogue. Validation à l'écriture (admin) **et** à la lecture (public). Invalidation ISR uniforme. Ajouter une clé en phase 3 = une entrée de catalogue + une valeur par défaut, sans migration. |
| Réglages du restaurant (jours, heures, créneaux, capacité) | **`ReglagesRestaurant`** (1:1 avec Company) | Consommés par la validation métier des réservations côté serveur. Un JSON dont le schéma zod évoluerait casserait la validation en silence ; des colonnes passent par les migrations. |
| Services mis en avant | `Service.misEnAvant Boolean` (3 au maximum, contrôlé côté serveur) | Plus simple qu'une liste d'uuid ; supprimer un service ne laisse aucune référence pendante. |

Alternatives écartées :
- **Clé/valeur par champ texte** : plus de 200 lignes non groupées, pas de type composite (listes de chiffres, textes légaux structurés).
- **Tout sur `Company`** : plus de 60 colonnes.
- **`PageContenu` libre à la manière du prototype** : l'admin pourrait créer des clés qu'aucune page ne lit. C'est exactement le défaut relevé par DEC-08.
- Les textes jamais affichés du `pagesContenu` du prototype **ne servent pas de source** : ils contredisent `SUB_CONFIG`. Les valeurs par défaut viennent de ce que le prototype affiche réellement, corrigé.

### 1.3 Modèles : cible (diff par rapport à l'actuel)

```prisma
model Company {
  // existants : id, uuid, type, slug, nom, secteur, description, couleurAccent, logoKey, createdAt, updatedAt
  nomCourt      String?                                   // + DEC-03
  ordre         Int        @default(0)                    // + DEC-04 (affichage index+1, jamais l'id)
  statutSite    StatutSite @default(ACTIF)                // + DEC-09
  effectif      Int?                                      // + Q-03 (source unique)
  email         String?                                   // + DEC-03 / Q-02
  telephone     String?
  adresse       String?
  linkedinUrl   String?                                   // + liens sociaux masqués si null
  facebookUrl   String?
  instagramUrl  String?
  logo          Fichier?  @relation("CompanyLogo", fields: [logoKey], references: [key], onDelete: SetNull)  // FK ajoutée
  heroImageKey  String?                                   // + DEC-04
  heroImage     Fichier?  @relation("CompanyHero", fields: [heroImageKey], references: [key], onDelete: SetNull)
  sections           SectionContenu[]
  reglagesRestaurant ReglagesRestaurant?
  affectations       Affectation[]
  // relations existantes inchangées
  @@index([type, ordre])
}

model User {            // + employe Employe? (relation inverse de DEC-29)
  employe Employe?
}

model Fichier {         // relations inverses des FK de clé (la clé reste l'identifiant externe)
  companiesLogo  Company[]      @relation("CompanyLogo")
  companiesHero  Company[]      @relation("CompanyHero")
  services       Service[]
  realisations   Realisation[]
  membresEquipe  MembreEquipe[]
  partenaires    Partenaire[]
  candidatsCv    Candidat[]
  candidaturesCv Candidature[]
}

model Service {
  misEnAvant Boolean  @default(false)                     // + Q-05
  image      Fichier? @relation(fields: [imageKey], references: [key], onDelete: SetNull)
}

model MembreEquipe {
  bio   String?  @db.Text                                  // + DEC-01
  photo Fichier? @relation(fields: [photoKey], references: [key], onDelete: SetNull)
}

model Realisation {
  dateRealisation DateTime? @db.Date                       // ~ DEC-06
  image           Fichier?  @relation(fields: [imageKey], references: [key], onDelete: SetNull)
}

model Partenaire {
  typeRelation String?                                     // + DEC-02 / Q-06
  logo         Fichier? @relation(fields: [logoKey], references: [key], onDelete: SetNull)
}

model SectionContenu {                                     // NOUVEAU (DEC-07/08)
  id        Int      @id @default(autoincrement())
  uuid      String   @unique @default(uuid(7)) @db.Uuid
  companyId Int
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  page      PageSite
  cle       String   @db.VarChar(64)
  donnees   Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([companyId, page, cle])
  @@index([companyId, updatedAt])                          // activité « contenu modifié » du dashboard
}

model ReglagesRestaurant {                                 // NOUVEAU (Q-08, DEC-27)
  id                     Int      @id @default(autoincrement())
  uuid                   String   @unique @default(uuid(7)) @db.Uuid
  companyId              Int      @unique
  company                Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  nom                    String                            // « Les Ambassades d'Afrique »
  adresse                String?
  quartier               String?                           // « Plateau Mont-Royal »
  joursOuverture         Int[]                             // ISO 1=lundi … 7=dimanche
  heureOuverture         String                            // "HH:mm" (zod)
  heureFermeture         String
  dernierService         String
  pasCreneauMinutes      Int      @default(30)
  capaciteMaxReservation Int      @default(20)
  delaiMinimumHeures     Int      @default(2)
  horizonJours           Int      @default(90)
  updatedAt              DateTime @updatedAt
}

model MessageContact {
  // - lu
  statut      StatutMessage @default(NOUVEAU)              // DEC-11
  entreprise  String?                                      // DEC-12
  details     Json?                                        // DEC-12, zod par filiale (phase 3)
  paysOrigine String?                                      // DEC-13
  updatedAt   DateTime      @updatedAt
  @@index([companyId, statut])
  @@index([companyId, type, createdAt])
}

model ReservationRestaurant {
  updatedAt DateTime @updatedAt                            // DEC-27
  @@index([companyId, statut])
}

model Employe {
  userId Int?  @unique                                     // DEC-29
  user   User? @relation(fields: [userId], references: [id], onDelete: SetNull)
  // actif Boolean conservé (DEC-30)
}

model PlanningEntry {
  titre String?                                            // ~ devient optionnel (DEC-28)
  lieu  String                                             // +
}

model Client {
  @@unique([companyId, email])                             // DEC-31 (plusieurs NULL tolérés par Postgres)
}

model DossierComptable {
  forfait ForfaitComptable?                                // DEC-26
  statut  StatutDossier @default(A_JOUR)
}

model Candidat {
  categorie     CategoriePoste                             // DEC-23
  disponibilite String?
  statut        StatutCandidat  @default(DISPONIBLE)
  origine       OrigineCandidat
  cv            Fichier? @relation(fields: [cvKey], references: [key], onDelete: SetNull)
  candidatures  Candidature[]
  affectations  Affectation[]
  @@unique([companyId, email])                             // dédoublonnage « Ajouter au vivier » → 409
  @@index([companyId, statut])
}

model DemandeClient {
  categorie                CategoriePoste                  // typage de la liste « poste » (rapprochement candidats)
  posteAutrePrecision      String?
  recrutementInternational Boolean       @default(false)   // option « PTET » du formulaire employeur
  contactNom               String                          // DEC-17
  contactEmail             String
  contactTelephone         String?
  nombrePostes             Int           @default(1)
  dateDebut                DateTime?     @db.Date
  statut                   StatutDemande @default(OUVERTE)
  titreOffre               String?                         // DEC-16 : champs publics, exigés par zod pour publier
  lieu                     String?
  typeContrat              TypeContrat?
  salaire                  String?
  descriptionPublique      String?       @db.Text
  publieeLe                DateTime?
  affectations             Affectation[]
  @@index([companyId, publiee, statut])                    // remplace [companyId, publiee]
}

model Candidature {
  categorie      CategoriePoste                            // DEC-19
  experience     NiveauExperience?                         // DEC-18
  pays           String
  message        String?  @db.Text
  consentementLe DateTime                                  // Loi 25
  candidatId     Int?                                      // traçabilité « Ajouter au vivier »
  candidat       Candidat? @relation(fields: [candidatId], references: [id], onDelete: SetNull)
  cv             Fichier   @relation(fields: [cvKey], references: [key], onDelete: Restrict)
  updatedAt      DateTime  @updatedAt
}

model Affectation {                                        // NOUVEAU (DEC-24)
  id              Int           @id @default(autoincrement())
  uuid            String        @unique @default(uuid(7)) @db.Uuid
  companyId       Int                                      // dénormalisé, fixé côté serveur depuis la demande (scoping uniforme)
  company         Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  candidatId      Int
  candidat        Candidat      @relation(fields: [candidatId], references: [id], onDelete: Cascade)
  demandeId       Int
  demande         DemandeClient @relation(fields: [demandeId], references: [id], onDelete: Cascade)
  dateAffectation DateTime      @default(now())
  @@unique([candidatId, demandeId])
  @@index([companyId])
  @@index([demandeId])
}
```

Justifications courtes :
- **FK vers `Fichier.key`** : intégrité (aucune clé pendante), requête d'orphelins triviale, et `SetNull` quand une image est supprimée. `Candidature.cvKey` est en `Restrict` : un CV ne peut pas disparaître sous une candidature ; l'effacement Loi 25 passe par la suppression de la candidature. Les tableaux (`autresDocumentsKeys`, `documentsKeys`) restent sans FK, ce que Postgres ne permet de toute façon pas.
- **`categorie` sur Demande, Candidature et Candidat** : c'est la forme typée de la liste « poste » (DEC-17 : « dérivée du poste »), nécessaire au rapprochement demande ↔ candidats.
- `Affectation.companyId` : l'`Affectation` est scopée par `companyScope()` comme toutes les autres tables.

### 1.4 Catalogue des sections (`shared/content/sections/`)

**Types** (`types.ts`) : chacun expose `{ schema: z.ZodType, fields: CmsField[] }`.

| Type | Données (bornes zod) |
|---|---|
| `seo` | `title` (10–70), `description` (50–160) |
| `texte` | `texte` (≤ 600) |
| `section` | `surtitre?` (≤ 80), `titre` (≤ 160, accentuable), `texte?` (≤ 1200) |
| `hero` | `surtitre`, `titre`, `texte`, `ctaLibelle?` (≤ 40), `imageKey?`, `imageAlt?` (≤ 160), `legende?{surtitre, titre}`, `badgeLibelle?` |
| `cta` | `titre`, `texte?`, `ctaLibelle` |
| `chiffres` | `surtitre?`, `titre?`, `texte?`, `items[1..6]` en union discriminée :<br>`{type:'libre', valeur ≤ 12, libelle}`<br>`{type:'effectif', libelle, arrondi: boolean}`<br>`{type:'filiales', libelle}` |
| `histoire` | `surtitre`, `titre`, `paragraphes[1..4]` (≤ 1200 chacun) |
| `formulaire` | `surtitre?`, `titre`, `texte?`, `messageSucces` (≤ 200) |
| `duo` | `a` et `b`, chacun `{surtitre?, titre, texte?, lienLibelle, imageKey?, imageAlt?}` |
| `galerie` | `surtitre?`, `titre`, `items[1..12]{titre, sousTitre?, imageKey?, imageAlt?}` |
| `assistant` | `surtitre`, `titre`, `recommandations{petit, moyen, grand}` (≤ 600), `mentionDelai` |
| `legal` | `titre`, `miseAJour` (YYYY-MM-DD), `introduction?`, `sections[1..40]{titre, paragraphes[] (≤ 4000)}` |

Conventions de texte, gérées par `shared/utils/texte.ts` et testées :
- `*accent*` → segment accentué (italique, poids moyen), rendu **sans `v-html`**.
- `\n` → retour à la ligne.
- Variables `{groupe}`, `{nomCourt}`, `{nom}` (liste blanche ; une variable inconnue reste telle quelle).

Si le nom du groupe change (Q-02), tous les textes suivent.

**Catalogue** (`catalog.ts`, objet `as const satisfies` ; portée par entrée : `'holding' | 'filiales' | SiteSlug[]`).

| Page | Clés et portée |
|---|---|
| COMMUN | `piedDePage:texte` (tous) · `maintenance:section` (tous) · `mentionAlcool:texte` (boissons) |
| ACCUEIL | holding : `seo`, `hero`, `filiales:section`, `chiffres`, `cta`<br>entretien, transport, comptable, boissons : `seo`, `hero`, `services:section`, `realisations:section`, `cta`<br>placement : `seo`, `hero`, `audiences:duo`, `services:section`, `realisations:section`<br>ccdpaa : `seo`, `hero`, `metiers:duo`, `services:section`, `realisations:section` |
| SERVICES | filiales : `seo`, `entete:section`, `cta` · ccdpaa : + `assistant` |
| REALISATIONS | tous (holding compris, DEC-39) : `seo`, `entete:section` |
| A_PROPOS | holding : `seo`, `histoire`, `reperes:chiffres`, `equipe:section`, `partenaires:section`<br>filiales : `seo`, `histoire`, `equipe:section`, `partenaires:section` |
| CONTACT | tous : `seo`, `contact:formulaire` · ccdpaa, boissons : + `suggestion:formulaire` (titre par défaut « Vous ne trouvez pas ce que vous cherchez ? », Q-11) |
| RESTAURANT | ccdpaa : `seo`, `hero`, `menu:galerie`, `reservation:formulaire` |
| OFFRES | placement : `seo`, `entete:section` |
| CONFIDENTIALITE | holding : `seo`, `politique:legal` (Q-01) |
| MENTIONS_LEGALES | boissons : `seo`, `mentions:legal` (Q-07) |

Côté public, les chiffres `effectif` et `filiales` sont **résolus côté serveur** (`resolveChiffres`) en `{valeur, libelle}` :
- l'effectif vaut la somme de `Company.effectif`, arrondie à la dizaine inférieure suivie de « + » si `arrondi` ;
- un seul chiffre est donc affiché sur `/` et sur `/a-propos` (Q-03).

---

## 2. Stratégie de migration

1. Modifier `prisma/schema.prisma` (§1).
2. Réinitialiser la base : `pnpm prisma migrate reset --force`. C'est autorisé, la base ne contient que des données de démo. De nouvelles colonnes obligatoires sans défaut exigent des tables vides.
3. Créer la migration sans l'appliquer : `pnpm prisma migrate dev --name phase2_foundations --create-only`. Relire le SQL : `DROP COLUMN "lu"`, `SET DATA TYPE DATE`, créations d'enums, FK vers `Fichier(key)`, index uniques.
4. Appliquer : `pnpm prisma migrate dev` (régénère aussi `server/generated/prisma`).
5. Semer : `pnpm db:seed`, lancé **explicitement** (ne pas compter sur un seed automatique avec Prisma 7).
6. La migration `init` reste intacte ; on ne réécrit pas l'historique.

**`prisma/seed.ts`** devient un point d'entrée qui orchestre `prisma/seed/*.ts` :

| Module | Rôle | Toujours / démo |
|---|---|---|
| `companies.ts` | upsert par slug, `update: {}` (inchangé). `secteur` aligné sur PROJECT_CONTEXT §2 (comptable : « …création et régularisation d'entreprise » ; ccdpaa : « …+ restaurant ») | toujours |
| `accounts.ts` | SUPER_ADMIN toujours ; ADMIN_FILIALE entretien, ADMIN_FILIALE ccdpaa et EMPLOYE (lié à `Employe` Awa Diallo, DEC-29) seulement si `SEED_DEMO_DATA=true`. Mots de passe lus dans `.env` | mixte |
| `fichiers.ts` | `seedImage(photoId, companyId)` : unstorage `fsDriver({ base: NUXT_UPLOADS_DIR })` (même driver que `server/plugins/storage.ts`), clé = `randomUUID()+ext`, sniff via `server/lib/file-types.ts`, ligne `Fichier` PUBLIC | outil |
| `contenu.ts` | Company : remplit **si null** `description`, `nomCourt`, `heroImageKey`, `effectif`, `ordre`, `adresse`. Collections : **amorçage si `count(companyId)=0`**. Ne touche jamais `nom`, `secteur`, `couleurAccent` | toujours |
| `sections.ts` | pour chaque entrée du catalogue × site concerné, crée la ligne si absente, avec les valeurs par défaut de `prisma/seed-data/sections.ts`, **validées par le schéma du type** (le seed échoue bruyamment sinon) | toujours |
| `reglages.ts` | `ReglagesRestaurant` ccdpaa créé si absent : [2..7], 11:30, 22:00, dernier service 21:30, pas de 30 min, 20 personnes, 2 h, 90 j | toujours |
| `demo.ts` | données opérationnelles (voir §3.4), amorçage par entité | `SEED_DEMO_DATA=true` seulement |

**Contrainte** : tout fichier de `shared/` importé par le seed (catalogue, sites, validation) utilise des **imports relatifs** et importe zod explicitement. tsx ne résout ni `#shared` ni les auto-imports Nuxt.

---

## 3. `scripts/migrate-mockdata-to-seed.ts` (générateur ponctuel, supprimable)

### 3.1 Exécution
- Commande : `pnpm tsx scripts/migrate-mockdata-to-seed.ts [--dry-run] [--skip-images]`.
- **Import direct**, pas de parseur : `mockdata.ts` n'a aucun import. `subConfig.ts` n'a qu'un `import type` depuis `@/data/mockdata`, que esbuild (tsx) supprime ; l'alias `@/` n'est donc jamais résolu. Aucune dépendance du prototype n'est chargée.
- Les **routes et composants JSX ne sont jamais importés** : ils tireraient react, framer-motion et tanstack, absents du projet.
- Garde-fou : les tableaux importés sont validés par des schémas zod locaux au script. Si la forme diverge, le script échoue avec la collection en cause.
- Hors du périmètre de `nuxt typecheck` (qui n'inclut pas `scripts/`) : TypeScript strict à la main, zéro `any`.

### 3.2 Sorties (versionnées, relues dans le diff)
- **`prisma/seed-data/prototype.generated.ts`** : en-tête « GÉNÉRÉ, ne pas éditer ». Données typées (`as const satisfies`, types dans `prisma/seed-data/types.ts`), ordre stable. Relancer le script ne produit **aucun diff** : c'est l'idempotence du générateur. Contenu :

  | Collection | Champs conservés | Notes |
  |---|---|---|
  | `companies` | slug, description, `secteurPrototype` (informatif, jamais semé), `heroImageId`, `effectif` (← `employesCount`) | |
  | `services` | par slug, ordre du tableau (pas l'id) | |
  | `realisations` | `date` en chaîne YYYY-MM-DD, `imageId` | |
  | `equipe` | nom, poste, bio | **aucune photo** |
  | `partenaires` | nom, typeRelation | **aucun logo** |
  | `subConfig` | textes seulement : shortName, tagline, headline*, heroPitch, ctaLabel, contactIntro, contactHeadline, contactBaseline, successMsg | `fields` exclu (structure de formulaire, reste dans le code) ; `email`/`phone` fictifs exclus |
  | `demo` | messages, suggestions, reservations, employes, planningEntries, clients, clientsComptables, candidats, demandesClients, offresEmploi, candidatures | |
  | `IMAGES` | `[{ id, file, sourceUrl, sha256, octets }]` | |

- **`prisma/seed-assets/images/<photo-id>.jpg`**.
  - Sources : `companies.imagePlaceholder`, `realisations.imagePlaceholder`, `SUB_CONFIG.heroImage` (dédoublonnées), plus la constante `EXTRA_IMAGE_SOURCES` du script, qui porte les URL du JSX avec leur référence : holding `Hero.tsx:93`, ccdpaa `ccdpaa.index.tsx:30,41`, restaurant `ccdpaa.restaurant.tsx:38-41,74`.
  - Règles de téléchargement :
    - `new URL()` avec l'hôte strictement égal à `images.unsplash.com` ; une assertion garantit qu'**aucune URL pravatar ou dicebear** ne passe ;
    - paramètres normalisés `fm=jpg&fit=crop&w=1600&q=75`, sans `auto=format` qui renverrait de l'AVIF ;
    - timeout de 60 s, 3 tentatives ;
    - octets magiques JPEG vérifiés, taille ≤ `MAX_UPLOAD_BYTES` ;
    - si le fichier existe déjà avec le même sha256, il est sauté.

### 3.3 Correspondance vers la base (appliquée par `prisma/seed/contenu.ts`, pas par le script)

| Source | Cible | Règles |
|---|---|---|
| `companies[]` | `Company` (par slug) | remplir si null : `description`, `nomCourt` (← `SUB_CONFIG.shortName`), `heroImageKey` (image uploadée, Fichier PUBLIC de la filiale), `effectif`, `ordre` = index+1 (holding : 0), `adresse` = « Montréal, Québec, Canada ». `email` et `telephone` restent null (valeurs fictives non migrées) |
| `services[]` | `Service` | `ordre` = index dans la filiale. **Corrections** : entretien « supermarchés » placé à `ordre 0`. `misEnAvant` par défaut sur les 3 premiers de chaque filiale, **sauf ccdpaa**, où le restaurant n'est pas mis en avant (remplace le filtre `id !== 20`) |
| `realisations[]` | `Realisation` | holding incluse (DEC-39). `dateRealisation` = `new Date('YYYY-MM-DDT00:00:00Z')`, image uploadée |
| `equipe[]` | `MembreEquipe` | `bio` repris, `photoKey` null (repli initiales) |
| `partenaires[]` | `Partenaire` | `typeRelation` repris, `logoKey` null, `siteUrl` null |
| `subConfig` et textes JSX | `SectionContenu` via `prisma/seed-data/sections.ts` | écrit à la main, relu, chaque valeur annotée `// source: <fichier>:<ligne>` ; les images référencées par `ctx.image('<photo-id>')`, résolues au seed |

Corrections de contenu, rédigées dans `sections.ts` (PROJECT_CONTEXT fait foi) :
- **Entretien** : supermarchés ajoutés au pitch et aux meta.
- **Comptable** : pitch et meta alignés sur §2 et sur les services (tenue de livres et paie, états financiers, T1/T2, création et régularisation).
- **Formulaires** : `messageSucces` sans promesse de délai non tenue, mais avec la mention « Un courriel de confirmation vous est envoyé » (Q-10).
- **Suggestion** : libellé Q-11.
- **`CONFIDENTIALITE.politique`** : brouillon Loi 25 (responsable, finalités, conservation, droits, contact).
- **`MENTIONS_LEGALES.mentions`** et **`COMMUN.mentionAlcool`** : brouillon RACJ/Éduc'alcool.
- **`piedDePage`** des filiales : « Une filiale du {groupe}… ».

### 3.4 Données de démo (`prisma/seed/demo.ts`, seulement avec `SEED_DEMO_DATA=true`)

| Source | Cible | Règles |
|---|---|---|
| messages | `MessageContact` | `nouveau|en_cours|traite` → enum |
| suggestions | `MessageContact` | type SUGGESTION_PRODUIT ; `produit` → `produitSouhaite`, `origine` → `paysOrigine`, `commentaire` → `message` |
| réservations | `ReservationRestaurant` (ccdpaa) | dates recalées sur J+7, J+9, J+15 ; date et heure combinées en America/Montreal puis stockées en UTC |
| employés | `Employe` | `actif` = statut ≠ `inactif` |
| planning | `PlanningEntry` | `jour` → date de la semaine ISO courante (Montréal), fin < début → lendemain |
| clients et clientsComptables | `Client` + `DossierComptable` | dédoublonnage par e-mail et par filiale (Atelier EG) |
| candidats | `Candidat` | mapping des enums |
| demandes + offresEmploi | `DemandeClient` | les 4 offres deviennent des demandes publiées avec `entrepriseCliente` « Mandat interne — {titre} », jamais exposée |
| candidatures | `Candidature` | CV = PDF minimal factice (Fichier PRIVE placement) ; adresse « Adresse de démonstration » ; `consentementLe` = date ; `entrevue` → EN_REVISION |

Les fonctions de correspondance (statuts, dates) sont pures, exportées et testées unitairement.

---

## 4. Fondations

### 4.1 Configuration partagée (`shared/config/`)
- **`sites.ts`** :
  - `HOLDING_SLUG`, `FILIALE_SLUGS`, `SITE_SLUGS` (as const), types `FilialeSlug` et `SiteSlug`, `siteSlugSchema`, `isFilialeSlug()` ;
  - `SITE_EXTRA_PAGES = { ccdpaa: ['restaurant'], placement: ['offres'] }` ;
  - `publicNav(slug): readonly NavItem[]` avec `NavItem = { label, to, hash? }` (libellés d'interface, donc en code) :
    - holding : Nos filiales (`/#filiales`), Réalisations, À propos, Contact ;
    - filiale : Accueil, Services, [Restaurant | Offres], Réalisations, À propos, Contact.
  - `nuxt.config.ts` importe `FILIALE_SLUGS` par chemin relatif, ce qui supprime `publicSections`.
- **`modules.ts`** :
  - `MODULES = { PLANNING, COMPTABLE, PLACEMENT, RESERVATIONS }` ;
  - `SITE_MODULES` : entretien → [planning], transport → [planning], comptable → [comptable], placement → [placement], ccdpaa → [planning, reservations], boissons et holding → [] ;
  - `siteHasModule(slug, m)`.
- **`cms.ts`** : `MAX_SERVICES_MIS_EN_AVANT = 3`, `MAX_REORDER_ITEMS = 200`, bornes de longueur.
- **`upload.ts`** : + `STORAGE_KEY_PATTERN` (déplacé depuis `storage.ts`) et `PUBLIC_IMAGE_MIMES`.

### 4.2 Contrats API

Règles communes à toutes les routes :
- `requireRole` **en premier** ;
- zod sur la query, le body et les params (`[uuid]` → `z.string().uuid()`) ;
- `select` explicite avec `uuid`, jamais d'`id` ni de FK ;
- `statusMessage` générique.

Rôles CMS : SUPER_ADMIN et ADMIN_FILIALE (forcé sur sa filiale). EMPLOYE reçoit 403.

**Admin CMS, collections** (`{res}` ∈ services | realisations | equipe | partenaires ; services interdit sur la holding)

| Méthode et chemin | Entrée | Succès | Erreurs |
|---|---|---|---|
| GET `/api/admin/contenu/{res}?site=` | `site?` (SiteSlug) | 200 `Dto[]` trié par site puis ordre | 401, 403 (site hors périmètre) |
| POST `/api/admin/contenu/{res}` | `{site?, …champs}` | 201 `Dto` (`ordre` = max+1) | 400, 403, 409 (`misEnAvant` > 3) |
| PATCH `/api/admin/contenu/{res}/[uuid]` | champs partiels (au moins 1) | 200 `Dto` | 400, 404 (inexistant ou autre filiale), 409 |
| DELETE `/api/admin/contenu/{res}/[uuid]` | | 204 | 404 |
| PATCH `/api/admin/contenu/{res}/ordre` | `{site?, uuids[]}` = **ensemble exact** du site | 204 (transaction) | 400 (ensemble incomplet ou doublon) |

Chaque mutation vérifie les images (`assertPublicImages(keys, companyId)` : Fichier existant, PUBLIC, MIME image, **même filiale**) puis appelle `invalidatePublicPages()`.

Formes des DTO :
- **Service** : `{uuid, titre, description, imageKey, misEnAvant, ordre, updatedAt, site:{uuid, slug, nom}}` ;
- **Realisation** : + `dateRealisation: 'YYYY-MM-DD' | null` ;
- **MembreEquipe** : `{uuid, nom, poste, bio, photoKey, ordre, …}` ;
- **Partenaire** : `{uuid, nom, typeRelation, siteUrl, logoKey, ordre, …}`.

Validation (`shared/validation/cms.ts`, objets `.strict()`) :
- titre ou nom : 2–160 ;
- description : 10–2000 ;
- bio : ≤ 600 ;
- `siteUrl` : https uniquement ;
- `imageKey` : `STORAGE_KEY_PATTERN` ou null ;
- date : YYYY-MM-DD.

**Admin sections**

| Méthode et chemin | Entrée | Succès | Erreurs |
|---|---|---|---|
| GET `/api/admin/contenu/sections?site=` | `site` (obligatoire pour SUPER_ADMIN) | 200 `[{uuid, page, cle, donnees, updatedAt}]` (entrées du catalogue du site seulement) | 400, 403 |
| PATCH `/api/admin/contenu/sections/[uuid]` | `{donnees}` validé par le schéma du **type de la ligne** | 200 | 400, 404 |

Pas de POST ni de DELETE : le catalogue est défini par le code.

**Admin sites (réglages)**

| Méthode et chemin | Rôles | Succès | Notes |
|---|---|---|---|
| GET `/api/admin/sites` | SA, AF | 200 `[{uuid, slug, nom, nomCourt, type, couleurAccent, statutSite, modules}]` scopé | Alimente les sélecteurs de site |
| GET `/api/admin/sites/[uuid]` | SA, AF (le sien) | 200 réglages complets | 404 hors périmètre |
| PATCH `/api/admin/sites/[uuid]` | SA : `siteReglagesSuperAdminSchema` (+ `nom`, `ordre`, `statutSite`) ; AF : `siteReglagesFilialeSchema.strict()` (400 si un champ réservé est envoyé) | 200 | `couleurAccent` jamais modifiable ; invalidation ISR |

UI des réglages : phase 3 (`/admin/filiales`, `/admin/parametres`). L'API est livrée maintenant parce que le test e2e de maintenance en dépend.

**Public (lecture)** : pas de session. Slug inconnu → 404.

| Chemin | Réponse |
|---|---|
| GET `/api/public/sites` | `PublicSiteSummary[]` des filiales triées par `ordre` : `{uuid, slug, nom, secteur, description, couleurAccent, heroImageKey, statutSite}` |
| GET `/api/public/sites/[slug]` | `PublicSite` : identité, coordonnées, `reseaux`, `statutSite`, `groupe:{nom}`, `commun:{piedDePage, maintenance, mentionAlcool?}`. `couleurAccent` revalidée `^#[0-9A-F]{6}$`, repli navy (protection contre une injection CSS dans l'attribut `style`) |
| GET `…/[slug]/services?misEnAvant=true` | mis en avant triés par ordre ; si aucun, repli sur les 3 premiers |
| GET `…/[slug]/realisations?limit=1..50` | `{uuid, titre, description, imageKey, dateRealisation}` |
| GET `…/[slug]/equipe` · `…/partenaires` | DTO publics sans `ordre` ni dates |
| GET `…/[slug]/sections?page=PageSite` | `Record<cle, donnees>` : entrées du catalogue du site seulement, re-validées à la lecture (ligne invalide omise, `consola.warn({slug, page, cle})`), chiffres résolus |

**Côté serveur**

| Fichier | Rôle |
|---|---|
| `server/policies/site-access.ts` (pur) | `decideReadScope({role, sessionCompanyId, requestedCompanyId})` → `all | company | forbidden` ; `decideWriteCompany(...)` → `company | forbidden | missing` |
| `server/utils/site-scope.ts` | `resolveReadScope(ctx, site?)`, `resolveWriteCompany(ctx, site?)` ; `requireModule(event, module, { site?, roles? })` → `AuthContext & { company:{id, slug} }`. Enchaîne `requireRole`, la résolution de la filiale (AF : la sienne par `secure.companyId` ; SA : `site` obligatoire) et `siteHasModule`, sinon 403 |
| `server/utils/cms-collection.ts` | **factory tranchée** `defineCmsCollectionHandlers(service, { allowHolding })` → `{ list, create, update, remove, reorder }` |
| `server/services/cms/*.ts` et `server/services/public/*.ts` | accès Prisma et `select` explicite |
| `server/utils/isr.ts` | `invalidatePublicPages()` : `useStorage().getKeys('cache:nitro:routes')` puis `removeItem` sur chaque clé. La logique est dans `purgeRouteCache(storage)` pur, testé sur unstorage mémoire. Un échec est journalisé (`consola.warn`) et ne fait jamais échouer l'écriture |
| `server/utils/public-images.ts` | `assertPublicImages(keys, companyId)` ; `collectImageKeys(type, donnees)` parcourt les descripteurs de champs du catalogue |

Pourquoi la factory `defineCmsCollectionHandlers` :
- Le service fournit des closures typées : `list(where)`, `findOwner(uuid)`, `create(companyId, data, ordre)`, `update(id, data)`, `remove(id)`, `maxOrdre`, `reorder`, `beforeWrite?`, plus `createSchema` et `updateSchema`.
- Chaque fichier de route tient en une ligne : `export default servicesCms.list`. Le routage Nitro reste explicite et lisible par grep.
- Le flux de sécurité (rôle → zod → portée → images → service → invalidation) existe **en un seul endroit à relire**.
- Des closures plutôt que des délégués Prisma : zéro `any`, parce que les délégués Prisma ne sont pas structurellement compatibles entre eux.
- La route dynamique `[ressource]` est rejetée : elle aurait exigé un cast du délégué.

**Stratégie ISR**
- Pages publiques : `isr: 3600` conservé comme filet de sécurité.
- Invalidation **explicite** à chaque écriture de contenu public ou de réglage de site : purge totale de `cache:nitro:routes` (≈ 45 pages régénérées à la demande).
- Ajouts dans `routeRules` : `/realisations` et `/confidentialite` en ISR ; `/fonts/**` avec `cache-control: public, max-age=31536000, immutable`.
- Les endpoints `/api/public/**` ne sont pas mis en cache : lecture directe en navigation client, trafic faible.
- Limite : cache en mémoire par processus. Mode fork PM2 à 1 processus (déjà supposé par `rate-limit.ts`) ; en cluster, cache partagé à prévoir.

### 4.3 Layout public unique et maintenance (DEC-09)
- **`app/app.vue`** : `<NuxtLayout><NuxtPage/></NuxtLayout>`. **`app/layouts/default.vue`** = layout public. Les pages admin déclarent `definePageMeta({ layout: false })` (ajout sur `admin/index.vue` et `admin/login.vue`).
- **`useCurrentSiteSlug()`** : premier segment ∈ `FILIALE_SLUGS`, sinon `'holding'`.
- **`useSite(slug)`** : `useFetch('/api/public/sites/'+slug, { key: 'site:'+slug })`, partagé par le layout et les pages. `useSites()` sert le pied de page holding.
- **Injection de l'accent** : `<div :style="{ '--site-accent': site.couleurAccent }" data-site="slug">`, avec les tokens Tailwind `--color-site-accent: var(--site-accent)` et `--color-site-accent-strong: color-mix(in oklab, var(--site-accent) 72%, black)`, ce dernier pour le petit texte sur fond clair.
- **Maintenance** : si `statutSite !== 'ACTIF'` et que `route.meta.bypassMaintenance` n'est pas posé (`/confidentialite` le pose) :
  - le layout rend `SiteMaintenance` au lieu du slot, donc la page n'est pas instanciée et ne fait aucun fetch ;
  - côté serveur : `setResponseStatus(useRequestEvent(), 503)` et `Retry-After: 3600` ;
  - `useSeoMeta({ robots: 'noindex' })` ;
  - le header est rendu sans navigation ; le pied de page garde les coordonnées.
- **Composants** (`app/components/site/`), tous en `<script setup lang="ts">` avec props génériques :

| Composant | Props / comportement |
|---|---|
| `SiteHeader` | `{ site: PublicSite; nav: readonly NavItem[]; groupe: string; variant: 'holding' | 'filiale'; showNav: boolean }`. Logo holding : nom du groupe, dernier mot en or. Filiale : lien « ← {groupe} » plus `nomCourt`. CTA « Nous joindre » en `bg-site-accent`. `useWindowScroll`, seuil `HEADER_SCROLL_THRESHOLD_PX = 12`. Menu mobile en `<Transition>` avec `aria-expanded`, `aria-controls`, fermeture sur Esc et au changement de route |
| `SiteFooter` | `{ site; groupe: string; filiales?: PublicSiteSummary[]; }`. Textes depuis `site.commun`. Coordonnées et réseaux masqués si null. Lien « Politique de confidentialité » → `/confidentialite`. « Conditions » masqué (aucun contenu) |
| `SiteMaintenance` | `{ site; section: SectionData | null }` |
| `TexteAccentue` | `{ texte: string; vars: TexteVars; as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' }` |
| `SiteImage` | `{ fileKey: string | null; alt: string; fallback: 'initiales' | 'aplat'; initiales?: string }`. Repli sans dégradé |
| `SectionHeading` | `{ section: SectionData; tone: 'clair' | 'sombre'; vars }` |

- **Mouvement** : `app/composables/useReveal.ts`, presets `@vueuse/motion` (fondu vers le haut, `visibleOnce`), désactivés si `usePreferredReducedMotion() === 'reduce'`.
- **Pages livrées** en phase 2 : `app/pages/a-propos.vue` (holding) et `app/pages/[filiale]/a-propos.vue`, avec `definePageMeta({ validate: r => isFilialeSlug(r.params.filiale) })`.
  - La structure suit le prototype : `a-propos.tsx` pour la holding (repères en aparté, figures 4/5 en quinconce) et `SubAboutPage` pour les filiales (monogramme en aplat d'accent **sans le `radial-gradient`**, lignes équipe, liste partenaires).
  - SEO via la section `seo`.

### 4.4 Socle visuel (§6)

**`app/assets/css/main.css`**
- Garder `@custom-variant dark (&:is(.dark *))`, pour que les classes `dark:` de shadcn ne suivent pas le mode de l'OS.
- **Supprimer le bloc `.dark`** et les tokens oklch neutres.

Tokens de marque :
- `--navy: #1B2A4A` · `--gold: #C9A227` · `--gold-deep: #7A5F0E` (petit texte sur crème, ≈ 5:1) · `--cream: #F5F3EE` · `--ink: #2C2C2A` ;
- `--site-accent: var(--navy)` (valeur par défaut, surchargée par le layout).

Correspondance avec shadcn :

| Token shadcn | Valeur |
|---|---|
| `--background` | crème |
| `--foreground` | ink |
| `--card`, `--popover` | `#FFFFFF` |
| `--primary` / `--primary-foreground` | navy / crème |
| `--secondary`, `--muted` | `#ECE8DF` |
| `--muted-foreground` | `#5F5E5A` |
| `--accent` (survol shadcn, **ce n'est pas l'accent de marque**) | `#E6E1D6` |
| `--destructive` | `#B42318` |
| `--border`, `--input` | `#DDD8CC` |
| `--ring` | navy (l'or est sous 3:1) |
| `--radius` | `0.75rem` |
| `sidebar*` | navy et crème, à titre provisoire (décision ouverte n°1) |

Dans `@theme inline` :
- `--color-navy`, `--color-gold`, `--color-gold-deep`, `--color-cream`, `--color-ink`, `--color-site-accent`, `--color-site-accent-strong` ;
- `--font-display: "Poppins", ui-sans-serif, system-ui, sans-serif` ;
- `--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif`.

**Polices auto-hébergées sans nouvelle dépendance**
- Télécharger une seule fois les woff2 fontsource via jsDelivr (`cdn.jsdelivr.net/fontsource/fonts/poppins@<ver>/latin-700-normal.woff2`, etc.) dans `public/fonts/`, avec la version dans le nom de fichier, plus `OFL.txt`.
- Fichiers : Poppins 500 normal et italique, 600, 700 ; Inter variable (`wght`) ; chacun en sous-ensembles **latin et latin-ext** (« œ » dans « main-d'œuvre »).
- `app/assets/css/fonts.css` : `@font-face` avec `font-display: swap` et les `unicode-range` repris du CSS fontsource.
- `nuxt.config.ts` `app.head.link` : deux `preload` (Poppins 700 latin, Inter latin), `crossorigin`.
- CSP : `font-src 'self'` suffit (défaut de nuxt-security).

### 4.5 CMS générique (admin)

Nouveaux composants shadcn à copier depuis le registre `new-york-v4` (le CLI est en échec réseau) : `select`, `textarea`, `switch`, `skeleton`. Aucune dépendance npm : reka-ui est déjà présent.

**`app/components/cms/`**

| Composant | Rôle |
|---|---|
| `CmsCollectionEditor.vue` | `generic="TItem extends CmsItemBase, TForm extends Record<string, unknown>"` ; props `{ config: CmsResourceConfig<TItem, TForm> }`. Pas d'emits : le composant est autonome et consomme `useAdminResource`. Contenu : en-tête, sélecteur de site (SUPER_ADMIN avec plusieurs sites, filtré par `allowHolding`), liste groupée par site (texte principal, texte secondaire en `line-clamp-2`, miniature `SiteImage`), boutons ↑/↓ (réordonnancement), interrupteur `misEnAvant` (services), « Ajouter », `CmsFormDialog`, `CmsDeleteDialog`, toasts (« Fiche ajoutée. », « Fiche mise à jour. », « Fiche supprimée. », repris du prototype). États : squelette, vide avec action, erreur avec « Réessayer » |
| `CmsFormDialog.vue` | props `{ open; titre; fields: readonly CmsField[]; schema: ZodType; initialValues; siteUuid: string; submitting }` ; emits `update:open`, `submit(values)`. VeeValidate `toTypedSchema`, erreurs **sous le champ** (pas de toast pour une erreur de formulaire) |
| `CmsFieldInput.vue` | props `{ field: CmsField; name: string; siteUuid: string }`. Types de champ : `text | textarea | date | url | switch | select | image | paragraphes | liste` (un niveau d'imbrication : ajouter, retirer, déplacer). `paragraphes` convertit un textarea en `string[]`, séparés par une ligne vide |
| `CmsImageField.vue` | upload `POST /api/admin/files` (multipart `file`, `visibilite=PUBLIC`, `companyUuid=siteUuid`), `accept` png/jpeg/webp, contrôle ≤ 10 Mo côté client, aperçu, retrait |
| `CmsDeleteDialog.vue` | AlertDialog « Supprimer cette fiche ? » |
| `CmsSectionsEditor.vue` | props `{ siteSlug }`. Catalogue du site groupé par page, édition via `CmsFormDialog` avec `fields` et `schema` du type. Aide sur les variables `{groupe}`, `{nomCourt}` et la syntaxe `*accent*` |

Choix de découpage : les sections ne passent pas dans `CmsCollectionEditor`. Elles ne se créent pas, ne se suppriment pas, ne se réordonnent pas et ont un schéma polymorphe. Il aurait fallu quatre drapeaux ; les briques `CmsFormDialog`, `CmsFieldInput` et `CmsDeleteDialog` sont partagées à la place.

**Configuration** (`app/config/cms-resources.ts`, `CmsResourceConfig`) :
- `key`, `endpoint`, `libelles{…}`, `allowHolding`, `fields`, `createSchema`, `updateSchema` (depuis `#shared/validation/cms`) ;
- `toForm(item)`, `primary(item)`, `secondary(item)`, `imageKey(item)`, `reorderable`, `toggle?{field:'misEnAvant', label, max}`.

**Pages** :
- `app/pages/admin/contenu.vue` : parent avec onglets-liens Sections, Services, Réalisations, Équipe, Partenaires, `layout: false`, en-tête minimal (le shell attend la décision ouverte n°1) ;
- `contenu/index.vue` (sections, comme l'index du prototype), `services.vue`, `realisations.vue`, `equipe.vue`, `partenaires.vue` ;
- méta de page `roles: [SUPER_ADMIN, ADMIN_FILIALE]`, avec `app/middleware/admin.ts` étendu (rôle absent → `navigateTo(ADMIN_HOME_PATH)`) et l'augmentation `PageMeta` dans `app/types/page-meta.d.ts`.

### 4.6 `useAdminResource<T>` (`app/composables/useAdminResource.ts`)

```ts
interface UseAdminResourceOptions { endpoint: `/api/admin/${string}`; site?: MaybeRefOrGetter<SiteSlug | undefined> }
function useAdminResource<TItem extends { uuid: string }, TCreate, TUpdate = Partial<TCreate>>(o: UseAdminResourceOptions): {
  items: Readonly<Ref<readonly TItem[]>>; status: Readonly<Ref<'idle'|'pending'|'success'|'error'>>
  error: Readonly<Ref<AdminError | null>>; mutating: Readonly<Ref<boolean>>
  refresh(): Promise<void>
  create(p: TCreate): Promise<TItem>; update(uuid: string, p: TUpdate): Promise<TItem>
  remove(uuid: string): Promise<void>; reorder(uuids: readonly string[]): Promise<void>
}
```

- Chargement par `useFetch` (`server: false`, clé `endpoint+site`, rafraîchi quand `site` change). Mutations par `$fetch`, puis remplacement local de l'élément ou `refresh()`.
- uuid contrôlé côté client (`z.string().uuid()`) puis passé par `encodeURIComponent` avant de construire l'URL.
- Les erreurs sont normalisées par `app/utils/admin-error.ts` `toAdminError(e)` :
  - 4xx → `statusMessage` du serveur, générique et affichable ;
  - sinon « Une erreur est survenue. Réessayez. »
- Le composable **ne lance pas de toast**, pour rester testable ; le composant le fait.

### 4.7 Mailer (Q-10)

- **Dépendance** : `nodemailer` et `@types/nodemailer`. Node n'a pas de client SMTP ; une API HTTP d'un fournisseur n'est pas choisie tant que le fournisseur est inconnu.
- **`server/lib/mail/`** (pur, testable) :
  - `transports.ts` : `interface MailTransport { name: 'log' | 'smtp'; send(m: OutgoingMail): Promise<void> }`, `createLogTransport(logger)`, `createSmtpTransport(cfg)` (timeouts de 10 s) ;
  - `escape.ts` ;
  - `templates/*.ts` : `(vars) => { subject, text, html }`, interpolations échappées.
- Le transport `log` journalise **uniquement** `{ template, transport }` : ni destinataire, ni sujet, ni corps.
- **`server/utils/mailer.ts`** : `getMailTransport()` (singleton depuis `useRuntimeConfig().mail`) et `queueMail(event, mail: OutgoingMail)`.
  - `OutgoingMail = { template, to, replyTo?, subject, text, html }`, avec `to` et `replyTo` déjà validés par zod.
  - `event.waitUntil(...)` : ne bloque pas la réponse et **ne lève jamais d'erreur**.
  - En cas d'échec : `consola.error('[mail] échec', { template, code })`.
- **`server/plugins/mailer.ts`** valide la configuration par zod au démarrage.
  - Configuration invalide : un log d'erreur et repli sur `log`. Le site reste en ligne.
  - En production avec `log` : un avertissement unique.
- **Configuration** : `runtimeConfig.mail = { transport: 'log', from: '', smtp: { host: '', port: 587, secure: false, user: '', password: '' } }`, soit les variables `NUXT_MAIL_TRANSPORT`, `NUXT_MAIL_FROM`, `NUXT_MAIL_SMTP_{HOST,PORT,SECURE,USER,PASSWORD}`.
- **Phase 2** : infrastructure et gabarits `accuse-reception` et `notification-interne` (vers `Company.email` si renseigné, `replyTo` = demandeur). **Branchement formulaire par formulaire en phase 3.**

### 4.8 Tests

- **Unitaires** (`tests/unit/`, projet node) :
  - `sites-config`, `modules` ;
  - `texte` (interpolation, `*accent*`, `\n`, variable inconnue) ;
  - `dates` (`formatMoisAnnee` en UTC : « juin 2022 » et non « mai ») ;
  - `cms-validation` ;
  - `sections-catalog` : **chaque entrée × site concerné a une valeur par défaut dans `prisma/seed-data/sections.ts` qui passe son schéma** ;
  - `chiffres` (résolution et arrondi) ;
  - `site-access` (matrice rôle × filiale) ;
  - `isr` (`purgeRouteCache` sur unstorage mémoire) ;
  - `public-images` (`collectImageKeys`) ;
  - `mailer` (échappement, transport `log` sans destinataire, `queueMail` avalant l'échec) ;
  - `file-types` ;
  - `seed-mapping` (statuts, Montréal → UTC, jour → date).
- **Nuxt** (`tests/nuxt/`) : `use-admin-resource.nuxt.test.ts` avec `registerEndpoint` (succès, 4xx, 5xx, uuid invalide rejeté avant fetch).
- **Playwright** (`playwright.config.ts`, à créer) :

```ts
import 'dotenv/config'
export default defineConfig({
  testDir: 'tests/e2e', fullyParallel: false, workers: 1, // état DB partagé
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000', trace: 'retain-on-failure',
         launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined } },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } }, testMatch: /layout-.*\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'node --env-file=.env .output/server/index.mjs', url: 'http://localhost:3000/',
    reuseExistingServer: true, timeout: 120_000 },
})
```

Le serveur doit être buildé au préalable : `pnpm build && pnpm test:e2e`. On utilise `localhost`, pas `127.0.0.1`, à cause du cookie `Secure` en production.

- **Aides e2e** : `tests/e2e/helpers/auth.ts` (connexion par l'API, mots de passe depuis `.env`, `storageState`) et `tests/e2e/fixtures/accents.ts` (table §6 recopiée : le test ne lit ni le seed ni la base).
- **Premier test e2e réel**, `tests/e2e/layout-accent.spec.ts`, pour les 7 pages à-propos (`/a-propos`, `/{filiale}/a-propos`) :
  - `--site-accent` du wrapper égal à l'accent attendu ;
  - `getComputedStyle` du CTA « Nous joindre » = `rgb(...)` de l'accent ;
  - « Restaurant » présent **seulement** sur ccdpaa et « Offres » **seulement** sur placement ;
  - sur mobile, passage par le menu (`aria-expanded` bascule).

  Ce test sert de gabarit pour la phase 3.
- **Autres fichiers e2e** :
  - `api-cms-security.spec.ts` : 401 sans session ; EMPLOYE 403 ; AF `?site=holding` 403 ; PATCH d'un membre holding par AF 404 ; uuid malformé 400 ; corps invalide 400 ; `misEnAvant` n°4 409 ; image PRIVE ou d'une autre filiale 400 ;
  - `a-propos.spec.ts` (§4.9) ;
  - `maintenance.spec.ts`.
  - Chaque test **restaure** ce qu'il modifie en `afterAll`.

### 4.9 Vérification de bout en bout sur `/a-propos` (build de production)

1. `migrate reset`, puis migration, puis `SEED_DEMO_DATA=true pnpm db:seed`, puis `pnpm build`, puis démarrage du serveur.
2. GET `/a-propos` renvoie 200 avec :
   - histoire (titre accentué) ;
   - repères, dont l'effectif calculé ;
   - 3 membres (initiales, **aucune photo externe**) ;
   - 3 partenaires ;
   - aucune requête vers un hôte externe (CSP respectée, polices en `/fonts`).
3. SUPER_ADMIN, `/admin/contenu/equipe` : modifier la bio de « Claire Dubois ». Toast « Fiche mise à jour. », puis `/a-propos` affiche la nouvelle bio **immédiatement**, ce qui prouve l'invalidation ISR. Restaurer ensuite.
4. Téléverser une photo PNG de test sur ce membre : `/a-propos` rend `<img src="/api/files/<key>">`, qui répond 200 `image/png`.
5. `/admin/contenu` (Sections), `A_PROPOS.histoire` : modifier le titre avec `*accent*` ; il est rendu accentué et échappé.
6. Réordonner les partenaires (↓) : le nouvel ordre est visible sur `/a-propos`.
7. `PATCH /api/admin/sites/<uuid entretien> {statutSite:'EN_MAINTENANCE'}` : `/entretien/a-propos` renvoie 503, texte de maintenance, `noindex`, sans navigation. Restauration : 200.
8. `layout-accent.spec.ts` passe sur desktop et mobile.
9. `pnpm typecheck`, `pnpm test:unit` et `pnpm test:e2e` passent. Revue par un agent qui n'a pas écrit le code.

**Point 6 de PROMPT_CONVERSION** (T0) : vérifier que `server/plugins/error-handler.ts` et `server/error.ts` sont branchés, que toutes les routes `[uuid]` valident leur paramètre et qu'il n'y a aucun `select` sans `uuid`. Résultat à noter dans PROJECT_STATE.

---

## 5. Découpage en tâches

Tous les agents travaillent dans le même checkout. **Seul T0** touche `package.json`, le lockfile, `prisma/schema.prisma`, `nuxt.config.ts`, `.env.example`, et lance `prisma generate`. Pendant le travail en parallèle, chaque agent ne bloque que sur les erreurs de **ses** fichiers ; le typecheck global est exigé en T6.

| # | Agent | Taille | Dépend de | Périmètre de fichiers (disjoint) | Critère de fin |
|---|---|---|---|---|---|
| **T0** | backend | M | — | `prisma/schema.prisma`, `prisma/migrations/*_phase2_foundations/`, `package.json` (+nodemailer, @types/nodemailer), `nuxt.config.ts` (runtimeConfig.mail, routeRules, preload des polices, import de `FILIALE_SLUGS`), `.env.example` (`SEED_DEMO_DATA`, `NUXT_MAIL_*`, `E2E_BASE_URL`, `PW_CHROMIUM_PATH`), `shared/config/{sites,modules,cms,upload}.ts`, `shared/content/sections/**`, `shared/validation/{cms,sites}.ts`, `shared/types/{public,cms,admin}.ts`, `shared/utils/{texte,dates,files,chiffres}.ts`, `server/lib/file-types.ts`, `server/utils/storage.ts`, `server/api/admin/messages/index.get.ts` (`lu` → `statut`), `tests/unit/{sites-config,modules,texte,dates,chiffres,cms-validation,file-types}.test.ts` | migration appliquée sur une base réinitialisée ; `pnpm typecheck` ; `pnpm test:unit` ; audit du point 6 noté |
| **T1** | backend | L | T0 | `server/policies/**`, `server/services/**`, `server/lib/mail/**`, `server/utils/{site-scope,isr,public-images,cms-collection,mailer}.ts`, `server/plugins/mailer.ts`, `server/api/admin/contenu/**`, `server/api/admin/sites/**`, `server/api/public/sites/**`, `tests/unit/{site-access,isr,public-images,mailer}.test.ts` | typecheck de ses fichiers ; tests unitaires ; contrats du §4.2 respectés (vérifiés à la main sur `nuxt dev` avec le seed de T2) |
| **T2** | backend | L | T0 | `scripts/migrate-mockdata-to-seed.ts`, `prisma/seed.ts`, `prisma/seed/**`, `prisma/seed-data/**`, `prisma/seed-assets/**`, `tests/unit/{sections-catalog,seed-mapping}.test.ts` | générateur lancé 2 fois sans diff ; `db:seed` lancé 2 fois sans doublon ni écrasement (vérifié après avoir modifié une bio) ; aucun pravatar ni dicebear ; test du catalogue vert |
| **T3** | frontend | L | T0 (contrats) ; intégration avec T1 et T2 | `app/assets/css/{main,fonts}.css`, `public/fonts/**`, `app/app.vue`, `app/layouts/default.vue`, `app/components/site/**`, `app/composables/{useSite,useSites,useCurrentSiteSlug,useSiteSections,useSiteCollection,useReveal}.ts`, `app/pages/a-propos.vue`, `app/pages/[filiale]/a-propos.vue`, `app/pages/index.vue` (compatibilité layout), `app/pages/admin/{index,login}.vue` (`layout:false` seulement) | typecheck ; pages rendues sur `nuxt dev` ; aucun dégradé, badge décoratif, emoji ou texte public en dur |
| **T4** | frontend | L | T0 ; intégration avec T1 | `app/components/cms/**`, `app/components/ui/{select,textarea,switch,skeleton}/**`, `app/composables/useAdminResource.ts`, `app/utils/admin-error.ts`, `app/config/cms-resources.ts`, `app/pages/admin/contenu.vue`, `app/pages/admin/contenu/**`, `app/middleware/admin.ts`, `app/types/page-meta.d.ts`, `tests/nuxt/use-admin-resource.nuxt.test.ts` | typecheck ; test nuxt vert ; CRUD, réordonnancement et upload vérifiés à la main sur `nuxt dev` ; aucun `alert`, `confirm` ou `console.log` |
| **T5** | tester | M | T1–T4 | `playwright.config.ts`, `tests/e2e/**` | les 4 fichiers e2e passent contre `.output` |
| **T6** | tester puis reviewer | S | T5 | aucun fichier nouveau ; corrections renvoyées aux propriétaires | `pnpm typecheck` global, `pnpm test:unit`, `pnpm build` puis `pnpm test:e2e`, et le scénario du §4.9 ; revue CLAUDE.md, CRITICAL et MAJOR corrigés |

Parallélisme : **T1, T2, T3 et T4 en parallèle** après T0. Ensuite T5, puis T6. Mise à jour de PROJECT_STATE après T6, par le thread principal :
- `/a-propos`, `/{filiale}/a-propos` et `/admin/contenu/*` passent à 👀 : restent les captures aux 3 breakpoints et le shell admin ;
- les décisions et règles ci-dessous sont reportées.

**Règles à ajouter à CLAUDE.md** (thread principal) :
- Toute mutation de contenu public appelle `invalidatePublicPages()`.
- Tout texte public = une entrée de catalogue plus une valeur par défaut dans le seed, jamais dans un composant.
- Le seed de contenu est en amorçage seulement (jamais d'update).
- Les fichiers de `shared/` importés par le seed n'utilisent que des imports relatifs.
- Les pages admin déclarent `layout: false`, jusqu'au shell.
- Le texte public passe par `TexteAccentue` : jamais de `v-html`.
- **PROJECT_CONTEXT** : ajouter « assistant import-export scripté, aucun LLM » (écart 20 de la partie 4).

---

## 6. Points ouverts (aucun bloquant, valeur retenue par défaut)

| # | Point | Valeur retenue |
|---|---|---|
| 1 | Qui pilote `statutSite` (« admin/SUPER_ADMIN ») | **SUPER_ADMIN seul** (décision de groupe) |
| 2 | Contraste AA : or sur crème (≈ 2,2:1), accents corail, orange et terracotta en petit texte, texte blanc sur ces accents (≈ 3,6–3,8:1) | Accents §6 inchangés. Petit texte sur fond clair : `--gold-deep` et `--site-accent-strong`. Boutons : texte blanc conservé (prototype validé), écart AA documenté, à valider avec le client |
| 3 | Coordonnées (Q-02) : pas de vraies valeurs connues | `adresse` = « Montréal, Québec, Canada » ; `email` et `telephone` null, masqués jusqu'à saisie en admin |
| 4 | Textes légaux (Loi 25, RACJ) rédigés par nous | Brouillons semés, **à faire valider par un juriste avant la mise en production** |
| 5 | Images Unsplash présentées comme « réalisations » ; aucune photo d'équipe ni logo | Conservées comme valeurs par défaut, repli sur initiales pour les personnes et les logos ; remplacement par les vraies photos du client (risque de présentation trompeuse signalé) |
| 6 | Horaires du restaurant : une plage par jour | Une plage (prototype) ; midi et soir séparés plus tard si le client le demande |
| 7 | Gabarits de courriel éditables | En code en phase 2 (hors « sites publics ») ; éditables plus tard via le catalogue si demandé |
| 8 | Fichiers PUBLIC orphelins après remplacement d'image | Non supprimés en phase 2 ; script de purge ultérieur (requête d'orphelins facilitée par les FK) |
| 9 | Filiale en maintenance sur l'accueil holding | Toujours listée ; son lien mène à la page de maintenance |
| 10 | Option employeur « PTET » | `recrutementInternational = true`, `categorie` choisie par ailleurs (phase 3 placement) |
| 11 | Style des dashboards (décision ouverte n°1) | Pages `/admin/contenu/*` sans shell, avec les tokens clairs ; le shell attend la décision |
| 12 | Ancre `/#filiales` dans la navigation holding par rapport à la règle « pas d'ancre » | Conservée : la règle vise la structure des pages filiales |
| 13 | Service « Restaurant Les Ambassades d'Afrique » (ccdpaa) | Conservé dans la liste des services, non mis en avant |
| 14 | Cluster PM2 | Fork à 1 processus (cache ISR et rate-limit en mémoire) ; cache partagé à prévoir avant tout passage en cluster |
| 15 | Clé interne du cache Nitro (`cache:nitro:routes`) | Isolée dans `server/utils/isr.ts` ; le test e2e du §4.9 (étape 3) échoue si le format change lors d'une mise à jour de Nitro |

**Fichiers de référence principaux**
- Code du projet :
  - `/home/cabrel/projects/cd-holding/prisma/schema.prisma`
  - `/home/cabrel/projects/cd-holding/prisma/seed.ts`
  - `/home/cabrel/projects/cd-holding/nuxt.config.ts`
  - `/home/cabrel/projects/cd-holding/app/app.vue`
  - `/home/cabrel/projects/cd-holding/app/assets/css/main.css`
  - `/home/cabrel/projects/cd-holding/app/middleware/admin.ts`
  - `/home/cabrel/projects/cd-holding/server/utils/auth.ts`
  - `/home/cabrel/projects/cd-holding/server/utils/storage.ts`
  - `/home/cabrel/projects/cd-holding/server/api/admin/messages/index.get.ts`
  - `/home/cabrel/projects/cd-holding/server/api/admin/files/index.post.ts`
  - `/home/cabrel/projects/cd-holding/shared/config/upload.ts`
- Prototype :
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/data/mockdata.ts`
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/subConfig.ts`
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/routes/a-propos.tsx`
  - `/home/cabrel/projects/cd-holding/prototype_react/cd-holding-nexus/src/components/subsidiary/pages/SubAboutPage.tsx`
