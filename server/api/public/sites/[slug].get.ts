// GET /api/public/sites/[slug] — spec §4.2. Slug inconnu → 404.
import { sitesPublic } from '../../../services/public/sites'

export default sitesPublic.detail
