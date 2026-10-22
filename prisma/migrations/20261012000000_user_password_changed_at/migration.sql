-- AlterTable : horloge d'invalidation paresseuse des sessions (lot 6, D9-D11).
-- `null` = aucun changement de mot de passe = toutes les sessions existantes restent valables
-- (grandfathering au déploiement). Une session est valable si loggedInAt >= passwordChangedAt.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
