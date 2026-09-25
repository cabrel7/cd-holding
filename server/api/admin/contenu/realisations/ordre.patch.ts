// PATCH /api/admin/contenu/realisations/ordre — réordonnancement transactionnel (spec §4.2).
import { realisationsCms } from '../../../../services/cms/realisations'

export default realisationsCms.reorder
