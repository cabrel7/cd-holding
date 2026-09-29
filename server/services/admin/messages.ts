// Service admin "messages de contact" (lot 4). Aucune référence à l'event H3 : les handlers
// (server/api/admin/messages/**) font requireRole + validation, puis appellent ces fonctions.
import { ADMIN_PAGE_SIZE } from '#shared/config/admin'
import type { AdminClientDto, AdminMessageDto, AdminPage, StatutMessageDto } from '#shared/types/admin'
import type { MessagesQuery } from '#shared/validation/admin'
import type { Prisma } from '../../generated/prisma/client'
import type { AuthContext } from '../../utils/auth'
import { resolveReadScope, toSiteSlug } from '../../utils/site-scope'
import { champsDetails, champsSuggestion } from '../../lib/admin/message-details'
import { buildPage, isUniqueViolation, pageArgs } from '../../lib/admin/pagination'
import { CLIENT_SELECT, toClientDto } from './clients'

const MESSAGE_SELECT = {
  uuid: true,
  nom: true,
  email: true,
  telephone: true,
  entreprise: true,
  sujet: true,
  message: true,
  type: true,
  statut: true,
  details: true,
  produitSouhaite: true,
  paysOrigine: true,
  createdAt: true,
  company: { select: { uuid: true, slug: true, nom: true } },
} as const

const OWNER_SELECT = { id: true, companyId: true } as const

type MessageRow = Prisma.MessageContactGetPayload<{ select: typeof MESSAGE_SELECT }>

export function toMessageDto(row: MessageRow): AdminMessageDto {
  const { formulaire, champs } = champsDetails(row.details, row.type)
  return {
    uuid: row.uuid,
    nom: row.nom,
    email: row.email,
    telephone: row.telephone,
    entreprise: row.entreprise,
    sujet: row.sujet,
    message: row.message,
    type: row.type,
    statut: row.statut,
    site: { uuid: row.company.uuid, slug: toSiteSlug(row.company.slug), nom: row.company.nom },
    formulaire,
    champs: [...champsSuggestion(row.type, row.produitSouhaite, row.paysOrigine), ...champs],
    createdAt: row.createdAt.toISOString(),
  }
}

/** Sélection réutilisée par le tableau de bord (derniers messages). */
export const MESSAGE_LIST_SELECT = MESSAGE_SELECT

function whereRecherche(q: string): Prisma.MessageContactWhereInput {
  const contient = (champ: 'nom' | 'email' | 'sujet' | 'message' | 'entreprise') => ({
    [champ]: { contains: q, mode: 'insensitive' as const },
  })
  return { OR: [contient('nom'), contient('email'), contient('sujet'), contient('message'), contient('entreprise')] }
}

export async function listMessages(ctx: AuthContext, query: MessagesQuery): Promise<AdminPage<AdminMessageDto>> {
  const scope = await resolveReadScope(ctx, query.site)
  const where: Prisma.MessageContactWhereInput = {
    ...(scope.companyId !== null ? { companyId: scope.companyId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.statut ? { statut: query.statut } : {}),
    ...(query.q ? whereRecherche(query.q) : {}),
  }
  const [total, rows] = await prisma.$transaction([
    prisma.messageContact.count({ where }),
    prisma.messageContact.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.page, ADMIN_PAGE_SIZE),
      select: MESSAGE_SELECT,
    }),
  ])
  return buildPage(rows.map(toMessageDto), total, query.page, ADMIN_PAGE_SIZE)
}

export async function compterMessagesNouveaux(ctx: AuthContext): Promise<{ nouveaux: number }> {
  const scope = await resolveReadScope(ctx, undefined)
  const nouveaux = await prisma.messageContact.count({
    where: { statut: 'NOUVEAU', ...(scope.companyId !== null ? { companyId: scope.companyId } : {}) },
  })
  return { nouveaux }
}

/** Message d'une autre filiale : 404 (ne révèle pas son existence). */
async function findOwnedOr404(ctx: AuthContext, uuid: string): Promise<{ id: number; companyId: number }> {
  const owner = await prisma.messageContact.findUnique({ where: { uuid }, select: OWNER_SELECT })
  if (!owner) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  assertCompanyAccess(ctx.user, ctx.secure, owner.companyId)
  return owner
}

export async function updateMessageStatut(
  ctx: AuthContext,
  uuid: string,
  statut: StatutMessageDto,
): Promise<AdminMessageDto> {
  const owner = await findOwnedOr404(ctx, uuid)
  const row = await prisma.messageContact.update({ where: { id: owner.id }, data: { statut }, select: MESSAGE_SELECT })
  return toMessageDto(row)
}

export async function deleteMessage(ctx: AuthContext, uuid: string): Promise<void> {
  const owner = await findOwnedOr404(ctx, uuid)
  await prisma.messageContact.deleteMany({ where: { id: owner.id } })
}

const CONFLIT_CLIENT = 'Ce contact figure déjà dans les clients.'

/** Convertit un message en client PROSPECT de la filiale du message (jamais celle d'un body). */
export async function convertirEnClient(ctx: AuthContext, uuid: string): Promise<AdminClientDto> {
  const owner = await findOwnedOr404(ctx, uuid)
  const message = await prisma.messageContact.findUnique({
    where: { id: owner.id },
    select: { nom: true, email: true, telephone: true, entreprise: true, sujet: true, createdAt: true },
  })
  if (!message) throw createError({ statusCode: 404, statusMessage: 'Introuvable' })

  const email = message.email.trim().toLowerCase()
  const existant = await prisma.client.findFirst({
    where: { companyId: owner.companyId, email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  })
  if (existant) throw createError({ statusCode: 409, statusMessage: CONFLIT_CLIENT })

  try {
    const client = await prisma.client.create({
      data: {
        companyId: owner.companyId,
        nom: message.nom,
        email,
        telephone: message.telephone,
        entreprise: message.entreprise,
        statut: 'PROSPECT',
        notes: message.sujet,
        derniereInteraction: message.createdAt,
      },
      select: CLIENT_SELECT,
    })
    return toClientDto(client)
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: CONFLIT_CLIENT })
    throw error
  }
}
