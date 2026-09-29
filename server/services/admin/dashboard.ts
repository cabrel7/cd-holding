// Service du tableau de bord admin (lot 4) : une ligne par site visible + derniers messages.
import { ADMIN_ACTIVITE_MAX } from '#shared/config/admin'
import type { AdminDashboardDto } from '#shared/types/admin'
import type { AuthContext } from '../../utils/auth'
import { resolveAccentColor, resolveReadScope, toSiteSlug } from '../../utils/site-scope'
import { MESSAGE_LIST_SELECT, toMessageDto } from './messages'

/** Dans un `$transaction([...])`, Prisma type `_count` d'un `groupBy` comme optionnel/union : on le lit défensivement. */
function compterTout(compte: unknown): number {
  return typeof compte === 'object' && compte !== null && '_all' in compte && typeof compte._all === 'number'
    ? compte._all
    : 0
}

export async function getDashboard(ctx: AuthContext): Promise<AdminDashboardDto> {
  const scope = await resolveReadScope(ctx, undefined)
  const parCompany = scope.companyId !== null ? { companyId: scope.companyId } : {}

  const [companies, nouveaux, clients, derniers] = await prisma.$transaction([
    prisma.company.findMany({
      where: scope.companyId !== null ? { id: scope.companyId } : {},
      orderBy: { ordre: 'asc' },
      select: { id: true, uuid: true, slug: true, nom: true, couleurAccent: true, statutSite: true },
    }),
    prisma.messageContact.groupBy({
      by: ['companyId'],
      where: { statut: 'NOUVEAU', ...parCompany },
      orderBy: { companyId: 'asc' },
      _count: { _all: true },
    }),
    prisma.client.groupBy({
      by: ['companyId'],
      where: parCompany,
      orderBy: { companyId: 'asc' },
      _count: { _all: true },
    }),
    prisma.messageContact.findMany({
      where: parCompany,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: ADMIN_ACTIVITE_MAX,
      select: MESSAGE_LIST_SELECT,
    }),
  ])

  const nouveauxParSite = new Map(nouveaux.map((g) => [g.companyId, compterTout(g._count)]))
  const clientsParSite = new Map(clients.map((g) => [g.companyId, compterTout(g._count)]))

  return {
    sites: companies.map((c) => ({
      site: { uuid: c.uuid, slug: toSiteSlug(c.slug), nom: c.nom },
      couleurAccent: resolveAccentColor(c.couleurAccent),
      statutSite: c.statutSite,
      messagesNouveaux: nouveauxParSite.get(c.id) ?? 0,
      clients: clientsParSite.get(c.id) ?? 0,
    })),
    derniersMessages: derniers.map(toMessageDto),
  }
}
