// PATCH /api/admin/sites/[uuid] — spec §4.2. `couleurAccent` jamais modifiable (§6) ; invalidation ISR.
import { sitesAdmin } from '../../../services/admin/sites'

export default sitesAdmin.update
