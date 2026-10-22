-- Réservations en double (décision 2026-09-29, lot 5) : un même courriel ne peut pas avoir deux
-- réservations actives pour le même créneau (même filiale). Index unique PARTIEL — les lignes
-- ANNULEE en sont exclues, un client dont la réservation a été annulée peut réserver à nouveau
-- le même créneau. Non représentable dans schema.prisma (Prisma ne gère pas les index partiels) :
-- tout `prisma migrate dev` ultérieur qui proposerait un `DROP INDEX` sur
-- `ReservationRestaurant_doublon_key` doit être refusé (voir PROJECT_STATE).
CREATE UNIQUE INDEX "ReservationRestaurant_doublon_key"
ON "ReservationRestaurant"("companyId", "email", "dateReservation")
WHERE "statut" <> 'ANNULEE';
