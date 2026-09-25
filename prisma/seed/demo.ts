// Données opérationnelles de démonstration (spec §3.4) — appelé UNIQUEMENT si
// `SEED_DEMO_DATA=true` (voir prisma/seed.ts). Amorçage par entité : chaque sous-fonction
// vérifie l'existence avant de créer, jamais de mise à jour d'une ligne existante.
import { StatutDemande, TypeMessage, type PrismaClient } from '../../server/generated/prisma/client'
import { GENERATED } from '../seed-data/prototype.generated'
import { seedFakeCv } from './fichiers'
import {
  dateISOEnMontreal,
  decalerJours,
  inferCategoriePoste,
  inferNiveauExperience,
  jourSemaineVersDates,
  mapActifEmploye,
  mapCategoriePoste,
  mapForfaitComptable,
  mapOrigineCandidat,
  mapStatutCandidat,
  mapStatutCandidature,
  mapStatutClient,
  mapStatutDemande,
  mapStatutDossier,
  mapStatutMessage,
  mapStatutReservation,
  mapTypeContrat,
  montrealDateHeureToUtc,
} from './lib/mappings'
import type { SeededCompanies } from './companies'

const MANDAT_INTERNE_PREFIX = 'Mandat interne — '
const RECONTACT_INTERNE = { contactNom: 'Placement CD Pro', contactEmail: 'placement@groupe-cd.ca' } as const

function companyId(companies: SeededCompanies, slug: string): number {
  const company = companies.bySlug.get(slug)
  if (!company) throw new Error(`Filiale "${slug}" introuvable pour le seed de démo`)
  return company.id
}

export async function seedDemo(prisma: PrismaClient, companies: SeededCompanies, reference: Date = new Date()): Promise<void> {
  await seedMessages(prisma, companies)
  await seedSuggestions(prisma, companies)
  await seedReservations(prisma, companies, reference)
  await seedEmployes(prisma, companies)
  await seedPlanning(prisma, companies, reference)
  await seedClients(prisma, companies)
  await seedClientsComptables(prisma, companies)
  await seedCandidats(prisma, companies)
  const demandeIdByTitreOffre = await seedDemandesEtOffres(prisma, companies)
  await seedCandidatures(prisma, companies, demandeIdByTitreOffre)
}

async function seedMessages(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  for (const m of GENERATED.demo.messages) {
    const cId = companyId(companies, m.filiale)
    const exists = await prisma.messageContact.findFirst({ where: { companyId: cId, email: m.email, type: TypeMessage.CONTACT } })
    if (exists) continue
    await prisma.messageContact.create({
      data: {
        companyId: cId,
        type: TypeMessage.CONTACT,
        nom: m.nom,
        email: m.email,
        telephone: m.telephone,
        sujet: m.sujet,
        message: m.message,
        statut: mapStatutMessage(m.statut),
      },
    })
  }
}

async function seedSuggestions(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  for (const s of GENERATED.demo.suggestions) {
    const cId = companyId(companies, s.filiale)
    const exists = await prisma.messageContact.findFirst({ where: { companyId: cId, email: s.email, type: TypeMessage.SUGGESTION_PRODUIT } })
    if (exists) continue
    await prisma.messageContact.create({
      data: {
        companyId: cId,
        type: TypeMessage.SUGGESTION_PRODUIT,
        nom: s.nom,
        email: s.email,
        sujet: `Suggestion : ${s.produit}`,
        message: s.commentaire,
        produitSouhaite: s.produit,
        paysOrigine: s.origine,
      },
    })
  }
}

async function seedReservations(prisma: PrismaClient, companies: SeededCompanies, reference: Date): Promise<void> {
  const cId = companyId(companies, 'ccdpaa')
  // Dates obsolètes dans le prototype (mockdata figé) : recalées sur J+7 / J+9 / J+15 par
  // rapport à la date du seed (spec §3.4), et non reprises telles quelles.
  const decalages = [7, 9, 15]

  for (const [index, r] of GENERATED.demo.reservations.entries()) {
    const exists = await prisma.reservationRestaurant.findFirst({ where: { companyId: cId, email: r.email, telephone: r.telephone } })
    if (exists) continue

    const decalage = decalages[index % decalages.length]
    const dateISO = dateISOEnMontreal(decalerJours(reference, decalage))
    const dateReservation = montrealDateHeureToUtc(dateISO, r.heure)

    await prisma.reservationRestaurant.create({
      data: {
        companyId: cId,
        nom: r.nom,
        email: r.email,
        telephone: r.telephone,
        nombrePersonnes: r.personnes,
        dateReservation,
        notes: r.note,
        statut: mapStatutReservation(r.statut),
      },
    })
  }
}

async function seedEmployes(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  for (const e of GENERATED.demo.employes) {
    const cId = companyId(companies, e.filiale)
    const exists = await prisma.employe.findFirst({ where: { companyId: cId, nom: e.nom } })
    if (exists) continue

    // DEC-29 : l'employé "Awa Diallo" (entretien) est lié au compte User EMPLOYE correspondant.
    let userId: number | null = null
    if (e.filiale === 'entretien' && e.nom === 'Awa Diallo') {
      const user = await prisma.user.findUnique({ where: { email: 'employe@entretien.groupecd.ca' }, select: { id: true } })
      userId = user?.id ?? null
    }

    await prisma.employe.create({
      data: { companyId: cId, userId, nom: e.nom, poste: e.poste, email: e.email, actif: mapActifEmploye(e.statut) },
    })
  }
}

async function seedPlanning(prisma: PrismaClient, companies: SeededCompanies, reference: Date): Promise<void> {
  for (const p of GENERATED.demo.planningEntries) {
    const cId = companyId(companies, p.employeFiliale)
    const employe = await prisma.employe.findFirst({ where: { companyId: cId, nom: p.employeNom }, select: { id: true } })
    if (!employe) {
      console.warn(`[seed/demo] planningEntries : employé "${p.employeNom}" (${p.employeFiliale}) introuvable, entrée ignorée`)
      continue
    }

    const { dateDebut, dateFin } = jourSemaineVersDates(reference, p.jour, p.debut, p.fin)
    const exists = await prisma.planningEntry.findFirst({ where: { employeId: employe.id, dateDebut, lieu: p.lieu } })
    if (exists) continue

    await prisma.planningEntry.create({
      data: { companyId: cId, employeId: employe.id, lieu: p.lieu, dateDebut, dateFin, notes: p.note },
    })
  }
}

async function seedClients(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  for (const c of GENERATED.demo.clients) {
    const cId = companyId(companies, c.filiale)
    await prisma.client.upsert({
      where: { companyId_email: { companyId: cId, email: c.email } },
      update: {},
      create: {
        companyId: cId,
        nom: c.nom,
        entreprise: c.entreprise,
        email: c.email,
        telephone: c.telephone,
        statut: mapStatutClient(c.statut),
        notes: c.notes,
        dateAjout: new Date(c.creeLe),
      },
    })
  }
}

async function seedClientsComptables(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  const cId = companyId(companies, 'comptable')
  for (const c of GENERATED.demo.clientsComptables) {
    // Dédoublonnage par e-mail et par filiale (spec §3.4) : "Atelier EG" existe déjà comme
    // Client (créé par seedClients depuis mockdata.clients) — on réutilise cette même fiche
    // plutôt que d'en créer une seconde.
    const client = await prisma.client.upsert({
      where: { companyId_email: { companyId: cId, email: c.email } },
      update: {},
      create: { companyId: cId, nom: c.contact, entreprise: c.entreprise, email: c.email, statut: 'CLIENT_ACTIF' },
      select: { id: true },
    })

    const existingDossier = await prisma.dossierComptable.findUnique({ where: { clientId: client.id } })
    if (existingDossier) continue

    await prisma.dossierComptable.create({
      data: {
        clientId: client.id,
        forfait: mapForfaitComptable(c.forfait),
        statut: mapStatutDossier(c.statut),
        echeance: new Date(c.prochaineEcheance),
        notes: c.notes,
      },
    })
  }
}

async function seedCandidats(prisma: PrismaClient, companies: SeededCompanies): Promise<void> {
  const cId = companyId(companies, 'placement')
  for (const c of GENERATED.demo.candidats) {
    await prisma.candidat.upsert({
      where: { companyId_email: { companyId: cId, email: c.email } },
      update: {},
      create: {
        companyId: cId,
        nomComplet: c.nom,
        email: c.email,
        telephone: c.telephone,
        posteRecherche: c.poste,
        categorie: mapCategoriePoste(c.categorie),
        disponibilite: c.disponibilite,
        statut: mapStatutCandidat(c.statut),
        origine: mapOrigineCandidat(c.origine),
      },
    })
  }
}

/** Retourne l'id interne de la DemandeClient créée pour chaque offre publiée, indexé par titre —
 * consommé par seedCandidatures pour relier une candidature à l'offre visée. */
async function seedDemandesEtOffres(prisma: PrismaClient, companies: SeededCompanies): Promise<Map<string, number>> {
  const cId = companyId(companies, 'placement')
  const demandeIdByTitreOffre = new Map<string, number>()

  for (const d of GENERATED.demo.demandesClients) {
    const exists = await prisma.demandeClient.findFirst({ where: { companyId: cId, contactEmail: d.email, posteRecherche: d.poste } })
    if (exists) continue
    await prisma.demandeClient.create({
      data: {
        companyId: cId,
        entrepriseCliente: d.entreprise,
        posteRecherche: d.poste,
        categorie: mapCategoriePoste(d.categorie),
        contactNom: d.contact,
        contactEmail: d.email,
        nombrePostes: d.quantite,
        dateDebut: new Date(d.debut),
        description: `Demande de personnel — ${d.poste} (${d.quantite}).`,
        statut: mapStatutDemande(d.statut),
        publiee: false,
      },
    })
  }

  for (const o of GENERATED.demo.offresEmploi) {
    const existing = await prisma.demandeClient.findFirst({ where: { companyId: cId, titreOffre: o.titre }, select: { id: true } })
    if (existing) {
      demandeIdByTitreOffre.set(o.titre, existing.id)
      continue
    }

    // Les 4 offres du prototype deviennent des demandes publiées, jamais exposées comme
    // provenant d'un client réel (spec §3.4) : entreprise cliente interne, jamais affichée
    // publiquement (seul `titreOffre`/`descriptionPublique` sont publics).
    const created = await prisma.demandeClient.create({
      data: {
        companyId: cId,
        entrepriseCliente: `${MANDAT_INTERNE_PREFIX}${o.titre}`,
        posteRecherche: o.titre,
        categorie: mapCategoriePoste(o.categorie),
        contactNom: RECONTACT_INTERNE.contactNom,
        contactEmail: RECONTACT_INTERNE.contactEmail,
        nombrePostes: 1,
        description: o.description,
        statut: StatutDemande.OUVERTE,
        titreOffre: o.titre,
        lieu: o.lieu,
        typeContrat: mapTypeContrat(o.typeContrat),
        salaire: o.salaire,
        descriptionPublique: o.description,
        publiee: o.publiee,
        publieeLe: o.publiee ? new Date(o.date) : null,
      },
      select: { id: true },
    })
    demandeIdByTitreOffre.set(o.titre, created.id)
  }

  return demandeIdByTitreOffre
}

async function seedCandidatures(
  prisma: PrismaClient,
  companies: SeededCompanies,
  demandeIdByTitreOffre: ReadonlyMap<string, number>,
): Promise<void> {
  const cId = companyId(companies, 'placement')
  for (const c of GENERATED.demo.candidatures) {
    const exists = await prisma.candidature.findFirst({ where: { companyId: cId, email: c.email, posteRecherche: c.posteVise } })
    if (exists) continue

    const cvKey = await seedFakeCv(prisma, cId, c.cvNom ?? `cv-${c.nom}.pdf`)
    const demandeId = c.offreTitre ? (demandeIdByTitreOffre.get(c.offreTitre) ?? null) : null

    await prisma.candidature.create({
      data: {
        companyId: cId,
        demandeId,
        nomComplet: c.nom,
        email: c.email,
        telephone: c.telephone,
        // Aucune adresse réelle dans le prototype : donnée de démonstration explicite,
        // jamais une fausse adresse crédible (Loi 25 — pas de PII inventée).
        adresseComplete: 'Adresse de démonstration',
        posteRecherche: c.posteVise,
        categorie: inferCategoriePoste(c.posteVise),
        experience: inferNiveauExperience(c.experience),
        pays: 'Canada',
        message: c.experience,
        cvKey,
        autresDocumentsKeys: [],
        statut: mapStatutCandidature(c.statut),
        consentementLe: new Date(c.date),
        dateEnvoi: new Date(c.date),
      },
    })
  }
}
