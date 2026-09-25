// PATCH /api/admin/contenu/partenaires/ordre — réordonnancement transactionnel (spec §4.2).
import { partenairesCms } from '../../../../services/cms/partenaires'

export default partenairesCms.reorder
