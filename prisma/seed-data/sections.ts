// Valeurs PAR DÉFAUT du catalogue de sections (shared/content/sections/catalog.ts) — écrites à
// la main, PAS générées (spec phase 2 §3.2/§3.3). Chaque valeur est relue par
// prisma/seed/sections.ts via le schéma zod de son type (shared/content/sections/types.ts) avant
// toute écriture — une valeur qui ne passe pas son schéma fait échouer le seed bruyamment.
//
// Sources : prototype_react/cd-holding-nexus/src/data/mockdata.ts,
// .../components/subsidiary/subConfig.ts, et les routes/composants cités ligne par ligne.
// Corrections client appliquées ici (CONVERSION_INVENTORY.md, PROJECT_STATE.md "Décisions
// verrouillées") : supermarchés (entretien), pitch comptable aligné sur PROJECT_CONTEXT §2,
// libellé de suggestion Q-11, pas de promesse de courriel non tenue (Q-10).
//
// Import relatif uniquement (exécuté par tsx hors Nuxt — contrainte seed, CLAUDE.md).
import type { FilialeSlug, SiteSlug } from '../../shared/config/sites'
import { HOLDING_SLUG } from '../../shared/config/sites'

// --- Textes légaux : brouillons internes ------------------------------------------------
// À FAIRE VALIDER PAR UN JURISTE avant mise en production (Loi 25 / RACJ-Éduc'alcool).
// Cette note est un commentaire de code — jamais affichée au public (le champ `donnees` ne
// porte aucun indicateur "brouillon" ; le schéma `legal` est `.strict()`).

const MESSAGE_SUCCES = 'Merci, votre message a bien été reçu. Un courriel de confirmation vous est envoyé.'
const MESSAGE_SUCCES_RESERVATION = 'Merci, votre demande de réservation a bien été reçue. Un courriel de confirmation vous est envoyé.'

type Donnees = Record<string, unknown>

interface FilialeTextes {
  readonly nomCourt: string
  readonly tagline: string
  readonly heroTitre: string
  readonly heroTexte: string
  readonly heroCta: string
  readonly heroImageAlt: string
  readonly servicesTitre: string
  readonly servicesTexte: string
  readonly ctaTitre: string
  readonly ctaTexte: string
  readonly realisationsTitre: string
  readonly histoireP1: string
  readonly histoireP2: string
  readonly contactSurtitre: string
  readonly contactTitre: string
  readonly contactTexte: string
  readonly seo: {
    readonly accueil: { readonly title: string; readonly description: string }
    readonly services: { readonly title: string; readonly description: string }
    readonly realisations: { readonly title: string; readonly description: string }
    readonly aPropos: { readonly title: string; readonly description: string }
    readonly contact: { readonly title: string; readonly description: string }
  }
}

// Source : prototype_react/.../subsidiary/subConfig.ts (SUB_CONFIG), avec corrections client.
const FILIALES: Record<FilialeSlug, FilialeTextes> = {
  entretien: {
    nomCourt: 'Chaudetcha Entretiens',
    tagline: 'Entretien ménager · Montréal',
    // subConfig.ts:38-40 (headlineLead/Accent/Tail)
    heroTitre: 'Des espaces\n*impeccables,*\nsans y penser.',
    // subConfig.ts:42 — corrigé pour mentionner les supermarchés (retour client, Q-05).
    heroTexte:
      "Chaudetcha Entretiens et Sanitations prend soin des bureaux, résidences, supermarchés et chantiers du Grand Montréal. Une équipe formée, un protocole précis, un résultat constant.",
    heroCta: 'Obtenir une soumission', // subConfig.ts:45
    heroImageAlt: 'Équipe Chaudetcha Entretiens au travail',
    servicesTitre: 'Nos prestations d’entretien', // mockdata.ts:158 (pagesContenu id 5)
    servicesTexte:
      'Ménage régulier, grand ménage, entretien de bureaux, désinfection et nettoyage de supermarchés : une équipe stable et des protocoles constants, d’un site à l’autre.',
    ctaTitre: 'Un espace à entretenir ?',
    ctaTexte: 'Décrivez-nous votre besoin, nous revenons vers vous avec une soumission claire.',
    realisationsTitre: 'Réalisations récentes',
    histoireP1:
      'Chaudetcha Entretiens et Sanitations offre des services d’entretien ménager professionnel pour résidences, bureaux, supermarchés et espaces commerciaux à travers le Grand Montréal, avec des protocoles rigoureux et des produits respectueux de l’environnement.',
    // SubAboutPage.tsx:31-35
    histoireP2:
      'Filiale du {groupe}, Chaudetcha Entretiens bénéficie du savoir-faire mutualisé de la holding tout en gardant sa spécialisation métier et son équipe dédiée sur le terrain.',
    contactSurtitre: 'Obtenir une soumission', // subConfig.ts:46
    contactTitre: 'Parlez-nous de\nvotre espace.', // subConfig.ts:47
    contactTexte: 'Répondez à quelques questions, notre équipe revient vers vous avec une soumission claire.',
    seo: {
      accueil: {
        title: 'Chaudetcha Entretiens — Entretien ménager à Montréal',
        description:
          "Entretien de bureaux, résidences, supermarchés et chantiers de construction à Montréal. Équipe formée, protocoles rigoureux, résultat constant.",
      },
      services: {
        title: 'Services d’entretien — Chaudetcha Entretiens',
        description:
          'Entretien de bureaux, résidentiel régulier, nettoyage après construction, désinfection et supermarchés, à Montréal et sa région.',
      },
      realisations: {
        title: 'Réalisations — Chaudetcha Entretiens',
        description: 'Tours de bureaux, chantiers résidentiels, cliniques : nos interventions d’entretien récentes à Montréal.',
      },
      aPropos: {
        title: 'À propos — Chaudetcha Entretiens',
        description: 'L’équipe et les partenaires de Chaudetcha Entretiens et Sanitations, filiale du Groupe CD à Montréal.',
      },
      contact: {
        title: 'Contact — Chaudetcha Entretiens',
        description: 'Demandez une soumission pour l’entretien de vos bureaux, résidence, supermarché ou chantier à Montréal.',
      },
    },
  },
  transport: {
    nomCourt: 'Chaudetcha Transport',
    tagline: 'Transport & logistique · Québec',
    heroTitre: 'Transporter,\n*déménager,*\nlivrer.', // subConfig.ts:62-64
    heroTexte:
      'Une flotte moderne et des équipes assurées pour vos déménagements, votre transport de marchandises et vos livraisons du dernier kilomètre, partout au Québec.',
    heroCta: 'Demander un devis',
    heroImageAlt: 'Camion Chaudetcha Transport et Logistique',
    servicesTitre: 'Solutions de transport', // mockdata.ts:161
    servicesTexte:
      'Déménagement résidentiel et commercial, transport de marchandises et logistique du dernier kilomètre, avec un suivi précis de chaque livraison.',
    ctaTitre: 'Un trajet à planifier ?',
    ctaTexte: 'Décrivez votre besoin, notre répartiteur revient vers vous avec un devis ferme.',
    realisationsTitre: 'Réalisations récentes',
    histoireP1:
      'Chaudetcha Transport et Logistique propose des solutions de transport, de déménagement résidentiel et commercial et de logistique de dernier kilomètre. Une flotte moderne et des équipes assurées livrent partout au Québec.',
    histoireP2:
      'Filiale du {groupe}, Chaudetcha Transport bénéficie du savoir-faire mutualisé de la holding tout en gardant sa spécialisation métier et son équipe dédiée.',
    contactSurtitre: 'Demander un devis',
    contactTitre: 'Décrivez-nous\nvotre trajet.',
    contactTexte: 'Renseignez quelques champs, notre répartiteur revient vers vous avec un devis ferme.',
    seo: {
      accueil: {
        title: 'Chaudetcha Transport — Transport et logistique au Québec',
        description:
          'Déménagement résidentiel et commercial, transport de marchandises et logistique du dernier kilomètre, partout au Québec.',
      },
      services: {
        title: 'Services de transport — Chaudetcha Transport',
        description: 'Déménagement résidentiel et commercial, transport de marchandises, logistique du dernier kilomètre au Québec.',
      },
      realisations: {
        title: 'Réalisations — Chaudetcha Transport',
        description: 'Relocalisations, tournées régulières, livraisons e-commerce : nos réalisations récentes en transport et logistique.',
      },
      aPropos: {
        title: 'À propos — Chaudetcha Transport',
        description: 'L’équipe et les partenaires de Chaudetcha Transport et Logistique, filiale du Groupe CD.',
      },
      contact: {
        title: 'Contact — Chaudetcha Transport',
        description: 'Demandez un devis pour votre déménagement, votre transport de marchandises ou votre livraison au Québec.',
      },
    },
  },
  comptable: {
    nomCourt: 'CD Tenue de Livre',
    tagline: 'Tenue de livres · Québec',
    heroTitre: 'La rigueur\n*comptable,*\nau service de votre PME.', // subConfig.ts:88-90
    // Corrigé (spec §3.3) : aligné sur PROJECT_CONTEXT §2 et les services (T1/T2, création/régularisation).
    heroTexte:
      'CD Tenue de Livre Comptable accompagne les PME et travailleurs autonomes québécois : tenue de livres et paie, états financiers, déclarations T1 et T2, création et régularisation d’entreprise.',
    heroCta: 'Prendre rendez-vous',
    heroImageAlt: 'Bureau de CD Tenue de Livre Comptable',
    servicesTitre: 'Nos services comptables', // mockdata.ts:164
    servicesTexte:
      'Tenue de livres et paie, états financiers, déclarations T1 et T2, création et régularisation d’entreprise : un accompagnement rigoureux, avec la même équipe année après année.',
    ctaTitre: 'Une comptabilité à jour ?',
    ctaTexte: 'Prenez rendez-vous pour un premier appel sans engagement.',
    realisationsTitre: 'Réalisations récentes',
    histoireP1:
      'CD Tenue de Livre Comptable est un cabinet dédié aux PME et travailleurs autonomes québécois : tenue de livres, paie, TPS/TVQ, états financiers, déclarations fiscales, création et régularisation d’entreprise. Rigueur, confidentialité et accompagnement à long terme.',
    histoireP2:
      'Filiale du {groupe}, CD Tenue de Livre Comptable bénéficie du savoir-faire mutualisé de la holding tout en gardant sa spécialisation métier et son équipe dédiée.',
    contactSurtitre: 'Consultation gratuite',
    contactTitre: 'Prenez rendez-vous\navec notre équipe.',
    contactTexte: 'Un premier appel sans engagement, pour comprendre votre situation comptable actuelle.',
    seo: {
      accueil: {
        title: 'CD Tenue de Livre Comptable — Comptabilité au Québec',
        description:
          'Tenue de livres et paie, états financiers, déclarations T1 et T2, création et régularisation d’entreprise, pour PME et travailleurs autonomes.',
      },
      services: {
        title: 'Services comptables — CD Tenue de Livre',
        description: 'Tenue de livres, paie, états financiers, déclarations T1/T2, création et régularisation d’entreprise.',
      },
      realisations: {
        title: 'Réalisations — CD Tenue de Livre',
        description: 'Reprises de dossiers en retard, mise en place de paie, régularisation : nos réalisations comptables récentes.',
      },
      aPropos: {
        title: 'À propos — CD Tenue de Livre Comptable',
        description: 'L’équipe et les partenaires de CD Tenue de Livre Comptable, filiale du Groupe CD à Montréal.',
      },
      contact: {
        title: 'Contact — CD Tenue de Livre Comptable',
        description: 'Prenez rendez-vous pour un premier appel gratuit avec notre équipe de tenue de livres.',
      },
    },
  },
  placement: {
    nomCourt: 'Placement CD Pro',
    tagline: 'Placement · Recrutement international',
    heroTitre: 'Les bonnes personnes,\n*au bon*\nmoment.', // subConfig.ts:113-115
    heroTexte:
      'Placement CD Pro connecte les entreprises canadiennes à des manutentionnaires, chauffeurs et travailleurs étrangers temporaires qualifiés.',
    heroCta: 'Nous contacter',
    heroImageAlt: 'Équipe de Placement CD Pro',
    servicesTitre: 'Nos services de placement',
    servicesTexte:
      'Placement de manutentionnaires et de chauffeurs, recrutement international par le programme des travailleurs étrangers temporaires, et accompagnement personnalisé des candidats.',
    ctaTitre: 'Un besoin en main-d’œuvre ?',
    ctaTexte: 'Écrivez-nous, notre équipe vous oriente vers la bonne ressource.',
    realisationsTitre: 'Réalisations récentes',
    histoireP1:
      'Placement CD Pro est une agence spécialisée dans le recrutement local et le programme des travailleurs étrangers temporaires. Nous connectons les employeurs canadiens à une main-d’œuvre qualifiée et fiable.',
    histoireP2:
      'Filiale du {groupe}, Placement CD Pro bénéficie du savoir-faire mutualisé de la holding tout en gardant sa spécialisation métier et son équipe dédiée.',
    contactSurtitre: 'Vous recrutez',
    contactTitre: 'Parlez-nous de\nvos besoins en personnel.',
    contactTexte:
      'Manutention, transport, recrutement international : décrivez le poste, notre équipe vous rappelle rapidement.',
    seo: {
      accueil: {
        title: 'Placement CD Pro — Placement de personnel au Québec',
        description:
          'Placement local et recrutement international de travailleurs étrangers temporaires pour les employeurs canadiens.',
      },
      services: {
        title: 'Services de placement — Placement CD Pro',
        description: 'Manutentionnaires, chauffeurs, recrutement international (PTET) et accompagnement des candidats.',
      },
      realisations: {
        title: 'Réalisations — Placement CD Pro',
        description: 'Recrutements PTET, placements express en manutention : nos réalisations récentes en placement de personnel.',
      },
      aPropos: {
        title: 'À propos — Placement CD Pro',
        description: 'L’équipe et les partenaires de Placement CD Pro, filiale du Groupe CD spécialisée en recrutement.',
      },
      contact: {
        title: 'Contact — Placement CD Pro',
        description: 'Employeurs ou candidats : contactez Placement CD Pro pour vos besoins de recrutement au Québec.',
      },
    },
  },
  ccdpaa: {
    nomCourt: 'CCDPAA',
    tagline: 'Import-export · Restauration',
    heroTitre: 'De la\n*terre africaine*\nà la table québécoise.', // routes/ccdpaa.index.tsx:24-26
    heroTexte:
      'Deux métiers, un même continent : import de produits agricoles africains vers le Canada, et restaurant panafricain Les Ambassades d’Afrique à Montréal.',
    heroCta: 'Recevoir le catalogue',
    heroImageAlt: 'Produits agricoles importés par CCDPAA',
    servicesTitre: 'Notre catalogue import-export', // routes/ccdpaa.index.tsx:58
    servicesTexte:
      'Produits agricoles, épices et condiments importés d’Afrique de l’Ouest et Centrale, distribués auprès d’épiceries spécialisées, de restaurateurs et de grossistes.',
    ctaTitre: 'Envie de distribuer nos produits ?',
    ctaTexte: 'Écrivez-nous pour recevoir notre catalogue import complet.',
    realisationsTitre: 'Réalisations récentes',
    histoireP1:
      'CCDPAA importe des produits agricoles issus du continent africain et exploite Les Ambassades d’Afrique, un restaurant qui met en valeur ces saveurs. Un pont commercial et culinaire entre l’Afrique et le Québec.',
    histoireP2:
      'Filiale du {groupe}, CCDPAA bénéficie du savoir-faire mutualisé de la holding tout en gardant sa spécialisation métier et son équipe dédiée.',
    contactSurtitre: 'Distribution B2B',
    contactTitre: 'Demandez notre\ncatalogue.',
    contactTexte: 'Épiceries spécialisées, restaurateurs, grossistes : recevez notre catalogue import complet.',
    seo: {
      accueil: {
        title: 'CCDPAA — Import-export et restauration africaine',
        description:
          'Import de produits agricoles d’Afrique et restaurant panafricain Les Ambassades d’Afrique, à Montréal.',
      },
      services: {
        title: 'Catalogue import-export — CCDPAA',
        description: 'Produits agricoles, épices et condiments importés d’Afrique, distribués en épicerie, restauration et gros.',
      },
      realisations: {
        title: 'Réalisations — CCDPAA',
        description: 'Référencements en épiceries spécialisées, ouverture du restaurant : nos réalisations récentes.',
      },
      aPropos: {
        title: 'À propos — CCDPAA',
        description: 'L’équipe et les partenaires de CCDPAA, filiale du Groupe CD spécialisée en import-export et restauration.',
      },
      contact: {
        title: 'Contact — CCDPAA',
        description: 'Demandez notre catalogue import-export ou contactez notre équipe pour toute question.',
      },
    },
  },
  boissons: {
    nomCourt: "CD Boissons d'Afrique",
    tagline: 'Distribution de boissons · Canada',
    heroTitre: 'Les boissons\n*d’Afrique*\nau Canada.', // subConfig.ts:155-157
    heroTexte:
      'Distribution et représentation exclusive au Canada de marques africaines de boissons alcoolisées et non alcoolisées, du SAQ agence au restaurant HoReCa.',
    heroCta: 'Devenir point de vente',
    heroImageAlt: 'Bouteilles de boissons distribuées par CD Boissons d’Afrique',
    servicesTitre: 'Nos services de distribution',
    servicesTexte:
      'Représentation de marques, distribution aux points de vente et au réseau HoReCa, activation de marque : nous installons durablement nos marques sur le marché nord-américain.',
    ctaTitre: 'Devenir point de vente ?',
    ctaTexte: 'Notre équipe commerciale prend contact rapidement.',
    realisationsTitre: 'Réalisations récentes',
    histoireP1:
      'CD Boissons d’Afrique distribue et représente, en exclusivité au Canada, des marques africaines de boissons alcoolisées et non alcoolisées. Nous accompagnons les producteurs sur l’ensemble du marché nord-américain.',
    histoireP2:
      'Filiale du {groupe}, CD Boissons d’Afrique bénéficie du savoir-faire mutualisé de la holding tout en gardant sa spécialisation métier et son équipe dédiée.',
    contactSurtitre: 'Devenir point de vente',
    contactTitre: 'Distribuez nos\nmarques.',
    contactTexte: 'Vous êtes SAQ agence, épicerie, restaurant ou bar ? Notre équipe commerciale prend contact.',
    seo: {
      accueil: {
        title: 'CD Boissons d’Afrique — Distribution au Canada',
        description:
          'Distribution et représentation exclusive au Canada de marques africaines de boissons, alcoolisées et non alcoolisées.',
      },
      services: {
        title: 'Services de distribution — CD Boissons d’Afrique',
        description: 'Représentation de marques, distribution aux points de vente, réseau HoReCa et activation de marque.',
      },
      realisations: {
        title: 'Réalisations — CD Boissons d’Afrique',
        description: 'Lancements de marques, partenariats HoReCa : nos réalisations récentes en distribution de boissons.',
      },
      aPropos: {
        title: 'À propos — CD Boissons d’Afrique',
        description: 'L’équipe et les partenaires de CD Boissons d’Afrique, filiale du Groupe CD.',
      },
      contact: {
        title: 'Contact — CD Boissons d’Afrique',
        description: 'Devenez point de vente ou contactez notre équipe commerciale pour distribuer nos marques.',
      },
    },
  },
}

// --- Constructeurs par page/clé -----------------------------------------------------------

function commun(slug: SiteSlug): Record<string, Donnees> {
  const piedDePage: Donnees =
    slug === HOLDING_SLUG
      ? { texte: '{groupe} — une holding montréalaise, six filiales, une même exigence de service.' }
      : { texte: 'Une filiale du {groupe}, ancrée à Montréal.' }

  const maintenance: Donnees = {
    surtitre: 'Maintenance',
    titre: 'Ce site est en maintenance.',
    texte: 'Nous mettons à jour {nomCourt}. Merci de revenir bientôt, ou de nous contacter directement.',
  }

  const result: Record<string, Donnees> = { piedDePage, maintenance }
  if (slug === HOLDING_SLUG) {
    // À FAIRE VALIDER PAR UN JURISTE — brouillon Loi 25 (Québec), même statut que
    // CONFIDENTIALITE.politique. Mention unique pour le groupe (spec contact §2.2, Q-01).
    result.mentionFormulaires = {
      texte:
        'Le {groupe} utilise les renseignements transmis par ce formulaire uniquement pour traiter votre demande et vous recontacter. Ils ne sont jamais vendus ni cédés.',
    }
  }
  if (slug === 'boissons') {
    // À FAIRE VALIDER PAR UN JURISTE — brouillon RACJ / Éduc'alcool.
    result.mentionAlcool = {
      texte:
        'La vente et la consommation de boissons alcoolisées sont réservées aux personnes majeures. Buvez avec modération. Certains produits distribués par {nomCourt} sont régis par la Régie des alcools, des courses et des jeux (RACJ) du Québec.',
    }
  }
  return result
}

function accueilHolding(): Record<string, Donnees> {
  return {
    seo: {
      title: '{groupe} — Holding montréalaise, six filiales au Québec', // index.tsx:12
      description:
        'Le {groupe} réunit six entreprises de services au Québec : entretien, transport, comptabilité, placement, import-export et distribution de boissons.', // index.tsx:13
    },
    hero: {
      surtitre: 'Holding — Montréal, Québec', // Hero.tsx:34
      titre: 'Six entreprises.\n*Une seule* exigence.', // Hero.tsx:43-46 (<br/> conservé)
      texte:
        'Le {groupe} est une holding diversifiée établie à Montréal. Entretien, transport, comptabilité, placement, import-export et distribution : nos six filiales servent le Québec avec la même rigueur et la même proximité.', // Hero.tsx:57-59
      ctaLibelle: 'Découvrir nos filiales', // Hero.tsx:69
      imageKey: null, // repli Company.heroImageKey (hero.imageKey ?? site.heroImageKey)
      imageAlt: 'Vue sur Montréal, siège du {groupe}',
      legende: { surtitre: 'Siège social', titre: 'Montréal · Québec' }, // Hero.tsx:98-101
      badgeLibelle: 'Filiales actives', // le nombre (« 06 ») est calculé, voir HoldingHero
    },
    filiales: {
      // Companies.tsx:12-22
      surtitre: 'Nos filiales',
      titre: 'Six métiers,\nun même standard.',
      texte:
        'Chaque filiale du {groupe} est indépendante dans son opération, mais partage la même culture : proximité avec le client, exigence sur la qualité, engagement à long terme.',
    },
    chiffres: {
      // Stats.tsx:3-31
      surtitre: 'Pourquoi le {groupe}',
      titre: 'Un ancrage *montréalais*, une vision de *groupe*.',
      texte:
        'Fondé et opéré depuis Montréal, le {groupe} s’est bâti secteur par secteur, en acquérant l’expertise nécessaire pour livrer à chaque fois le même niveau de service — quel que soit le métier.',
      items: [
        { type: 'libre', valeur: '12+', libelle: 'années d’existence' }, // À VALIDER CLIENT (Q-12)
        { type: 'effectif', libelle: 'employés à travers le groupe', arrondi: true }, // Q-03 : source unique
        { type: 'filiales', libelle: 'secteurs d’activité couverts' },
        { type: 'libre', valeur: '100%', libelle: 'opéré depuis Montréal' },
      ],
    },
    cta: {
      // index.tsx:31-41
      titre: 'Parlons de votre projet.',
      texte: 'Notre bureau de Montréal reçoit vos demandes et les redirige vers la filiale concernée.',
      ctaLibelle: 'Nous joindre',
    },
  }
}

function accueilFilialeStandard(slug: FilialeSlug): Record<string, Donnees> {
  const t = FILIALES[slug]
  return {
    seo: t.seo.accueil,
    hero: {
      surtitre: t.tagline,
      titre: t.heroTitre,
      texte: t.heroTexte,
      ctaLibelle: t.heroCta,
      imageKey: null,
      imageAlt: t.heroImageAlt,
    },
    services: { surtitre: 'Nos services', titre: t.servicesTitre, texte: t.servicesTexte },
    realisations: { surtitre: 'Nos réalisations', titre: t.realisationsTitre },
    cta: { titre: t.ctaTitre, texte: t.ctaTexte, ctaLibelle: t.heroCta },
  }
}

function accueilPlacement(): Record<string, Donnees> {
  const t = FILIALES.placement
  return {
    seo: t.seo.accueil,
    hero: {
      surtitre: t.tagline,
      titre: t.heroTitre,
      texte: t.heroTexte,
      ctaLibelle: t.heroCta,
      imageKey: null,
      imageAlt: t.heroImageAlt,
    },
    // mockdata.ts:167 (pagesContenu id 11 "Espace candidats") + subConfig.ts placement
    audiences: {
      a: {
        surtitre: 'Vous recrutez',
        titre: 'Employeurs',
        texte: 'Manutentionnaires, chauffeurs, recrutement international : nous couvrons vos besoins en main-d’œuvre.',
        lienLibelle: 'Nous contacter',
      },
      b: {
        surtitre: 'Vous cherchez un poste',
        titre: 'Candidats',
        texte:
          'Déposez votre candidature pour un poste au Québec, localement ou via le programme des travailleurs étrangers temporaires.',
        lienLibelle: 'Voir les offres',
      },
    },
    services: { surtitre: 'Nos services', titre: t.servicesTitre, texte: t.servicesTexte },
    realisations: { surtitre: 'Nos réalisations', titre: t.realisationsTitre },
  }
}

function accueilCcdpaa(): Record<string, Donnees> {
  const t = FILIALES.ccdpaa
  return {
    seo: t.seo.accueil,
    hero: {
      surtitre: 'Deux métiers, un même continent', // routes/ccdpaa.index.tsx:21
      titre: t.heroTitre,
      texte: t.heroTexte,
      ctaLibelle: t.heroCta,
      imageKey: null,
      imageAlt: t.heroImageAlt,
    },
    // routes/ccdpaa.index.tsx:29-49
    metiers: {
      a: {
        surtitre: 'Import-export',
        titre: 'Produits agricoles et épices d’Afrique',
        texte: 'Manioc, gombo, plantain, épices et condiments importés directement des producteurs d’Afrique de l’Ouest et Centrale.',
        lienLibelle: 'Découvrir le catalogue',
      },
      b: {
        surtitre: 'Restauration',
        titre: 'Les Ambassades d’Afrique',
        texte: 'Un restaurant panafricain qui met en scène les produits que nous importons, midi et soir.',
        lienLibelle: 'Réserver une table',
      },
    },
    services: { surtitre: 'Nos services', titre: t.servicesTitre, texte: t.servicesTexte },
    realisations: { surtitre: 'Nos réalisations', titre: t.realisationsTitre },
  }
}

function servicesFiliale(slug: FilialeSlug): Record<string, Donnees> {
  const t = FILIALES[slug]
  const result: Record<string, Donnees> = {
    seo: t.seo.services,
    entete: { surtitre: 'Nos services', titre: t.servicesTitre, texte: t.servicesTexte },
    cta: { titre: t.ctaTitre, texte: t.ctaTexte, ctaLibelle: t.heroCta },
  }
  if (slug === 'ccdpaa') {
    // PROJECT_CONTEXT.md §7 : questionnaire scripté, pas une IA (aucun appel LLM). Réaligné sur
    // le prototype validé par le client (lot 3, spec §0) : titre et recommandations par palier de
    // volume ; « six à huit semaines » (promesse commerciale non validée) neutralisé.
    result.assistant = {
      surtitre: 'Assistant import-export',
      titre: 'Cinq questions pour bâtir votre plan d’approvisionnement.',
      recommandations: {
        petit: 'Pour un volume ponctuel ou d’essai, nous recommandons une commande test depuis notre stock de Montréal, livrée sous 72 heures.',
        moyen: 'Pour un volume régulier mensuel, un groupage palettisé mensuel permet de stabiliser vos prix et vos délais de livraison.',
        grand: 'Pour un volume important et récurrent, un conteneur de 20 pieds direct depuis Douala ou Dakar est la formule la plus avantageuse.',
      },
      mentionDelai: 'Recommandation automatisée à partir de règles fixes ; nous revenons vers vous sous 48 heures ouvrables.',
    }
  }
  return result
}

function realisationsEntete(slug: SiteSlug): Record<string, Donnees> {
  const titre = slug === HOLDING_SLUG ? 'Nos réalisations' : FILIALES[slug as FilialeSlug].realisationsTitre
  const seo =
    slug === HOLDING_SLUG
      ? { title: 'Réalisations — Groupe CD', description: 'Les réalisations marquantes du Groupe CD et de ses six filiales, à Montréal.' }
      : FILIALES[slug as FilialeSlug].seo.realisations
  return { seo, entete: { surtitre: 'Portfolio', titre } }
}

function aProposHolding(): Record<string, Donnees> {
  return {
    seo: {
      title: 'À propos — Groupe CD, holding montréalaise',
      description: 'L’histoire, la mission, l’équipe corporative et les partenaires du Groupe CD à Montréal.',
    },
    // routes/a-propos.tsx:30-45
    histoire: {
      surtitre: 'À propos',
      titre: 'Une *holding* montréalaise, un cap partagé.',
      paragraphes: [
        'Le {groupe} réunit six entreprises indépendantes qui partagent une même culture d’exigence, un même ancrage montréalais et une même volonté de bien faire le travail — chaque jour, sur le terrain, sans raccourci.',
        'Depuis notre siège à Montréal, nos équipes corporatives soutiennent les six filiales sur le juridique, la finance, les opérations et les ressources humaines. Chaque filiale conserve la maîtrise de son métier ; la holding lui donne les moyens de grandir sereinement.',
      ],
    },
    // routes/a-propos.tsx:48-62
    reperes: {
      surtitre: 'Nos repères',
      items: [
        { type: 'filiales', libelle: 'filiales opérationnelles' },
        { type: 'effectif', libelle: 'collaborateurs au Québec', arrondi: true },
        { type: 'libre', valeur: 'Montréal', libelle: 'siège social' },
      ],
    },
    equipe: { surtitre: 'Notre équipe', titre: 'La direction corporative.' },
    partenaires: {
      surtitre: 'Nos partenaires',
      titre: 'Ceux qui nous accompagnent.',
      texte: 'Institutions, partenaires financiers, engagements communautaires : ils accompagnent le {groupe} dans son développement.',
    },
  }
}

function aProposFiliale(slug: FilialeSlug): Record<string, Donnees> {
  const t = FILIALES[slug]
  return {
    seo: t.seo.aPropos,
    // SubAboutPage.tsx:22-35
    histoire: {
      surtitre: 'À propos de {nomCourt}',
      titre: 'Une équipe, *une exigence.*',
      paragraphes: [t.histoireP1, t.histoireP2],
    },
    equipe: { surtitre: 'Notre équipe', titre: 'Les visages derrière {nomCourt}.' },
    partenaires: { surtitre: 'Ils travaillent avec nous', titre: 'Nos partenaires et collaborateurs.' },
  }
}

function contactFiliale(slug: SiteSlug): Record<string, Donnees> {
  const seo = slug === HOLDING_SLUG
    ? {
        title: 'Contact — {groupe}', // contact.tsx:9
        description: 'Écrivez au {groupe} à Montréal : nous vous redirigeons vers la bonne filiale.', // contact.tsx:10
      }
    : FILIALES[slug as FilialeSlug].seo.contact
  const contact: Donnees =
    slug === HOLDING_SLUG
      ? {
          surtitre: 'Contact', // Contact.tsx:60
          titre: 'Parlons de votre projet.', // Contact.tsx:63
          texte:
            'Une question sur l’une de nos filiales, un partenariat, un mandat ? Écrivez-nous. Nous vous mettrons directement en lien avec la bonne équipe.', // Contact.tsx:66-67
          messageSucces:
            'Merci, votre message a bien été reçu. Notre équipe vous répondra rapidement. Un courriel de confirmation vous est envoyé.', // Contact.tsx:43 + Q-10
        }
      : {
          surtitre: FILIALES[slug as FilialeSlug].contactSurtitre,
          titre: FILIALES[slug as FilialeSlug].contactTitre,
          texte: FILIALES[slug as FilialeSlug].contactTexte,
          messageSucces: MESSAGE_SUCCES,
        }

  const result: Record<string, Donnees> = { seo, contact }
  if (slug === 'ccdpaa' || slug === 'boissons') {
    // Libellé confirmé (Q-11, PROJECT_STATE.md) ; texte par site, repris du prototype (lot 2 §3b).
    const texteParSite: Record<'ccdpaa' | 'boissons', string> = {
      ccdpaa:
        'Dites-nous ce que vous aimeriez retrouver sur nos étals. Chaque suggestion est étudiée par notre équipe d’approvisionnement.',
      boissons:
        'Dites-nous ce que vous aimeriez retrouver dans notre portefeuille de marques. Chaque suggestion est étudiée par notre équipe d’approvisionnement.',
    }
    result.suggestion = {
      surtitre: 'Un produit ne figure pas à notre catalogue ?',
      titre: 'Vous ne trouvez pas ce que vous cherchez ?',
      texte: texteParSite[slug],
      messageSucces: MESSAGE_SUCCES,
    }
  }
  return result
}

function restaurantCcdpaa(): Record<string, Donnees> {
  return {
    seo: {
      title: 'Les Ambassades d’Afrique — Restaurant panafricain à Montréal',
      description: 'Restaurant panafricain à Montréal célébrant treize cuisines du continent. Bar complet, midi et soir.',
    },
    // routes/ccdpaa.restaurant.tsx:51-59,74
    hero: {
      surtitre: 'Restaurant · Plateau Mont-Royal',
      titre: 'Les *Ambassades* d’Afrique.',
      texte:
        'Une salle chaleureuse au cœur du Plateau, une carte qui traverse treize cuisines africaines, un bar complet avec permis d’alcool. Nous vous accueillons midi et soir, en famille, en tête-à-tête ou pour un événement.',
      imageKey: null,
      imageAlt: 'Salle du restaurant Les Ambassades d’Afrique',
      // Pas de `legende` ici (lot 3, spec §0) : les horaires ont une seule source,
      // `ReglagesRestaurant` — les recopier ici créerait une deuxième source qui diverge dès
      // la première édition des réglages. Le bloc « Ouverture » de la page les lit directement.
    },
    // routes/ccdpaa.restaurant.tsx:37-42,84-89
    menu: {
      surtitre: 'Un aperçu de la carte',
      titre: 'Treize cuisines, une même table.',
      items: [
        { titre: 'Yassa poulet', sousTitre: 'Sénégal', imageKey: null, imageAlt: 'Yassa poulet' },
        { titre: 'Ndolé aux crevettes', sousTitre: 'Cameroun', imageKey: null, imageAlt: 'Ndolé aux crevettes' },
        { titre: 'Kitfo épicé', sousTitre: 'Éthiopie', imageKey: null, imageAlt: 'Kitfo épicé' },
        { titre: 'Tajine d’agneau aux abricots', sousTitre: 'Maroc', imageKey: null, imageAlt: 'Tajine d’agneau aux abricots' },
      ],
    },
    reservation: {
      surtitre: 'Réserver une table',
      titre: 'Les Ambassades d’Afrique',
      texte: 'Choisissez votre date et votre heure, nous confirmons votre table par courriel.',
      messageSucces: MESSAGE_SUCCES_RESERVATION,
    },
  }
}

function offresPlacement(): Record<string, Donnees> {
  return {
    seo: {
      title: 'Offres d’emploi — Placement CD Pro',
      description: 'Postes disponibles en manutention, transport et entretien, à pourvoir rapidement au Québec.',
    },
    // routes/placement.offres.tsx:43-52 (lot 3) : surtitre + titre repris du prototype, sans le
    // compteur « 0 mandats » codé en dur (spec §0) — le compteur est calculé côté page.
    entete: {
      surtitre: 'Postes ouverts',
      titre: 'Des mandats à pourvoir\n*en ce moment.*',
      texte:
        'Nos offres sont mises à jour au fil des mandats confiés par nos entreprises clientes. Postulez directement : un conseiller vous rappelle sous 48 heures.',
    },
    cta: {
      titre: 'Vous ne trouvez pas votre poste ?',
      texte: 'Envoyez-nous une candidature spontanée : nous la gardons en vue des prochains mandats à pourvoir.',
      ctaLibelle: 'Candidature spontanée',
    },
    candidature: {
      surtitre: 'Postuler',
      titre: 'Envoyez votre candidature',
      texte: 'Remplissez le formulaire ci-dessous ; un conseiller étudie votre dossier et revient vers vous.',
      messageSucces: 'Merci, votre candidature a bien été transmise. Un accusé de réception vous est envoyé par courriel.',
      // À FAIRE VALIDER PAR UN JURISTE — brouillon Loi 25 (Québec).
      consentement: 'J’accepte que mes renseignements soient utilisés pour traiter ma candidature, conformément à la politique de confidentialité.',
    },
    spontanee: {
      surtitre: 'Candidature spontanée',
      titre: 'Aucun poste ne correspond à votre profil ?',
      texte: 'Envoyez-nous votre candidature : nous la conservons en vue des prochains mandats à pourvoir.',
      messageSucces: 'Merci, votre candidature a bien été transmise. Un accusé de réception vous est envoyé par courriel.',
    },
  }
}

function confidentialiteHolding(): Record<string, Donnees> {
  return {
    seo: {
      title: 'Politique de confidentialité — Groupe CD',
      description: 'Comment le Groupe CD recueille, utilise et protège vos renseignements personnels, conformément à la Loi 25 (Québec).',
    },
    // À FAIRE VALIDER PAR UN JURISTE avant mise en production — brouillon Loi 25 (Québec).
    politique: {
      titre: 'Politique de confidentialité',
      miseAJour: '2026-09-25',
      introduction:
        'Le {groupe} respecte la confidentialité des renseignements personnels que vous nous confiez, conformément à la Loi sur la protection des renseignements personnels dans le secteur privé (Loi 25, Québec).',
      sections: [
        {
          titre: 'Responsable de la protection des renseignements personnels',
          paragraphes: [
            'Le {groupe} a désigné un responsable de la protection des renseignements personnels, joignable aux coordonnées indiquées à la section Contact du site.',
          ],
        },
        {
          titre: 'Renseignements recueillis et finalités',
          paragraphes: [
            'Nous recueillons les renseignements que vous nous transmettez volontairement par nos formulaires publics (nom, courriel, téléphone et, selon le formulaire, curriculum vitæ ou documents d’appui), dans le seul but de répondre à votre demande, de traiter votre candidature ou votre réservation, ou de vous recontacter.',
          ],
        },
        {
          titre: 'Conservation des renseignements',
          paragraphes: [
            'Les renseignements personnels sont conservés uniquement pour la durée nécessaire aux finalités décrites ci-dessus, puis détruits ou anonymisés de façon sécuritaire.',
          ],
        },
        {
          titre: 'Vos droits',
          paragraphes: [
            'Vous pouvez en tout temps demander l’accès aux renseignements personnels que nous détenons à votre sujet, leur rectification ou leur suppression, sous réserve des obligations légales de conservation.',
          ],
        },
        {
          titre: 'Nous joindre',
          paragraphes: [
            'Pour toute question ou pour exercer vos droits, écrivez-nous par le formulaire de contact du site ou aux coordonnées de la filiale concernée.',
          ],
        },
      ],
    },
  }
}

function mentionsLegalesBoissons(): Record<string, Donnees> {
  return {
    seo: {
      title: 'Mentions légales — CD Boissons d’Afrique',
      description: 'Mentions légales et encadrement réglementaire de la distribution de boissons alcoolisées par CD Boissons d’Afrique.',
    },
    // À FAIRE VALIDER PAR UN JURISTE — brouillon RACJ / Éduc'alcool.
    mentions: {
      titre: 'Mentions légales',
      miseAJour: '2026-09-25',
      sections: [
        {
          titre: 'Vente de boissons alcoolisées',
          paragraphes: [
            'CD Boissons d’Afrique représente et distribue des marques de boissons alcoolisées et non alcoolisées. La vente, la consommation et la publicité de boissons alcoolisées sont encadrées par la Régie des alcools, des courses et des jeux (RACJ) du Québec.',
          ],
        },
        {
          titre: 'Consommation responsable',
          paragraphes: ['La consommation d’alcool est réservée aux personnes majeures. Buvez avec modération.'],
        },
        {
          titre: 'Publicité',
          paragraphes: [
            'Aucun contenu de ce site ne s’adresse aux personnes mineures ni ne présente la consommation d’alcool comme associée à la conduite d’un véhicule, au sport ou à la réussite sociale, conformément aux lignes directrices d’Éduc’alcool et à la réglementation applicable.',
          ],
        },
      ],
    },
  }
}

// --- Table finale : `${page}:${cle}` → (slug) => donnees ---------------------------------
// Portée "AUTRES_FILIALES" du catalogue (entretien, transport, comptable, boissons) : couverte
// par le repli `accueilFilialeStandard` ci-dessous (placement et ccdpaa ont leur propre builder).

function accueilBySlug(slug: SiteSlug): Record<string, Donnees> {
  if (slug === HOLDING_SLUG) return accueilHolding()
  if (slug === 'placement') return accueilPlacement()
  if (slug === 'ccdpaa') return accueilCcdpaa()
  return accueilFilialeStandard(slug)
}

function buildersFor(slug: SiteSlug): Record<string, Donnees> {
  const accueil = accueilBySlug(slug)
  const commonEntries = commun(slug)
  const realisations = realisationsEntete(slug)
  const contact = contactFiliale(slug)

  const entries: Record<string, Donnees> = {}
  for (const [cle, donnees] of Object.entries(commonEntries)) entries[`COMMUN:${cle}`] = donnees
  for (const [cle, donnees] of Object.entries(accueil)) entries[`ACCUEIL:${cle}`] = donnees
  for (const [cle, donnees] of Object.entries(realisations)) entries[`REALISATIONS:${cle}`] = donnees
  for (const [cle, donnees] of Object.entries(contact)) entries[`CONTACT:${cle}`] = donnees

  if (slug === HOLDING_SLUG) {
    for (const [cle, donnees] of Object.entries(aProposHolding())) entries[`A_PROPOS:${cle}`] = donnees
    for (const [cle, donnees] of Object.entries(confidentialiteHolding())) entries[`CONFIDENTIALITE:${cle}`] = donnees
  } else {
    for (const [cle, donnees] of Object.entries(servicesFiliale(slug))) entries[`SERVICES:${cle}`] = donnees
    for (const [cle, donnees] of Object.entries(aProposFiliale(slug))) entries[`A_PROPOS:${cle}`] = donnees
    if (slug === 'ccdpaa') {
      for (const [cle, donnees] of Object.entries(restaurantCcdpaa())) entries[`RESTAURANT:${cle}`] = donnees
    }
    if (slug === 'placement') {
      for (const [cle, donnees] of Object.entries(offresPlacement())) entries[`OFFRES:${cle}`] = donnees
    }
    if (slug === 'boissons') {
      for (const [cle, donnees] of Object.entries(mentionsLegalesBoissons())) entries[`MENTIONS_LEGALES:${cle}`] = donnees
    }
  }

  return entries
}

/** Valeur par défaut d'une entrée du catalogue pour un site donné (page/clé identiques au
 * catalogue — spec §1.4). `undefined` si aucune valeur n'est définie pour ce couple. */
export function defaultDonnees(page: string, cle: string, slug: SiteSlug): Donnees | undefined {
  return buildersFor(slug)[`${page}:${cle}`]
}
