// GET /api/admin/contenu/services?site= — spec §4.2. Handler fourni par la factory CMS
// (server/utils/cms-collection.ts) via server/services/cms/services.ts : rôle → zod → portée
// filiale → liste triée. Aucune logique ici, voir server/services/cms/services.ts.
import { servicesCms } from '../../../../services/cms/services'

export default servicesCms.list
