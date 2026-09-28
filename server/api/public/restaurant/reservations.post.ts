// POST /api/public/restaurant/reservations — réservation publique (spec lot 3 §3). Handler
// mince : gardes de transport, réglages du restaurant, délègue au schéma métier
// (shared/validation/reservation.ts, `maintenant` relu à la validation) et au mapping pur
// (server/lib/reservation.ts), puis Prisma/courriels. Idempotent (spec §0 : le vrai risque est
// le doublon par double clic/nouvel envoi, pas une capacité de salle) : un second envoi
// identique (même filiale, même courriel, même instant, statut non annulé) répond 201 sans
// écrire ni courriel.
import { consola } from 'consola'
import { RESTAURANT_SLUG, reglagesValides, type ReglagesReservation } from '#shared/utils/restaurant'
import { instantQuebec } from '#shared/utils/dates'
import { reservationBaseSchema, reservationSchema } from '#shared/validation/reservation'
import { ACCUSE_RECEPTION_LIMIT, cleAccuseReception } from '../../../lib/contact'
import { RESTAURANT_SELECT, construireReservation, recapitulatifReservation } from '../../../lib/reservation'
import { accuseReceptionTemplate } from '../../../lib/mail/templates/accuse-reception'
import { notificationInterneTemplate } from '../../../lib/mail/templates/notification-interne'

const RESERVATION_RATE_LIMIT = { scope: 'reservation', max: 5, windowMs: 10 * 60 * 1000 } as const
const MAX_RESERVATION_BODY_BYTES = 4 * 1024

interface RestaurantResolu {
  readonly companyId: number
  readonly nomEntreprise: string
  readonly email: string | null
  readonly reglages: ReglagesReservation
}

async function resolveRestaurant(): Promise<RestaurantResolu | null> {
  const company = await prisma.company.findUnique({ where: { slug: RESTAURANT_SLUG }, select: { id: true, nom: true, email: true } })
  if (!company) return null

  const reglages = await prisma.reglagesRestaurant.findUnique({ where: { companyId: company.id }, select: RESTAURANT_SELECT })
  if (!reglages || !reglagesValides(reglages)) return null

  return { companyId: company.id, nomEntreprise: company.nom, email: company.email, reglages }
}

export default defineEventHandler(async (event) => {
  // 1. Rate-limit en premier : les requêtes malformées comptent aussi.
  assertRateLimit(event, RESERVATION_RATE_LIMIT)

  // 2. Content-Type : jamais de x-www-form-urlencoded.
  const contentType = getRequestHeader(event, 'content-type')
  if (!contentType?.toLowerCase().includes('application/json')) {
    throw createError({ statusCode: 415, statusMessage: 'Format de requête non pris en charge' })
  }

  // 3. Content-Length : requis (411) et borné (413) avant de lire le corps.
  const contentLengthHeader = getRequestHeader(event, 'content-length')
  const contentLength = contentLengthHeader !== undefined ? Number(contentLengthHeader) : Number.NaN
  if (!contentLengthHeader || Number.isNaN(contentLength)) {
    throw createError({ statusCode: 411, statusMessage: 'Longueur de requête requise' })
  }
  if (contentLength > MAX_RESERVATION_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Requête trop volumineuse' })
  }

  // 4. Validation zod de base (heure/date au bon format, sans encore les règles métier).
  const body = await readValidatedBody(event, reservationBaseSchema.parse)

  // 5. Honeypot rempli : 201 simulé, aucune écriture, aucun courriel.
  if (body.website) {
    consola.info('[reservation] honeypot')
    setResponseStatus(event, 201)
    return { ok: true }
  }

  // 6. Réglages absents ou invalides : le service n'est pas disponible en ligne.
  const restaurant = await resolveRestaurant()
  if (!restaurant) {
    consola.warn('[reservation] réglages absents ou invalides')
    throw createError({ statusCode: 503, statusMessage: 'Réservations en ligne indisponibles' })
  }
  const { companyId, nomEntreprise, email, reglages } = restaurant

  // 7. Règles métier (créneaux, capacité, jours d'ouverture) — 400 si violées.
  const validated = reservationSchema(reglages).safeParse(body)
  if (!validated.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: validated.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    })
  }

  // 8. Date murale Québec → instant UTC exact (heure d'été/hiver).
  const dateReservation = instantQuebec(validated.data.date, validated.data.heure)

  // Courriel normalisé (casse/espaces) : clé d'idempotence et stockage cohérents.
  const courriel = validated.data.email.trim().toLowerCase()

  // 9. Idempotence : même filiale/courriel/instant, statut non annulé → 201 sans écriture ni courriel.
  const existante = await prisma.reservationRestaurant.findFirst({
    where: { companyId, email: courriel, dateReservation, statut: { not: 'ANNULEE' } },
    select: { uuid: true },
  })
  if (existante) {
    setResponseStatus(event, 201)
    return { ok: true }
  }

  // 10. Persistance — select explicite, uuid non renvoyé au client.
  const data = construireReservation({ ...validated.data, email: courriel }, companyId, dateReservation)
  await prisma.reservationRestaurant.create({ data, select: { uuid: true } })

  // 11. Courriels, non bloquants.
  if (email) {
    queueMail(event, {
      template: 'notification-interne',
      to: email,
      replyTo: courriel,
      ...notificationInterneTemplate({
        nomEntreprise,
        typeMessage: 'Réservation',
        nomExpediteur: validated.data.nom,
        origine: 'réservation en ligne',
      }),
    })
  }

  // Limite par destinataire (3 / 24 h) : même garde que contact et candidatures.
  if (consumeRateLimit(cleAccuseReception(courriel), ACCUSE_RECEPTION_LIMIT)) {
    queueMail(event, {
      template: 'accuse-reception',
      to: courriel,
      ...accuseReceptionTemplate({
        nomDestinataire: validated.data.nom,
        nomEntreprise,
        objet: 'demande de réservation',
        recapitulatif: recapitulatifReservation(validated.data, dateReservation),
      }),
    })
  }

  // 12. Succès.
  setResponseStatus(event, 201)
  return { ok: true }
})
