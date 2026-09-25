import { z } from 'zod'

// Exemple — sera dupliqué/adapté par filiale lors de la conversion des pages contact.
const CONTACT_RATE_LIMIT = { scope: 'contact', max: 5, windowMs: 10 * 60 * 1000 } as const
const MAX_MESSAGE_LENGTH = 5000

const contactSchema = z.object({
  companySlug: z.string().min(1).max(50),
  type: z.enum(['CONTACT', 'SUGGESTION_PRODUIT']).default('CONTACT'),
  nom: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  telephone: z.string().trim().max(30).optional(),
  sujet: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10).max(MAX_MESSAGE_LENGTH),
  produitSouhaite: z.string().trim().max(200).optional(),
  // Honeypot anti-spam : champ caché côté UI, doit rester vide
  website: z.string().max(0).optional(),
})

export default defineEventHandler(async (event) => {
  assertRateLimit(event, CONTACT_RATE_LIMIT)

  const { companySlug, website: _honeypot, ...data } = await readValidatedBody(event, contactSchema.parse)

  const company = await prisma.company.findUnique({ where: { slug: companySlug }, select: { id: true } })
  if (!company) {
    throw createError({ statusCode: 404, statusMessage: 'Société inconnue' })
  }

  await prisma.messageContact.create({ data: { ...data, companyId: company.id } })

  setResponseStatus(event, 201)
  return { ok: true }
})
