// PATCH /api/admin/contenu/equipe/ordre — réordonnancement transactionnel (spec §4.2).
import { equipeCms } from '../../../../services/cms/equipe'

export default equipeCms.reorder
