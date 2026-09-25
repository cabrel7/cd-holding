-- CreateEnum
CREATE TYPE "StatutSite" AS ENUM ('ACTIF', 'EN_MAINTENANCE', 'EN_CONSTRUCTION');

-- CreateEnum
CREATE TYPE "PageSite" AS ENUM ('COMMUN', 'ACCUEIL', 'SERVICES', 'REALISATIONS', 'A_PROPOS', 'CONTACT', 'RESTAURANT', 'OFFRES', 'CONFIDENTIALITE', 'MENTIONS_LEGALES');

-- CreateEnum
CREATE TYPE "StatutMessage" AS ENUM ('NOUVEAU', 'EN_COURS', 'TRAITE');

-- CreateEnum
CREATE TYPE "CategoriePoste" AS ENUM ('MANUTENTION', 'CHAUFFEUR_CLASSE_1', 'CHAUFFEUR_CLASSE_3', 'CHAUFFEUR_CLASSE_5', 'ENTRETIEN', 'AUTRE');

-- CreateEnum
CREATE TYPE "NiveauExperience" AS ENUM ('MOINS_1_AN', 'UN_A_TROIS_ANS', 'TROIS_A_CINQ_ANS', 'PLUS_5_ANS');

-- CreateEnum
CREATE TYPE "StatutCandidat" AS ENUM ('DISPONIBLE', 'EN_PROCESSUS', 'PLACE');

-- CreateEnum
CREATE TYPE "OrigineCandidat" AS ENUM ('LOCAL', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "TypeContrat" AS ENUM ('TEMPS_PLEIN', 'TEMPS_PARTIEL', 'TEMPORAIRE');

-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('OUVERTE', 'POURVUE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "ForfaitComptable" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'ANNUEL');

-- CreateEnum
CREATE TYPE "StatutDossier" AS ENUM ('A_JOUR', 'EN_RETARD', 'EN_TRAITEMENT');

-- AlterEnum
ALTER TYPE "TypeMessage" ADD VALUE 'ASSISTANT_IMPORT_EXPORT';

-- DropIndex
DROP INDEX "MessageContact_companyId_createdAt_idx";

-- DropIndex
DROP INDEX "Candidat_companyId_idx";

-- DropIndex
DROP INDEX "DemandeClient_companyId_publiee_idx";

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "adresse" TEXT,
ADD COLUMN     "effectif" INTEGER,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "heroImageKey" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "nomCourt" TEXT,
ADD COLUMN     "ordre" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "statutSite" "StatutSite" NOT NULL DEFAULT 'ACTIF',
ADD COLUMN     "telephone" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "misEnAvant" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MembreEquipe" ADD COLUMN     "bio" TEXT;

-- AlterTable
ALTER TABLE "Realisation" ALTER COLUMN "dateRealisation" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Partenaire" ADD COLUMN     "typeRelation" TEXT;

-- AlterTable
ALTER TABLE "MessageContact" DROP COLUMN "lu",
ADD COLUMN     "details" JSONB,
ADD COLUMN     "entreprise" TEXT,
ADD COLUMN     "paysOrigine" TEXT,
ADD COLUMN     "statut" "StatutMessage" NOT NULL DEFAULT 'NOUVEAU',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ReservationRestaurant" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Employe" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "PlanningEntry" ADD COLUMN     "lieu" TEXT NOT NULL,
ALTER COLUMN "titre" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DossierComptable" ADD COLUMN     "forfait" "ForfaitComptable",
ADD COLUMN     "statut" "StatutDossier" NOT NULL DEFAULT 'A_JOUR';

-- AlterTable
ALTER TABLE "Candidat" ADD COLUMN     "categorie" "CategoriePoste" NOT NULL,
ADD COLUMN     "disponibilite" TEXT,
ADD COLUMN     "origine" "OrigineCandidat" NOT NULL,
ADD COLUMN     "statut" "StatutCandidat" NOT NULL DEFAULT 'DISPONIBLE';

-- AlterTable
ALTER TABLE "DemandeClient" ADD COLUMN     "categorie" "CategoriePoste" NOT NULL,
ADD COLUMN     "contactEmail" TEXT NOT NULL,
ADD COLUMN     "contactNom" TEXT NOT NULL,
ADD COLUMN     "contactTelephone" TEXT,
ADD COLUMN     "dateDebut" DATE,
ADD COLUMN     "descriptionPublique" TEXT,
ADD COLUMN     "lieu" TEXT,
ADD COLUMN     "nombrePostes" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "posteAutrePrecision" TEXT,
ADD COLUMN     "publieeLe" TIMESTAMP(3),
ADD COLUMN     "recrutementInternational" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salaire" TEXT,
ADD COLUMN     "statut" "StatutDemande" NOT NULL DEFAULT 'OUVERTE',
ADD COLUMN     "titreOffre" TEXT,
ADD COLUMN     "typeContrat" "TypeContrat";

-- AlterTable
ALTER TABLE "Candidature" ADD COLUMN     "candidatId" INTEGER,
ADD COLUMN     "categorie" "CategoriePoste" NOT NULL,
ADD COLUMN     "consentementLe" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "experience" "NiveauExperience",
ADD COLUMN     "message" TEXT,
ADD COLUMN     "pays" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "SectionContenu" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "page" "PageSite" NOT NULL,
    "cle" VARCHAR(64) NOT NULL,
    "donnees" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionContenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglagesRestaurant" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "quartier" TEXT,
    "joursOuverture" INTEGER[],
    "heureOuverture" TEXT NOT NULL,
    "heureFermeture" TEXT NOT NULL,
    "dernierService" TEXT NOT NULL,
    "pasCreneauMinutes" INTEGER NOT NULL DEFAULT 30,
    "capaciteMaxReservation" INTEGER NOT NULL DEFAULT 20,
    "delaiMinimumHeures" INTEGER NOT NULL DEFAULT 2,
    "horizonJours" INTEGER NOT NULL DEFAULT 90,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglagesRestaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affectation" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "candidatId" INTEGER NOT NULL,
    "demandeId" INTEGER NOT NULL,
    "dateAffectation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Affectation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SectionContenu_uuid_key" ON "SectionContenu"("uuid");

-- CreateIndex
CREATE INDEX "SectionContenu_companyId_updatedAt_idx" ON "SectionContenu"("companyId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SectionContenu_companyId_page_cle_key" ON "SectionContenu"("companyId", "page", "cle");

-- CreateIndex
CREATE UNIQUE INDEX "ReglagesRestaurant_uuid_key" ON "ReglagesRestaurant"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "ReglagesRestaurant_companyId_key" ON "ReglagesRestaurant"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Affectation_uuid_key" ON "Affectation"("uuid");

-- CreateIndex
CREATE INDEX "Affectation_companyId_idx" ON "Affectation"("companyId");

-- CreateIndex
CREATE INDEX "Affectation_demandeId_idx" ON "Affectation"("demandeId");

-- CreateIndex
CREATE UNIQUE INDEX "Affectation_candidatId_demandeId_key" ON "Affectation"("candidatId", "demandeId");

-- CreateIndex
CREATE INDEX "Company_type_ordre_idx" ON "Company"("type", "ordre");

-- CreateIndex
CREATE INDEX "MessageContact_companyId_statut_idx" ON "MessageContact"("companyId", "statut");

-- CreateIndex
CREATE INDEX "MessageContact_companyId_type_createdAt_idx" ON "MessageContact"("companyId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "ReservationRestaurant_companyId_statut_idx" ON "ReservationRestaurant"("companyId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "Employe_userId_key" ON "Employe"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_companyId_email_key" ON "Client"("companyId", "email");

-- CreateIndex
CREATE INDEX "Candidat_companyId_statut_idx" ON "Candidat"("companyId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "Candidat_companyId_email_key" ON "Candidat"("companyId", "email");

-- CreateIndex
CREATE INDEX "DemandeClient_companyId_publiee_statut_idx" ON "DemandeClient"("companyId", "publiee", "statut");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_logoKey_fkey" FOREIGN KEY ("logoKey") REFERENCES "Fichier"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_heroImageKey_fkey" FOREIGN KEY ("heroImageKey") REFERENCES "Fichier"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_imageKey_fkey" FOREIGN KEY ("imageKey") REFERENCES "Fichier"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreEquipe" ADD CONSTRAINT "MembreEquipe_photoKey_fkey" FOREIGN KEY ("photoKey") REFERENCES "Fichier"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Realisation" ADD CONSTRAINT "Realisation_imageKey_fkey" FOREIGN KEY ("imageKey") REFERENCES "Fichier"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partenaire" ADD CONSTRAINT "Partenaire_logoKey_fkey" FOREIGN KEY ("logoKey") REFERENCES "Fichier"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionContenu" ADD CONSTRAINT "SectionContenu_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglagesRestaurant" ADD CONSTRAINT "ReglagesRestaurant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employe" ADD CONSTRAINT "Employe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidat" ADD CONSTRAINT "Candidat_cvKey_fkey" FOREIGN KEY ("cvKey") REFERENCES "Fichier"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "Candidat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_cvKey_fkey" FOREIGN KEY ("cvKey") REFERENCES "Fichier"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "Candidat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "DemandeClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

