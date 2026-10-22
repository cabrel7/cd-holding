-- Backfill Loi 25 : les candidatures déjà REJETEE (créées avant le lot 5) n'ont pas d'horloge de
-- rejet ; on la pose à leur date d'envoi pour que l'échéance d'anonymisation (rejet + 6 mois,
-- `echanceAnonymisation`) soit calculée depuis la décision de rejet et non depuis la réception.
UPDATE "Candidature"
SET "rejeteLe" = "dateEnvoi"
WHERE "statut" = 'REJETEE' AND "rejeteLe" IS NULL;