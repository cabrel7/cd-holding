// POST /api/public/contact (spec docs/specs/phase3-holding-contact.md §3.2,
// docs/specs/lot2-contact-filiales.md §2) — route publique, sans session. Handler mince :
// gardes de transport, délègue au registre FORMULAIRES (server/lib/contact.ts, logique pure)
// puis à Prisma/queueMail. Une variante zod = une entrée du registre (DEC-12/13) : `holding`,
// les 6 formulaires de filiale et `suggestion`.
import { consola } from 'consola'
import type { Prisma } from '../../generated/prisma/client'
import { HOLDING_SLUG } from '#shared/config/sites'
import { contactBodySchema } from '#shared/validation/contact'
import { ACCUSE_RECEPTION_LIMIT, FORMULAIRES, cleAccuseReception, destinataireInterne, type CibleContact } from '../../lib/contact'
import { accuseReceptionTemplate } from '../../lib/mail/templates/accuse-reception'
import { notificationInterneTemplate } from '../../lib/mail/templates/notification-interne'
import { toSiteSlug } from '../../utils/site-scope'

const CONTACT_RATE_LIMIT = { scope: 'contact', max: 5, windowMs: 10 * 60 * 1000 } as const
// Borne la taille du corps AVANT lecture : sans ça, readValidatedBody charge en mémoire un
// corps non authentifié arbitrairement gros avant que zod ne le rejette (déni de service).
const MAX_CONTACT_BODY_BYTES = 32 * 1024

const COMPANY_SELECT = { id: true, slug: true, nom: true, email: true } as const

async function resolveCibleEtHolding(cibleSlug: string): Promise<{ cible: CibleContact; holding: CibleContact }> {
  const slugs = Array.from(new Set([cibleSlug, HOLDING_SLUG]))
  const rows = await prisma.company.findMany({ where: { slug: { in: slugs } }, select: COMPANY_SELECT })
  const bySlug = new Map(rows.map((row) => [row.slug, row]))

  const cibleRow = bySlug.get(cibleSlug)
  const holdingRow = bySlug.get(HOLDING_SLUG)
  if (!cibleRow || !holdingRow) {
    throw createError({ statusCode: 404, statusMessage: 'Site introuvable' })
  }

  const toCible = (row: (typeof rows)[number]): CibleContact => ({
    id: row.id,
    slug: toSiteSlug(row.slug),
    nom: row.nom,
    email: row.email,
  })
  return { cible: toCible(cibleRow), holding: toCible(holdingRow) }
}

export default defineEventHandler(async (event) => {
  // 1. Rate-limit en premier : les requêtes malformées comptent aussi.
  assertRateLimit(event, CONTACT_RATE_LIMIT)

  // 2. Content-Type : jamais de x-www-form-urlencoded (POST natif depuis n'importe quel site).
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
  if (contentLength > MAX_CONTACT_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Requête trop volumineuse' })
  }

  // 4. Validation zod (400 « Validation Error », géré par h3 sur échec de `readValidatedBody`).
  const body = await readValidatedBody(event, contactBodySchema.parse)

  // 5. Honeypot rempli : 201 simulé, aucune écriture, aucun courriel — le bot n'apprend rien.
  if (body.website) {
    consola.info('[contact] honeypot', { formulaire: body.formulaire })
    setResponseStatus(event, 201)
    return { ok: true }
  }

  // 6-7. Registre + cible réelle (jamais une chaîne libre : `cible` vient d'un z.enum).
  const handler = FORMULAIRES[body.formulaire]
  const cibleSlug = handler.cible(body)
  const { cible, holding } = await resolveCibleEtHolding(cibleSlug)

  // 8. Persistance — select explicite, uuid non renvoyé au client. Le cast ne porte QUE sur la
  // frontière Prisma : `details` (JSON arbitraire) échoue l'inférence structurelle de Prisma
  // face à un type maison même valide à l'exécution (récursivité de `Prisma.InputJsonValue`).
  const data = handler.construire(body, cible, holding)
  await prisma.messageContact.create({ data: data as Prisma.MessageContactUncheckedCreateInput, select: { uuid: true } })

  // 9. Courriels, non bloquants (queueMail ne lève jamais).
  const destinataire = destinataireInterne(cible, holding)
  if (destinataire) {
    queueMail(event, {
      template: 'notification-interne',
      to: destinataire,
      replyTo: body.email,
      ...notificationInterneTemplate({
        nomEntreprise: cible.nom,
        typeMessage: handler.typeLibelle,
        nomExpediteur: body.nom,
        origine: handler.origine,
      }),
    })
  }

  if (consumeRateLimit(cleAccuseReception(body.email), ACCUSE_RECEPTION_LIMIT)) {
    queueMail(event, {
      template: 'accuse-reception',
      to: body.email,
      ...accuseReceptionTemplate({ nomDestinataire: body.nom, nomEntreprise: cible.nom }),
    })
  }

  // 10. Succès.
  setResponseStatus(event, 201)
  return { ok: true }
})
