// Tâche planifiée Loi 25 (spec lot 5 §5) : anonymise chaque nuit les candidatures et candidats du
// vivier dont l'échéance de conservation est dépassée. Le nom de la tâche (référencé dans
// `nuxt.config.ts` → `nitro.scheduledTasks`) est dérivé du fichier : `anonymisation-loi25`.
import { consola } from 'consola'
import { anonymiserCandidatParId, anonymiserCandidatureParId, rechercherAnonymisables } from '../lib/anonymisation'
import { claimTaskExecution } from '../services/tasks'

const CLE = 'anonymisation-loi25'
// Cadence réelle visée : 1×/jour. Le cron déclenche à 2 h ; l'intervalle de 23 h absorbe les
// redémarrages et un éventuel second worker (le suivant ne ré-entre pas dans la fenêtre).
const INTERVALLE_MS = 23 * 60 * 60 * 1000

export default defineTask({
  meta: {
    name: CLE,
    description: 'Anonymise les candidatures et candidats du vivier échus (conservation Loi 25).',
  },
  async run() {
    if (!(await claimTaskExecution(CLE, INTERVALLE_MS))) {
      return { result: { ignores: true, candidatures: 0, candidats: 0 } }
    }

    const { candidatureIds, candidatIds } = await rechercherAnonymisables()
    let candidatures = 0
    let candidats = 0

    for (const id of candidatureIds) {
      try {
        await anonymiserCandidatureParId(id)
        candidatures += 1
      } catch (error) {
        // Une ligne en échec ne doit jamais interrompre les suivantes ; log sans donnée personnelle.
        consola.warn('[loi25] anonymisation candidature échouée', { id, message: (error as Error).message })
      }
    }
    for (const id of candidatIds) {
      try {
        await anonymiserCandidatParId(id)
        candidats += 1
      } catch (error) {
        consola.warn('[loi25] anonymisation candidat échouée', { id, message: (error as Error).message })
      }
    }

    consola.info('[loi25] anonymisation terminée', { candidatures, candidats })
    return { result: { ignores: false, candidatures, candidats } }
  },
})
