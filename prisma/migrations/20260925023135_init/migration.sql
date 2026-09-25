-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('HOLDING', 'FILIALE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_FILIALE', 'EMPLOYE');

-- CreateEnum
CREATE TYPE "StatutClient" AS ENUM ('PROSPECT', 'CLIENT_ACTIF', 'INACTIF');

-- CreateEnum
CREATE TYPE "StatutCandidature" AS ENUM ('NOUVELLE', 'EN_REVISION', 'RETENUE', 'REJETEE');

-- CreateEnum
CREATE TYPE "StatutReservation" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeMessage" AS ENUM ('CONTACT', 'SUGGESTION_PRODUIT');

-- CreateEnum
CREATE TYPE "VisibiliteFichier" AS ENUM ('PUBLIC', 'PRIVE');

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "type" "CompanyType" NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "secteur" TEXT,
    "description" TEXT,
    "couleurAccent" TEXT,
    "logoKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "companyId" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fichier" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "nomOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "visibilite" "VisibiliteFichier" NOT NULL DEFAULT 'PRIVE',
    "companyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fichier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageKey" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembreEquipe" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "poste" TEXT NOT NULL,
    "photoKey" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembreEquipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Realisation" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageKey" TEXT,
    "dateRealisation" TIMESTAMP(3),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Realisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partenaire" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "logoKey" TEXT,
    "siteUrl" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partenaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageContact" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "type" "TypeMessage" NOT NULL DEFAULT 'CONTACT',
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "sujet" TEXT,
    "message" TEXT NOT NULL,
    "produitSouhaite" TEXT,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationRestaurant" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "nombrePersonnes" INTEGER NOT NULL,
    "dateReservation" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "statut" "StatutReservation" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationRestaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employe" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "poste" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningEntry" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "employeId" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "entreprise" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "statut" "StatutClient" NOT NULL DEFAULT 'PROSPECT',
    "notes" TEXT,
    "dateAjout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniereInteraction" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierComptable" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "clientId" INTEGER NOT NULL,
    "typeDeclaration" TEXT,
    "echeance" TIMESTAMP(3),
    "documentsKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierComptable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidat" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "nomComplet" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "posteRecherche" TEXT,
    "cvKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeClient" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "entrepriseCliente" TEXT NOT NULL,
    "posteRecherche" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "publiee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidature" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "companyId" INTEGER NOT NULL,
    "demandeId" INTEGER,
    "nomComplet" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "adresseComplete" TEXT NOT NULL,
    "posteRecherche" TEXT NOT NULL,
    "posteAutrePrecision" TEXT,
    "cvKey" TEXT NOT NULL,
    "autresDocumentsKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statut" "StatutCandidature" NOT NULL DEFAULT 'NOUVELLE',
    "dateEnvoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_uuid_key" ON "Company"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_uuid_key" ON "User"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Fichier_key_key" ON "Fichier"("key");

-- CreateIndex
CREATE INDEX "Fichier_companyId_idx" ON "Fichier"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_uuid_key" ON "Service"("uuid");

-- CreateIndex
CREATE INDEX "Service_companyId_ordre_idx" ON "Service"("companyId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "MembreEquipe_uuid_key" ON "MembreEquipe"("uuid");

-- CreateIndex
CREATE INDEX "MembreEquipe_companyId_ordre_idx" ON "MembreEquipe"("companyId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "Realisation_uuid_key" ON "Realisation"("uuid");

-- CreateIndex
CREATE INDEX "Realisation_companyId_ordre_idx" ON "Realisation"("companyId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "Partenaire_uuid_key" ON "Partenaire"("uuid");

-- CreateIndex
CREATE INDEX "Partenaire_companyId_ordre_idx" ON "Partenaire"("companyId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "MessageContact_uuid_key" ON "MessageContact"("uuid");

-- CreateIndex
CREATE INDEX "MessageContact_companyId_createdAt_idx" ON "MessageContact"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationRestaurant_uuid_key" ON "ReservationRestaurant"("uuid");

-- CreateIndex
CREATE INDEX "ReservationRestaurant_companyId_dateReservation_idx" ON "ReservationRestaurant"("companyId", "dateReservation");

-- CreateIndex
CREATE UNIQUE INDEX "Employe_uuid_key" ON "Employe"("uuid");

-- CreateIndex
CREATE INDEX "Employe_companyId_idx" ON "Employe"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningEntry_uuid_key" ON "PlanningEntry"("uuid");

-- CreateIndex
CREATE INDEX "PlanningEntry_companyId_dateDebut_idx" ON "PlanningEntry"("companyId", "dateDebut");

-- CreateIndex
CREATE INDEX "PlanningEntry_employeId_idx" ON "PlanningEntry"("employeId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_uuid_key" ON "Client"("uuid");

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DossierComptable_uuid_key" ON "DossierComptable"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "DossierComptable_clientId_key" ON "DossierComptable"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidat_uuid_key" ON "Candidat"("uuid");

-- CreateIndex
CREATE INDEX "Candidat_companyId_idx" ON "Candidat"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DemandeClient_uuid_key" ON "DemandeClient"("uuid");

-- CreateIndex
CREATE INDEX "DemandeClient_companyId_publiee_idx" ON "DemandeClient"("companyId", "publiee");

-- CreateIndex
CREATE UNIQUE INDEX "Candidature_uuid_key" ON "Candidature"("uuid");

-- CreateIndex
CREATE INDEX "Candidature_companyId_statut_idx" ON "Candidature"("companyId", "statut");

-- CreateIndex
CREATE INDEX "Candidature_demandeId_idx" ON "Candidature"("demandeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fichier" ADD CONSTRAINT "Fichier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreEquipe" ADD CONSTRAINT "MembreEquipe_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Realisation" ADD CONSTRAINT "Realisation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partenaire" ADD CONSTRAINT "Partenaire_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageContact" ADD CONSTRAINT "MessageContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationRestaurant" ADD CONSTRAINT "ReservationRestaurant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employe" ADD CONSTRAINT "Employe_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningEntry" ADD CONSTRAINT "PlanningEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningEntry" ADD CONSTRAINT "PlanningEntry_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierComptable" ADD CONSTRAINT "DossierComptable_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidat" ADD CONSTRAINT "Candidat_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeClient" ADD CONSTRAINT "DemandeClient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidature" ADD CONSTRAINT "Candidature_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "DemandeClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
