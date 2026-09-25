// PATCH /api/admin/contenu/sections/[uuid] — spec §4.2 (pas de POST ni de DELETE : le
// catalogue est défini par le code, voir shared/content/sections/).
import { sectionsCms } from '../../../../services/cms/sections'

export default sectionsCms.update
