-- AlterTable
ALTER TABLE "Candidat" ADD COLUMN     "anonymiseLe" TIMESTAMP(3),
ADD COLUMN     "consentementRenouveleLe" TIMESTAMP(3),
ALTER COLUMN "nomComplet" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Candidature" ADD COLUMN     "anonymiseLe" TIMESTAMP(3),
ADD COLUMN     "rejeteLe" TIMESTAMP(3),
ADD COLUMN     "retenueLe" TIMESTAMP(3),
ALTER COLUMN "nomComplet" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "telephone" DROP NOT NULL,
ALTER COLUMN "adresseComplete" DROP NOT NULL,
ALTER COLUMN "cvKey" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TaskExecution" (
    "id" SERIAL NOT NULL,
    "cle" TEXT NOT NULL,
    "dateDerniere" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskExecution_cle_key" ON "TaskExecution"("cle");
