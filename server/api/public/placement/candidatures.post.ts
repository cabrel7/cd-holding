// POST /api/public/placement/candidatures — candidature publique, avec ou sans offre (spec lot 3
// §0/§3). Le risque principal est l'upload public non authentifié (bots, disque, fichiers
// polyglottes) : gardes de transport AVANT lecture du corps, validation de TOUS les fichiers
// avant qu'aucun ne soit écrit, retour arrière complet si l'écriture Prisma échoue ensuite.
import { consola } from 'consola'
import type { Prisma } from '../../../generated/prisma/client'
import { CANDIDATURE_LIMITS, PLACEMENT_SLUG } from '#shared/config/candidature'
import { MULTIPART_OVERHEAD_BYTES } from '#shared/config/upload'
import { candidatureChampsSchema } from '#shared/validation/candidature'
import { HOLDING_SLUG } from '#shared/config/sites'
import {
  construireCandidature,
  validerFichiersCandidature,
  type ChampsCandidature,
  type FichierEntrant,
  type OffreResolue,
} from '../../../lib/candidature'
import { cleAccuseReception } from '../../../lib/contact'
import { accuseReceptionTemplate } from '../../../lib/mail/templates/accuse-reception'
import { notificationInterneTemplate } from '../../../lib/mail/templates/notification-interne'

const CANDIDATURE_RATE_LIMIT = { scope: 'candidature', max: 3, windowMs: 60 * 60 * 1000 } as const
// Même fenêtre que le formulaire de contact (server/api/public/contact.post.ts) : un seul
// mécanisme de limite par destinataire pour tous les accusés de réception publics.
const ACCUSE_RECEPTION_LIMIT = { max: 3, windowMs: 24 * 60 * 60 * 1000 } as const
const MAX_CANDIDATURE_BODY_BYTES = CANDIDATURE_LIMITS.totalMaxBytes + MULTIPART_OVERHEAD_BYTES

const CHAMP_CV = 'cv'
const CHAMP_DOCUMENTS = 'documents'

export default defineEventHandler(async (event) => {
  // 1. Rate-limit en premier : les requêtes malformées comptent aussi.
  assertRateLimit(event, CANDIDATURE_RATE_LIMIT)

  // 2. Content-Type : uniquement multipart (jamais de JSON pour un upload de fichiers).
  const contentType = getRequestHeader(event, 'content-type')
  if (!contentType?.toLowerCase().includes('multipart/form-data')) {
    throw createError({ statusCode: 415, statusMessage: 'Format de requête non pris en charge' })
  }

  // 3. Content-Length : requis (411) et borné (413) AVANT lecture — `readMultipartFormData`
  // charge tout le corps en mémoire, un corps non authentifié ne doit jamais être lu en aveugle.
  const contentLengthHeader = getRequestHeader(event, 'content-length')
  const contentLength = contentLengthHeader !== undefined ? Number(contentLengthHeader) : Number.NaN
  if (!contentLengthHeader || Number.isNaN(contentLength)) {
    throw createError({ statusCode: 411, statusMessage: 'Longueur de requête requise' })
  }
  if (contentLength > MAX_CANDIDATURE_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Requête trop volumineuse' })
  }

  // 4. Lecture et répartition des parties.
  const parts = await readMultipartFormData(event)
  if (!parts) {
    throw createError({ statusCode: 400, statusMessage: 'Formulaire multipart attendu' })
  }
  if (parts.length > CANDIDATURE_LIMITS.partsMax) {
    throw createError({ statusCode: 400, statusMessage: 'Trop de champs dans le formulaire.' })
  }

  const textFieldNames = new Set<string>()
  const textFields: Record<string, string> = {}
  const cvParts: FichierEntrant[] = []
  const documentParts: FichierEntrant[] = []

  for (const part of parts) {
    if (part.filename) {
      if (part.name === CHAMP_CV) cvParts.push({ filename: part.filename, data: part.data })
      else if (part.name === CHAMP_DOCUMENTS) documentParts.push({ filename: part.filename, data: part.data })
      else throw createError({ statusCode: 400, statusMessage: 'Champ de fichier inattendu.' })
      continue
    }
    if (!part.name) continue
    if (textFieldNames.has(part.name)) {
      throw createError({ statusCode: 400, statusMessage: 'Champ en double.' })
    }
    textFieldNames.add(part.name)
    textFields[part.name] = part.data.toString('utf8')
  }

  // 5. Validation des champs texte — en cas d'échec, jamais la saisie dans la réponse.
  const parsedChamps = candidatureChampsSchema.safeParse(textFields)
  if (!parsedChamps.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: parsedChamps.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
    })
  }
  const champs = parsedChamps.data

  // 6. Honeypot rempli : 201 simulé, rien n'est écrit, le bot n'apprend rien.
  if (champs.website) {
    consola.info('[candidature] honeypot')
    setResponseStatus(event, 201)
    return { ok: true }
  }

  // 7. Fichiers : TOUS validés (octets réels, jamais le Content-Type déclaré) avant toute écriture.
  const resultatFichiers = validerFichiersCandidature(cvParts, documentParts)
  if (!resultatFichiers.ok) {
    throw createError({ statusCode: resultatFichiers.erreur.statusCode, statusMessage: resultatFichiers.erreur.statusMessage })
  }

  // 8. Résolution de la filiale et, si fournie, de l'offre ciblée (jamais depublié/fermée).
  const [placement, holding] = await Promise.all([
    prisma.company.findUnique({ where: { slug: PLACEMENT_SLUG }, select: { id: true, nom: true, email: true } }),
    prisma.company.findUnique({ where: { slug: HOLDING_SLUG }, select: { email: true } }),
  ])
  if (!placement) {
    throw createError({ statusCode: 500, statusMessage: 'Configuration invalide' })
  }

  let offre: OffreResolue | null = null
  if (champs.demandeUuid) {
    const demande = await prisma.demandeClient.findFirst({
      where: { uuid: champs.demandeUuid, companyId: placement.id, publiee: true, statut: 'OUVERTE' },
      select: { id: true, titreOffre: true, categorie: true },
    })
    if (!demande || !demande.titreOffre) {
      throw createError({ statusCode: 404, statusMessage: 'Offre introuvable ou retirée' })
    }
    offre = { id: demande.id, titreOffre: demande.titreOffre, categorie: demande.categorie }
  }

  // 9. Écriture des fichiers (lot applicatif, retour arrière automatique si l'un échoue).
  const saved = await saveUploadedFiles(
    [
      { data: resultatFichiers.cv.data, filename: resultatFichiers.cv.filename },
      ...resultatFichiers.documents.map((doc) => ({ data: doc.data, filename: doc.filename })),
    ],
    { companyId: placement.id, visibilite: 'PRIVE' },
  )
  // `saved` a toujours au moins un élément (le cv, validé à l'étape 7) : `resultatFichiers.cv`
  // garantit un fichier `cv` en première position du lot envoyé à `saveUploadedFiles`.
  const [cvSaved, ...documentsSaved] = saved as [(typeof saved)[number], ...(typeof saved)]

  // 10. Persistance — select explicite, uuid non renvoyé au client. Retour arrière des fichiers
  // si l'écriture échoue (ex. contrainte Prisma) ; l'erreur relancée devient un 500 générique
  // (server/plugins/error-handler.ts masque déjà le détail technique).
  const champsCandidature: ChampsCandidature = {
    nom: champs.nom,
    email: champs.email,
    telephone: champs.telephone,
    adresseComplete: champs.adresseComplete,
    pays: champs.pays,
    posteRecherche: champs.posteRecherche,
    posteAutrePrecision: champs.posteAutrePrecision,
    experience: champs.experience,
    message: champs.message,
  }
  const data = construireCandidature(
    champsCandidature,
    placement.id,
    offre,
    { cvKey: cvSaved.key, autresDocumentsKeys: documentsSaved.map((doc) => doc.key) },
    new Date(),
  )

  try {
    await prisma.candidature.create({ data: data as Prisma.CandidatureUncheckedCreateInput, select: { uuid: true } })
  } catch (error) {
    await supprimerFichiers(saved.map((f) => f.key))
    throw error
  }

  // 11. Courriels, non bloquants.
  const destinataire = placement.email ?? holding?.email ?? null
  if (destinataire) {
    queueMail(event, {
      template: 'notification-interne',
      to: destinataire,
      replyTo: champs.email,
      ...notificationInterneTemplate({
        nomEntreprise: placement.nom,
        typeMessage: 'Candidature',
        nomExpediteur: champs.nom,
        origine: offre ? `offre « ${offre.titreOffre} »` : 'candidature spontanée',
      }),
    })
  }

  if (consumeRateLimit(cleAccuseReception(champs.email), ACCUSE_RECEPTION_LIMIT)) {
    queueMail(event, {
      template: 'accuse-reception',
      to: champs.email,
      ...accuseReceptionTemplate({ nomDestinataire: champs.nom, nomEntreprise: placement.nom, objet: 'candidature' }),
    })
  }

  // 12. Succès.
  setResponseStatus(event, 201)
  return { ok: true }
})
