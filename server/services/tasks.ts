// Garde-fou d'exécution des tâches planifiées (cluster, spec lot 5 §5) : une seule instance doit
// exécuter une tâche donnée par intervalle, même si plusieurs workers partagent la même base.
// `estEchu` est pure (testée) ; `claimTaskExecution` s'appuie sur l'unicité de `TaskExecution.cle`
// (course create/P2002) puis sur un `updateMany` conditionnel — jamais de SQL brut.
import { isUniqueViolation } from '../lib/admin/pagination'

/** Vrai si aucune exécution n'a eu lieu, ou si la dernière remonte à au moins `intervalleMs`. */
export function estEchu(dateDerniere: Date | null, intervalleMs: number, maintenant: Date = new Date()): boolean {
  if (dateDerniere === null) return true
  return maintenant.getTime() - dateDerniere.getTime() >= intervalleMs
}

/**
 * Tente de réserver l'exécution de la tâche `cle` : renvoie `true` si l'appelant doit l'exécuter.
 *
 * Séquence : lecture bon marché (évite l'écriture quand ce n'est pas dû) → `create` (le tout
 * premier passage, ou le gagnant d'une course) → en cas de conflit P2002, `updateMany` borné par
 * `dateDerniere < maintenant - intervalleMs` (un seul worker peut gagner ; le perdant voit 0).
 */
export async function claimTaskExecution(
  cle: string,
  intervalleMs: number,
  maintenant: Date = new Date(),
): Promise<boolean> {
  const existante = await prisma.taskExecution.findUnique({ where: { cle }, select: { dateDerniere: true } })
  if (!estEchu(existante?.dateDerniere ?? null, intervalleMs, maintenant)) return false

  const limite = new Date(maintenant.getTime() - intervalleMs)
  try {
    await prisma.taskExecution.create({ data: { cle, dateDerniere: maintenant } })
    return true
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
  }

  const { count } = await prisma.taskExecution.updateMany({
    where: { cle, dateDerniere: { lt: limite } },
    data: { dateDerniere: maintenant },
  })
  return count > 0
}
