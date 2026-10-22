// Nettoie les données créées par scripts/api-check.mjs (messages de contact de test,
// lignes Fichier + fichiers physiques dans storage/uploads) après une vérification runtime.
// N'importe et ne modifie AUCUN fichier de prod — utilise le même client Prisma généré que
// server/utils/prisma.ts, en lecture/écriture ciblée sur des uuid/key précis fournis en argument.
//
// Usage :
//   npx tsx scripts/cleanup-test-data.ts --message-uuid <uuid> [--message-uuid <uuid> ...] \
//                                          --file-key <key> [--file-key <key> ...]
//   npx tsx scripts/cleanup-test-data.ts --contact-email test-runtime-check@example.com
//
// Lot 3 (e2e placement / restaurant) :
//   --candidature-email <e>   supprime les Candidature de cet e-mail + leurs Fichier (cv, autres
//                             documents) + objets stockés
//   --reservation-email <e>   supprime les ReservationRestaurant de cet e-mail
//   --offre-titre <t>         supprime les offres de test (DemandeClient placement) de ce titre et
//                             leurs candidatures (+ Fichier + objets stockés)
//   --creer-offre <t>         crée une offre de test publiée (placement) et imprime son uuid
//   --retirer-offre <uuid>    dépublie une offre (publiee=false)
//   --inspect-candidature-email <e>  imprime en JSON les champs vérifiables de la candidature
//   --inspect-reservation-email <e>  imprime en JSON les réservations (dateReservation ISO)
//   --count-fichiers-placement       imprime le nombre de Fichier de placement (détection d'orphelins)
//
// Lot 4 (e2e admin messages / clients) — marqueur = suffixe unique en minuscules ; toutes les
// lignes créées ont un e-mail se terminant par `-<marqueur>@example.test` :
//   --seed-admin-messages <m>   crée 25 messages entretien (pagination) + transport (details
//                               réalistes) + holding + suggestion ccdpaa + contact ccdpaa
//   --seed-dossier <email>      crée un DossierComptable pour le client de cet e-mail
//   --purge-admin-data <m>      supprime messages ET clients (dossiers en cascade) du marqueur
//
// Lot 5 (e2e admin placement) — marqueur : candidats/candidatures finissant par
// `-<marqueur>@example.test`, demandes préfixées `[E2E <marqueur>]` :
//   --seed-placement <m>        crée 3 candidats, 2 demandes (dont une offre publiée) et
//                               3 candidatures (dont une anonymisée et une avec CV)
//   --purge-placement <m>       supprime candidatures (+ Fichier + objets stockés), candidats
//                               (affectations en cascade) et demandes du marqueur
//
// Lot 5 (e2e admin réservations) — marqueur : courriels `resa-<i>-<marqueur>@example.test`
// (ccdpaa, sauf une ligne entretien pour le 404 hors module) :
//   --seed-reservations <m>     crée 27 ReservationRestaurant (dates J+2..J+24 via instantQuebec,
//                               statuts variés, dont un couple même courriel + même créneau J+26 :
//                               une ANNULEE et une EN_ATTENTE, pour le test 409 ; une ANNULEE
//                               isolée J+18, pour la réactivation légale ; une ligne entretien J+12)
//   --purge-reservations <m>    supprime les ReservationRestaurant du marqueur (aucun Fichier
//                               lié : les réservations n'en ont pas — vérifié sur le schéma)
//   --count-reservations <sfx>  compte les ReservationRestaurant dont l'e-mail finit par <sfx>
//
// Lot 5 (e2e admin planning) — marqueur : employés de test de la filiale TRANSPORT (seule filiale
// sans comptes AF/employé seedés dédiés : aucune collision avec les fixtures), e-mails
// `planning-<i>-<m>@example.test` (Employe.email est nullable — c'est la clé de purge), quarts
// datés relatifs à la semaine courante (lundiDeSemaineQuebec + jours 0..6) reliés par employeId
// (suppression en cascade Prisma onDelete: Cascade). Les quarts posés par les tests via l'API sur
// des employés NON seedés (Awa Diallo, entretien) portent un titre préfixé `[E2E <m>]`, purgé aussi :
//   --seed-planning <m>     crée 3 employés transport (dont 1 actif=false) + 3 quarts (dont une
//                           nuit 22:00→06:00 lendemain)
//   --purge-planning <m>    supprime les employés du marqueur (quarts en cascade) + les quarts
//                           de titre `[E2E <m>]…`
//   --count-planning <m>    compte employés + quarts résiduels du marqueur (COUNT_PLANNING=)
//
// Lot 5 (e2e admin paramètres) — marqueur : compte dédié `parametres-<m>@example.test` (EMPLOYE,
// filiale entretien), SEUL compte muté par la suite (changement de mot de passe — jamais l'un
// des 3 comptes seedés partagés) :
//   --seed-compte-mdp <m>    upsert le compte avec un mot de passe GÉNÉRÉ (hash
//                            @adonisjs/hash comme prisma/seed/accounts.ts, hash recalculé à
//                            chaque appel : idempotence après un run avorté) et imprime
//                            `MDP_E2E=<mot de passe>` en stdout (jamais écrit en dur)
//   --purge-compte-mdp <m>   supprime le compte du marqueur
//
// Lot 6 (e2e admin utilisateurs) — marqueur : 3 comptes dédiés `comptes-{emp,af,sa}-<m>@example.test`
// (EMPLOYE filiale entretien, ADMIN_FILIALE filiale transport, SUPER_ADMIN sans filiale), SEULS
// comptes MUTÉS par la suite (rôle, actif, mot de passe) — jamais `admin@groupecd.ca` ni les
// comptes seedés AF/EMPLOYE partagés :
//   --seed-comptes <m>       upsert les 3 comptes avec mots de passe GÉNÉRÉS (hash
//                            @adonisjs/hash comme prisma/seed/accounts.ts, hash recalculé à
//                            chaque appel : idempotence après un run avorté) et imprime
//                            `COMPTES_MDP_JSON={"emp":{email,motDePasse},"af":…,"sa":…}` en
//                            stdout (JAMAIS de mot de passe écrit en dur — convention
//                            tests/e2e/helpers/auth.ts)
//   --purge-comptes <m>      supprime les 3 comptes du marqueur
//   --purge-compte <email>   supprime un compte par e-mail exact — pour les comptes créés par
//                            les tests via l'API/UI (hors marqueur), purgés un par un en
//                            afterAll
import 'dotenv/config'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Role } from '../server/generated/prisma/client'
import { ajouterJoursIso, dateDuJourQuebec, instantQuebec } from '../shared/utils/dates'
import { lundiDeSemaineQuebec } from '../shared/utils/planning'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL manquant')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const UPLOADS_DIR = process.env.NUXT_UPLOADS_DIR ?? join(process.cwd(), 'storage', 'uploads')

function argValues(name: string): string[] {
  const out: string[] = []
  const argv = process.argv.slice(2)
  argv.forEach((a, i) => {
    if (a === name) out.push(argv[i + 1])
  })
  return out
}

const MARQUEUR_OFFRE_TEST = 'E2E'

/** Supprime les lignes Fichier + objets stockés (même abstraction fs que --file-key). */
async function supprimerFichiersParCle(keys: string[]): Promise<void> {
  if (!keys.length) return
  for (const key of keys) {
    const res = await prisma.fichier.deleteMany({ where: { key } })
    const filePath = join(UPLOADS_DIR, key)
    const existed = existsSync(filePath)
    if (existed) rmSync(filePath)
    console.log(`Fichier ${key} : lignes DB supprimées=${res.count}, fichier disque supprimé=${existed}`)
  }
}

/** Crée un Fichier placement (PRIVE) + l'objet stocké sous cette clé dans storage/uploads. */
async function creerFichierPlacement(companyId: number, nomOriginal: string, octets = '%PDF-e2e-lot5'): Promise<string> {
  const key = randomUUID()
  await prisma.fichier.create({
    data: { key, nomOriginal, mimeType: 'application/pdf', taille: octets.length, visibilite: 'PRIVE', companyId },
  })
  mkdirSync(UPLOADS_DIR, { recursive: true })
  await writeFile(join(UPLOADS_DIR, key), Buffer.from(octets))
  return key
}

// Lot 5 (e2e admin placement) : toutes les lignes portent un courriel finissant par
// `-<marqueur>@example.test` ou une entrepriseCliente préfixée `[E2E <marqueur>]` — la purge par
// marqueur supprime candidats, candidatures (fichiers + objets stockés) et demandes de test.
async function semerPlacement(marker: string): Promise<void> {
  const placement = await prisma.company.findUnique({ where: { slug: 'placement' }, select: { id: true } })
  if (!placement) throw new Error('Filiale placement introuvable')
  const pid = placement.id
  const suffixe = `-${marker}@example.test`
  const maintenant = new Date()
  const hier = new Date(maintenant.getTime() - 86_400_000)

  await prisma.candidat.createMany({
    data: [
      {
        companyId: pid,
        nomComplet: `Alice Placement ${marker}`,
        email: `cand-vivier${suffixe}`,
        posteRecherche: 'Manutentionnaire',
        categorie: 'MANUTENTION',
        statut: 'DISPONIBLE',
        origine: 'LOCAL',
        disponibilite: 'Immédiate',
        notes: 'Candidature vivier seedée (e2e)',
      },
      {
        companyId: pid,
        nomComplet: `Bob Bureau ${marker}`,
        email: `cand-plateau${suffixe}`,
        posteRecherche: 'Chauffeur classe 1',
        categorie: 'CHAUFFEUR_CLASSE_1',
        statut: 'EN_PROCESSUS',
        origine: 'INTERNATIONAL',
      },
      {
        companyId: pid,
        nomComplet: `Claire Placée ${marker}`,
        email: `cand-place${suffixe}`,
        posteRecherche: 'Manutentionnaire',
        categorie: 'MANUTENTION',
        statut: 'PLACE',
        origine: 'LOCAL',
      },
    ],
  })

  await prisma.demandeClient.createMany({
    data: [
      {
        companyId: pid,
        entrepriseCliente: `[E2E ${marker}] Besoin manutention`,
        posteRecherche: 'Manutentionnaire',
        categorie: 'MANUTENTION',
        contactNom: `Contact E2E ${marker}`,
        contactEmail: `demande-contact${suffixe}`,
        contactTelephone: '514-555-0111',
        nombrePostes: 2,
        description: 'Besoins e2e de manutentionnaires.',
        statut: 'OUVERTE',
      },
      {
        companyId: pid,
        entrepriseCliente: `[E2E ${marker}] Offre publique`,
        posteRecherche: 'Manutentionnaire',
        categorie: 'MANUTENTION',
        contactNom: `Contact Offre ${marker}`,
        contactEmail: `offre-contact${suffixe}`,
        description: 'Offre de test e2e (interne).',
        statut: 'OUVERTE',
        nombrePostes: 1,
        publiee: true,
        titreOffre: `Offre de test ${marker}`,
        lieu: 'Laval (Québec)',
        typeContrat: 'TEMPS_PLEIN',
        salaire: '22 $/h',
        descriptionPublique: 'Poste e2e publié pour le lot 5.',
        publieeLe: maintenant,
      },
    ],
  })

  const offre = await prisma.demandeClient.findFirstOrThrow({
    where: { companyId: pid, entrepriseCliente: `[E2E ${marker}] Offre publique` },
    select: { id: true },
  })
  const besoin = await prisma.demandeClient.findFirstOrThrow({
    where: { companyId: pid, entrepriseCliente: `[E2E ${marker}] Besoin manutention` },
    select: { id: true },
  })
  const cvKey = await creerFichierPlacement(pid, 'cv-e2e.pdf')

  await prisma.candidature.createMany({
    data: [
      {
        companyId: pid,
        demandeId: offre.id,
        nomComplet: `Urgence E2E ${marker}`,
        email: `cand-ur${suffixe}`,
        telephone: '514-555-0123',
        adresseComplete: '1234 rue Exemple, Montréal (Québec) H1H 1H1',
        posteRecherche: 'manutention',
        categorie: 'MANUTENTION',
        experience: 'UN_A_TROIS_ANS',
        pays: 'Canada',
        message: 'Candidature e2e avec CV.',
        cvKey,
        statut: 'NOUVELLE',
        consentementLe: maintenant,
        dateEnvoi: hier,
      },
      {
        companyId: pid,
        demandeId: besoin.id,
        nomComplet: `Retenue E2E ${marker}`,
        email: `cand-retenue${suffixe}`,
        posteRecherche: 'manutention',
        categorie: 'MANUTENTION',
        pays: 'Canada',
        statut: 'RETENUE',
        retenueLe: maintenant,
        consentementLe: maintenant,
        dateEnvoi: hier,
      },
      {
        companyId: pid,
        demandeId: besoin.id,
        email: `cand-anon${suffixe}`,
        posteRecherche: 'manutention',
        categorie: 'MANUTENTION',
        pays: 'Canada',
        statut: 'NOUVELLE',
        anonymiseLe: new Date(hier.getTime() - 86_400_000),
        consentementLe: maintenant,
        dateEnvoi: hier,
      },
    ],
  })
  console.log(`Placement seedé pour ${marker} : candidats=3, demandes=2 (dont offre publiée), candidatures=3`)
}

async function purgerPlacement(marker: string): Promise<void> {
  const placement = await prisma.company.findUnique({ where: { slug: 'placement' }, select: { id: true } })
  if (!placement) return
  const pid = placement.id
  const suffixe = { endsWith: `-${marker}@example.test`, mode: 'insensitive' as const }

  const demandes = await prisma.demandeClient.findMany({
    where: { companyId: pid, entrepriseCliente: { startsWith: `[E2E ${marker}]` } },
    select: { id: true },
  })
  // Les candidatures anonymisées au fil de la suite ont `email` ET `nomComplet` nuls : elles sont
  // retrouvées par leur rattachement à une demande de test (création seed, `demandeId` conservé).
  const candidatures = await prisma.candidature.findMany({
    where: {
      companyId: pid,
      OR: [{ email: suffixe }, { nomComplet: suffixe }, { demandeId: { in: demandes.map((d) => d.id) } }],
    },
    select: { id: true, cvKey: true, autresDocumentsKeys: true },
  })
  await prisma.candidature.deleteMany({ where: { id: { in: candidatures.map((c) => c.id) } } })

  const candidats = await prisma.candidat.findMany({ where: { companyId: pid, email: suffixe }, select: { id: true, cvKey: true } })
  await prisma.candidat.deleteMany({ where: { id: { in: candidats.map((c) => c.id) } } })

  await prisma.demandeClient.deleteMany({ where: { id: { in: demandes.map((d) => d.id) } } })

  await supprimerFichiersParCle([
    ...candidatures.flatMap((c) => [c.cvKey, ...c.autresDocumentsKeys]),
    ...candidats.flatMap((c) => [c.cvKey]),
  ].filter((cle): cle is string => cle !== null))
  console.log(`Purge placement ${marker} : candidatures=${candidatures.length}, candidats=${candidats.length}, demandes=${demandes.length}`)
}

async function supprimerCandidatures(where: { email?: { in: string[] }; demandeId?: { in: number[] } }): Promise<void> {
  const rows = await prisma.candidature.findMany({ where, select: { id: true, cvKey: true, autresDocumentsKeys: true } })
  if (!rows.length) {
    console.log('Candidature supprimées : 0')
    return
  }
  await prisma.candidature.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  console.log(`Candidature supprimées : ${rows.length}`)
  await supprimerFichiersParCle(rows.flatMap((r) => [r.cvKey, ...r.autresDocumentsKeys]))
}

// Lot 5 (e2e admin réservations) : 27 ReservationRestaurant — 23 lignes isolées ccdpaa
// (courriels `resa-<i>-<marqueur>@example.test`, dates J+2..J+24, statuts alternés), un couple
// même courriel + même créneau (J+26) dont une ANNULEE et une EN_ATTENTE (l'index partiel
// `ReservationRestaurant_doublon_key` autorise la coexistence ; le PATCH qui réactiverait
// l'ANNULEE doit répondre 409), une ANNULEE isolée (J+18 : réactivation légale → 200) et une
// ligne d'une AUTRE filiale (entretien : hors scope du module, PATCH → 404).
const STATUTS_SEED_RESERVATIONS: Array<'EN_ATTENTE' | 'CONFIRMEE' | 'ANNULEE'> = ['EN_ATTENTE', 'CONFIRMEE', 'ANNULEE']
const HEURE_SEED_RESERVATIONS = '19:30'

async function semerReservations(marker: string): Promise<void> {
  const ccdpaa = await companyId('ccdpaa')
  const entretien = await companyId('entretien')
  const aujourdHui = dateDuJourQuebec()
  const lignes: Array<{
    companyId: number
    nom: string
    email: string
    telephone: string
    nombrePersonnes: number
    dateReservation: Date
    notes: string | null
    statut: (typeof STATUTS_SEED_RESERVATIONS)[number]
  }> = []
  for (let i = 0; i < 23; i++) {
    const n = String(i).padStart(2, '0')
    lignes.push({
      companyId: ccdpaa,
      nom: `Client Resa ${n} ${marker}`,
      email: `resa-${n}-${marker}@example.test`,
      telephone: `514-555-01${n}`,
      nombrePersonnes: (i % 6) + 1,
      dateReservation: instantQuebec(ajouterJoursIso(aujourdHui, 2 + i), HEURE_SEED_RESERVATIONS),
      notes: i % 4 === 0 ? `Note e2e ${marker} #${n}.` : null,
      statut: STATUTS_SEED_RESERVATIONS[i % STATUTS_SEED_RESERVATIONS.length]!,
    })
  }
  const creneauCouple = instantQuebec(ajouterJoursIso(aujourdHui, 26), HEURE_SEED_RESERVATIONS)
  for (const statut of ['ANNULEE', 'EN_ATTENTE'] as const) {
    lignes.push({
      companyId: ccdpaa,
      nom: `Client Resa Couple ${marker}`,
      email: `resa-23-${marker}@example.test`,
      telephone: '514-555-0199',
      nombrePersonnes: 2,
      dateReservation: creneauCouple,
      notes: null,
      statut,
    })
  }
  // ANNULEE isolée (aucune ligne active sur ce courriel/créneau) : réactivation légale → 200.
  lignes.push({
    companyId: ccdpaa,
    nom: `Client Resa Solo ${marker}`,
    email: `resa-24-${marker}@example.test`,
    telephone: '514-555-0198',
    nombrePersonnes: 3,
    dateReservation: instantQuebec(ajouterJoursIso(aujourdHui, 18), HEURE_SEED_RESERVATIONS),
    notes: null,
    statut: 'ANNULEE',
  })
  // Ligne d'une autre filiale : hors scope du module réservations (PATCH → 404, jamais listée).
  lignes.push({
    companyId: entretien,
    nom: `Client Resa Autre ${marker}`,
    email: `resa-autre-${marker}@example.test`,
    telephone: '514-555-0197',
    nombrePersonnes: 2,
    dateReservation: instantQuebec(ajouterJoursIso(aujourdHui, 12), HEURE_SEED_RESERVATIONS),
    notes: null,
    statut: 'EN_ATTENTE',
  })
  const res = await prisma.reservationRestaurant.createMany({ data: lignes })
  console.log(`Reservations seedées pour ${marker} : lignes=${res.count} (dont couple ANNULEE/EN_ATTENTE même créneau)`)
}

async function purgerReservations(marker: string): Promise<void> {
  const res = await prisma.reservationRestaurant.deleteMany({
    where: { email: { endsWith: `-${marker}@example.test`, mode: 'insensitive' } },
  })
  console.log(`Purge reservations ${marker} : lignes=${res.count}`)
}

// Lot 5 (e2e admin planning) : 3 employés transport — Un/Deux actifs + Inactif (actif=false, pour
// le 400 du POST et le badge) — et 3 quarts sur la semaine courante : lundi 08:00–16:00 et
// mercredi 09:30–17:30 (Un), nuit dimanche 22:00→06:00 lendemain (Deux). La purge supprime les
// employés par e-mail (les quarts partent en cascade Prisma) et les quarts de titre
// `[E2E <m>]…` (ceux posés par les tests via l'API sur des employés seedés hors marqueur).
const POSTES_SEED_PLANNING = ['Chauffeur classe 1', 'Manutentionnaire', 'Agent logistique'] as const

async function semerPlanning(marker: string): Promise<void> {
  const transport = await companyId('transport')
  const lundi = lundiDeSemaineQuebec()
  const suffixe = `-${marker}@example.test`
  const noms = [`Planning E2E Un ${marker}`, `Planning E2E Deux ${marker}`, `Planning E2E Inactif ${marker}`]
  await prisma.employe.createMany({
    data: noms.map((nom, i) => ({
      companyId: transport,
      nom,
      poste: POSTES_SEED_PLANNING[i]!,
      email: `planning-${i}${suffixe}`,
      actif: i !== 2,
    })),
  })
  const [un, deux] = await Promise.all([
    prisma.employe.findFirstOrThrow({ where: { companyId: transport, email: `planning-0${suffixe}` }, select: { id: true } }),
    prisma.employe.findFirstOrThrow({ where: { companyId: transport, email: `planning-1${suffixe}` }, select: { id: true } }),
  ])
  await prisma.planningEntry.createMany({
    data: [
      {
        companyId: transport,
        employeId: un.id,
        titre: 'Tournée e2e',
        lieu: `Entrepôt E2E ${marker}`,
        dateDebut: instantQuebec(lundi, '08:00'),
        dateFin: instantQuebec(lundi, '16:00'),
      },
      {
        companyId: transport,
        employeId: un.id,
        titre: null,
        lieu: `Entrepôt E2E ${marker}`,
        dateDebut: instantQuebec(ajouterJoursIso(lundi, 2), '09:30'),
        dateFin: instantQuebec(ajouterJoursIso(lundi, 2), '17:30'),
      },
      {
        companyId: transport,
        employeId: deux.id,
        titre: 'Nuit e2e',
        lieu: `Entrepôt E2E ${marker}`,
        dateDebut: instantQuebec(ajouterJoursIso(lundi, 6), '22:00'),
        dateFin: instantQuebec(ajouterJoursIso(lundi, 7), '06:00'),
      },
    ],
  })
  console.log(`Planning seedé pour ${marker} : employés=3 (dont 1 inactif), quarts=3 (dont une nuit 22:00→06:00 lendemain)`)
}

async function purgerPlanning(marker: string): Promise<void> {
  const suffixe = { endsWith: `-${marker}@example.test`, mode: 'insensitive' as const }
  const employes = await prisma.employe.deleteMany({ where: { email: suffixe } })
  const quarts = await prisma.planningEntry.deleteMany({
    where: { titre: { startsWith: `[E2E ${marker}]`, mode: 'insensitive' } },
  })
  console.log(`Purge planning ${marker} : employés=${employes.count} (quarts en cascade), quarts titre marqué=${quarts.count}`)
}

async function compterPlanning(marker: string): Promise<void> {
  const suffixe = { endsWith: `-${marker}@example.test`, mode: 'insensitive' as const }
  const employes = await prisma.employe.count({ where: { email: suffixe } })
  const quarts = await prisma.planningEntry.count({
    where: { OR: [{ employe: { email: suffixe } }, { titre: { startsWith: `[E2E ${marker}]`, mode: 'insensitive' } }] },
  })
  console.log(`COUNT_PLANNING=employes:${employes},quarts:${quarts}`)
}

// Lot 5 (e2e admin paramètres) : compte EMPLOYE dédié, seul MUTÉ (mot de passe) par la suite
// admin-parametres — muter un compte seedé partagé casserait les autres specs en cas d'échec
// entre deux changements (D6). Même driver de hash que prisma/seed/accounts.ts (`#auth-utils`
// ne résout pas hors Nitro) : le hash produit est vérifié par `verifyPassword` au login.
// Partagé avec le seed des 3 comptes du lot 6 (`--seed-comptes`) : même driver, même sémantique.
const hasherComptesDeTest = new Hash(new Scrypt({}))

async function semerCompteMdp(marker: string): Promise<void> {
  const entretien = await companyId('entretien')
  const email = `parametres-${marker}@example.test`
  const nom = `Paramètres E2E ${marker}`
  // Mot de passe GÉNÉRÉ, jamais écrit en dur (convention tests/e2e/helpers/auth.ts) : il est
  // remonté au test via l'impression `MDP_E2E=` (motif `OFFRE_UUID=`).
  const motDePasse = randomBytes(16).toString('hex')
  const passwordHash = await hasherComptesDeTest.make(motDePasse)
  // `update` recalcule le hash à chaque appel : un run avorté (compte déjà créé avec le hash
  // d'un run précédent, dont le mdp n'est plus connu) redevient prévisible.
  await prisma.user.upsert({
    where: { email },
    update: { nom, role: Role.EMPLOYE, companyId: entretien, actif: true, passwordHash },
    create: { email, nom, role: Role.EMPLOYE, companyId: entretien, passwordHash },
  })
  console.log(`Compte mdp ${marker} : ${email} (EMPLOYE, entretien), hash mis à jour`)
  console.log(`MDP_E2E=${motDePasse}`)
}

async function purgerCompteMdp(marker: string): Promise<void> {
  const res = await prisma.user.deleteMany({ where: { email: `parametres-${marker}@example.test` } })
  console.log(`Purge compte mdp ${marker} : users=${res.count}`)
}

// Lot 6 (e2e admin utilisateurs) : 3 comptes dédiés, SEULS mutés par la suite admin-utilisateurs
// (rôle, actif, mot de passe) — jamais `admin@groupecd.ca` ni les comptes seedés partagés.
// Mots de passe GÉNÉRÉS, remontés uniquement via `COMPTES_MDP_JSON=` (jamais écrits en dur).
interface CompteE2E {
  email: string
  motDePasse: string
}
interface ComptesSemes {
  emp: CompteE2E
  af: CompteE2E
  sa: CompteE2E
}

async function semerComptes(marker: string): Promise<void> {
  const [entretien, transport] = await Promise.all([companyId('entretien'), companyId('transport')])
  const comptes: ComptesSemes = {
    emp: { email: `comptes-emp-${marker}@example.test`, motDePasse: randomBytes(16).toString('hex') },
    af: { email: `comptes-af-${marker}@example.test`, motDePasse: randomBytes(16).toString('hex') },
    sa: { email: `comptes-sa-${marker}@example.test`, motDePasse: randomBytes(16).toString('hex') },
  }
  const defs = [
    { compte: comptes.emp, nom: `Comptes EMP E2E ${marker}`, role: Role.EMPLOYE, cid: entretien },
    { compte: comptes.af, nom: `Comptes AF E2E ${marker}`, role: Role.ADMIN_FILIALE, cid: transport },
    { compte: comptes.sa, nom: `Comptes SA E2E ${marker}`, role: Role.SUPER_ADMIN, cid: null },
  ] as const
  for (const { compte, nom, role, cid } of defs) {
    // `update` recalcule le hash à chaque appel : un run avorté redevient prévisible.
    const passwordHash = await hasherComptesDeTest.make(compte.motDePasse)
    await prisma.user.upsert({
      where: { email: compte.email },
      update: { nom, role, companyId: cid, actif: true, passwordHash },
      create: { email: compte.email, nom, role, companyId: cid, passwordHash },
    })
  }
  console.log(`Comptes ${marker} : emp/af/sa semés, hash mis à jour`)
  console.log(`COMPTES_MDP_JSON=${JSON.stringify(comptes)}`)
}

async function purgerComptes(marker: string): Promise<void> {
  // Suffisant pour les 3 comptes semés ET les comptes créés par les tests via l'API dont l'e-mail
  // finit par `-{marker}@example.test` (comptes-nouveau[-sa]-<m>…).
  const res = await prisma.user.deleteMany({
    where: { email: { endsWith: `-${marker}@example.test`, mode: 'insensitive' } },
  })
  console.log(`Purge comptes ${marker} : users=${res.count}`)
}

async function purgerCompte(email: string): Promise<void> {
  const res = await prisma.user.deleteMany({ where: { email } })
  console.log(`Purge compte ${email} : users=${res.count}`)
}

const NOMBRE_MESSAGES_PAGINATION = 25
const MINUTE_MS = 60_000

async function companyId(slug: string): Promise<number> {
  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true } })
  if (!company) throw new Error(`Filiale ${slug} introuvable`)
  return company.id
}

async function seedAdminMessages(marker: string): Promise<void> {
  const [entretien, transport, holding, ccdpaa] = await Promise.all(
    ['entretien', 'transport', 'holding', 'ccdpaa'].map((slug) => companyId(slug)),
  )
  const now = Date.now()
  const pagination = Array.from({ length: NOMBRE_MESSAGES_PAGINATION }, (_, i) => {
    const n = String(i + 1).padStart(2, '0')
    return {
      companyId: entretien,
      nom: `Pagination ${n}`,
      email: `pag-${n}-${marker}@example.test`,
      sujet: `Pagination ${marker}`,
      message: `Message de pagination numéro ${n}.`,
      createdAt: new Date(now - (i + 10) * MINUTE_MS),
    }
  })
  await prisma.messageContact.createMany({ data: pagination })
  await prisma.messageContact.createMany({
    data: [
      {
        companyId: transport,
        nom: 'Jean Transport',
        email: `transport-${marker}@example.test`,
        telephone: '514-555-0123',
        entreprise: 'Entreprise Test E2E',
        sujet: 'Demande de devis — transport',
        message: 'Besoin de déménager nos bureaux.',
        details: {
          typeTransport: 'demenagement-commercial',
          dateSouhaitee: '2026-11-12',
          origine: 'Montréal',
          destination: 'Laval',
          formulaire: 'transport',
        },
        createdAt: new Date(now - 2 * MINUTE_MS),
      },
      {
        companyId: holding,
        nom: 'Holding Contact',
        email: `holding-${marker}@example.test`,
        sujet: 'Demande — Groupe (via le site du groupe)',
        message: 'Question générale pour le groupe.',
        details: { formulaire: 'holding' },
        createdAt: new Date(now - 3 * MINUTE_MS),
      },
      {
        companyId: ccdpaa,
        nom: 'Suggestion Produit',
        email: `suggestion-${marker}@example.test`,
        sujet: 'Suggestion de produit',
        message: 'Demande de suggestion e2e.',
        type: 'SUGGESTION_PRODUIT' as const,
        produitSouhaite: 'Karité brut E2E',
        paysOrigine: 'Mali',
        details: { formulaire: 'suggestion' },
        createdAt: new Date(now - 4 * MINUTE_MS),
      },
      {
        companyId: entretien,
        nom: 'Casse Client',
        email: `Client.Casse-${marker}@Example.TEST`,
        sujet: 'Conversion e2e (courriel en casse mixte)',
        message: 'Message dont le courriel a des majuscules.',
        details: { formulaire: 'entretien' },
        createdAt: new Date(now - 6 * MINUTE_MS),
      },
      {
        companyId: ccdpaa,
        nom: 'Contact Ccdpaa',
        email: `ccdpaa-${marker}@example.test`,
        sujet: 'Contact ccdpaa e2e',
        message: 'Message ccdpaa hors périmètre entretien.',
        details: { formulaire: 'ccdpaa' },
        createdAt: new Date(now - 5 * MINUTE_MS),
      },
    ],
  })
  console.log(`Messages admin créés pour ${marker} : ${pagination.length + 5}`)
}

async function main() {
  const candidatureEmails = argValues('--candidature-email')
  const reservationEmails = argValues('--reservation-email')
  const offreTitres = argValues('--offre-titre')
  const creerOffre = argValues('--creer-offre')
  const retirerOffre = argValues('--retirer-offre')
  const inspectCandidature = argValues('--inspect-candidature-email')
  const inspectReservation = argValues('--inspect-reservation-email')
  const countFichiers = process.argv.includes('--count-fichiers-placement')
  const seedAdminMessagesArgs = argValues('--seed-admin-messages')
  const seedDossier = argValues('--seed-dossier')
  const purgeAdmin = argValues('--purge-admin-data')
  const seedPlacementArgs = argValues('--seed-placement')
  const purgePlacementArgs = argValues('--purge-placement')
  const seedReservationsArgs = argValues('--seed-reservations')
  const purgeReservationsArgs = argValues('--purge-reservations')
  const countReservationsArgs = argValues('--count-reservations')
  const seedPlanningArgs = argValues('--seed-planning')
  const purgePlanningArgs = argValues('--purge-planning')
  const countPlanningArgs = argValues('--count-planning')
  const seedCompteMdpArgs = argValues('--seed-compte-mdp')
  const purgeCompteMdpArgs = argValues('--purge-compte-mdp')
  const seedComptesArgs = argValues('--seed-comptes')
  const purgeComptesArgs = argValues('--purge-comptes')
  const purgeCompteArgs = argValues('--purge-compte')

  for (const marker of seedAdminMessagesArgs) await seedAdminMessages(marker)
  for (const marker of seedPlacementArgs) await semerPlacement(marker)
  for (const marker of purgePlacementArgs) await purgerPlacement(marker)
  for (const marker of seedReservationsArgs) await semerReservations(marker)
  for (const marker of purgeReservationsArgs) await purgerReservations(marker)
  for (const marker of seedPlanningArgs) await semerPlanning(marker)
  for (const marker of purgePlanningArgs) await purgerPlanning(marker)
  for (const marker of countPlanningArgs) await compterPlanning(marker)
  for (const marker of seedCompteMdpArgs) await semerCompteMdp(marker)
  for (const marker of purgeCompteMdpArgs) await purgerCompteMdp(marker)
  for (const marker of seedComptesArgs) await semerComptes(marker)
  for (const marker of purgeComptesArgs) await purgerComptes(marker)
  for (const email of purgeCompteArgs) await purgerCompte(email)
  for (const suffixe of countReservationsArgs) {
    const n = await prisma.reservationRestaurant.count({ where: { email: { endsWith: suffixe, mode: 'insensitive' } } })
    console.log(`COUNT_RESERVATIONS=${n}`)
  }
  for (const email of seedDossier) {
    const client = await prisma.client.findFirst({ where: { email }, select: { id: true } })
    if (!client) throw new Error('Client introuvable pour le dossier de test')
    await prisma.dossierComptable.create({ data: { clientId: client.id } })
    console.log('DossierComptable créé : 1')
  }
  for (const marker of purgeAdmin) {
    const suffixe = { endsWith: `-${marker}@example.test`, mode: 'insensitive' as const }
    const clients = await prisma.client.deleteMany({ where: { email: suffixe } })
    const messages = await prisma.messageContact.deleteMany({ where: { email: suffixe } })
    console.log(`Purge ${marker} : clients=${clients.count}, messages=${messages.count}`)
  }

  if (creerOffre.length) {
    const placement = await prisma.company.findUnique({ where: { slug: 'placement' }, select: { id: true } })
    if (!placement) throw new Error('Filiale placement introuvable')
    const offre = await prisma.demandeClient.create({
      data: {
        companyId: placement.id,
        entrepriseCliente: `Client Secret ${MARQUEUR_OFFRE_TEST}`,
        posteRecherche: 'Manutentionnaire e2e',
        categorie: 'MANUTENTION',
        contactNom: 'Contact Secret E2E',
        contactEmail: 'contact-secret-e2e@example.test',
        contactTelephone: '514-555-0199',
        description: 'Description interne e2e (ne doit jamais être publique).',
        publiee: true,
        statut: 'OUVERTE',
        titreOffre: creerOffre[0],
        lieu: 'Laval (Québec)',
        typeContrat: 'TEMPS_PLEIN',
        salaire: '22 $/h',
        descriptionPublique: 'Poste de test créé par la suite e2e placement-offres.',
        publieeLe: new Date(),
      },
      select: { uuid: true },
    })
    console.log(`OFFRE_UUID=${offre.uuid}`)
  }
  if (retirerOffre.length) {
    const res = await prisma.demandeClient.updateMany({ where: { uuid: { in: retirerOffre } }, data: { publiee: false } })
    console.log(`Offres dépubliées : ${res.count}`)
  }
  if (inspectCandidature.length) {
    const rows = await prisma.candidature.findMany({
      where: { email: { in: inspectCandidature } },
      select: {
        posteRecherche: true, posteAutrePrecision: true, categorie: true, consentementLe: true, statut: true, pays: true,
        cvKey: true, autresDocumentsKeys: true, demande: { select: { uuid: true } },
        cv: { select: { visibilite: true, mimeType: true, nomOriginal: true, company: { select: { slug: true } } } },
      },
    })
    console.log(`INSPECT_JSON=${JSON.stringify(rows)}`)
  }
  if (inspectReservation.length) {
    const rows = await prisma.reservationRestaurant.findMany({
      where: { email: { in: inspectReservation } },
      select: { uuid: true, nombrePersonnes: true, dateReservation: true, statut: true, notes: true },
    })
    console.log(`INSPECT_JSON=${JSON.stringify(rows)}`)
  }
  if (countFichiers) {
    const placement = await prisma.company.findUnique({ where: { slug: 'placement' }, select: { id: true } })
    const n = placement ? await prisma.fichier.count({ where: { companyId: placement.id } }) : 0
    console.log(`COUNT_FICHIERS=${n}`)
  }

  if (candidatureEmails.length) {
    await supprimerCandidatures({ email: { in: candidatureEmails } })
  }
  if (reservationEmails.length) {
    const res = await prisma.reservationRestaurant.deleteMany({ where: { email: { in: reservationEmails } } })
    console.log(`ReservationRestaurant supprimées : ${res.count}`)
  }
  if (offreTitres.length) {
    const offres = await prisma.demandeClient.findMany({
      where: { titreOffre: { in: offreTitres }, entrepriseCliente: { contains: MARQUEUR_OFFRE_TEST } },
      select: { id: true },
    })
    const ids = offres.map((o) => o.id)
    if (ids.length) await supprimerCandidatures({ demandeId: { in: ids } })
    const res = await prisma.demandeClient.deleteMany({ where: { id: { in: ids } } })
    console.log(`DemandeClient (offres de test) supprimées : ${res.count}`)
  }

  const messageUuids = argValues('--message-uuid')
  const fileKeys = argValues('--file-key')
  const contactEmails = argValues('--contact-email')

  if (messageUuids.length) {
    const res = await prisma.messageContact.deleteMany({ where: { uuid: { in: messageUuids } } })
    console.log(`MessageContact supprimés par uuid : ${res.count}`)
  }
  if (contactEmails.length) {
    const res = await prisma.messageContact.deleteMany({ where: { email: { in: contactEmails } } })
    console.log(`MessageContact supprimés par email : ${res.count}`)
  }
  if (fileKeys.length) {
    const uploadsDir = process.env.NUXT_UPLOADS_DIR ?? join(process.cwd(), 'storage', 'uploads')
    for (const key of fileKeys) {
      const res = await prisma.fichier.deleteMany({ where: { key } })
      const filePath = join(uploadsDir, key)
      const existed = existsSync(filePath)
      if (existed) rmSync(filePath)
      console.log(`Fichier ${key} : lignes DB supprimées=${res.count}, fichier disque supprimé=${existed}`)
    }
  }

  const aFaitQuelqueChose =
    messageUuids.length || contactEmails.length || fileKeys.length || candidatureEmails.length || reservationEmails.length ||
    offreTitres.length || creerOffre.length || retirerOffre.length || inspectCandidature.length || inspectReservation.length || countFichiers ||
    seedAdminMessagesArgs.length || seedDossier.length || purgeAdmin.length || seedPlacementArgs.length || purgePlacementArgs.length ||
    seedReservationsArgs.length || purgeReservationsArgs.length || countReservationsArgs.length ||
    seedPlanningArgs.length || purgePlanningArgs.length || countPlanningArgs.length ||
    seedCompteMdpArgs.length || purgeCompteMdpArgs.length ||
    seedComptesArgs.length || purgeComptesArgs.length || purgeCompteArgs.length
  if (!aFaitQuelqueChose) {
    console.log('Rien à nettoyer (aucun argument reconnu fourni).')
  }
}

main()
  .catch((err) => {
    console.error('ERREUR cleanup-test-data.ts:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
