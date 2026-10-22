# Dossier de validation juriste — textes légaux (Q-01)

**Statut** : tous les textes ci-dessous sont des **brouillons internes non validés** (rédigés
2026-09-25), rédigés « à faire valider par un juriste » dans le code. Ils sont bloquants mise
en production. Les textes sont cités **tels qu'écrits dans le code** : le jeton `{groupe}`
(resp. `{nomCourt}`) est remplacé, au rendu, par le nom du groupe (resp. de la filiale) saisi
dans l'admin. Chaque texte est éditable dans l'admin (**Sections**), clé indiquée ci-dessous ;
après validation, la version retenue est saisie dans l'admin et répercutée dans le seed par
nous (le seed n'écrase jamais une édition admin).

**Cadre** : Loi 25 (Québec, renseignements personnels dans le secteur privé) et réglementation
RACJ / Éduc'alcool (vente et publicité d'alcool).

---

## 1. Politique de confidentialité — `CONFIDENTIALITE:politique` (holding, page `/confidentialite`)

> **Politique de confidentialité** — mise à jour : 2026-09-25
>
> Le {groupe} respecte la confidentialité des renseignements personnels que vous nous
> confiez, conformément à la Loi sur la protection des renseignements personnels dans le
> secteur privé (Loi 25, Québec).
>
> **Responsable de la protection des renseignements personnels**
> Le {groupe} a désigné un responsable de la protection des renseignements personnels,
> joignable aux coordonnées indiquées à la section Contact du site.
>
> **Renseignements recueillis et finalités**
> Nous recueillons les renseignements que vous nous transmettez volontairement par nos
> formulaires publics (nom, courriel, téléphone et, selon le formulaire, curriculum vitæ ou
> documents d’appui), dans le seul but de répondre à votre demande, de traiter votre
> candidature ou votre réservation, ou de vous recontacter.
>
> **Conservation des renseignements**
> Les renseignements personnels sont conservés uniquement pour la durée nécessaire aux
> finalités décrites ci-dessus, puis détruits ou anonymisés de façon sécuritaire.
>
> **Vos droits**
> Vous pouvez en tout temps demander l’accès aux renseignements personnels que nous détenons
> à votre sujet, leur rectification ou leur suppression, sous réserve des obligations légales
> de conservation.
>
> **Nous joindre**
> Pour toute question ou pour exercer vos droits, écrivez-nous par le formulaire de contact du
> site ou aux coordonnées de la filiale concernée.

**Questions**

1. Loi 25 impose un responsable de la protection désigné (et sa communication). La formulation
   « joignable aux coordonnées de la section Contact » suffit-elle, ou faut-il nommer la
   personne/l'entité explicitement ?
2. La durée de conservation n'est pas chiffrée. Le logiciel applique déjà : **6 mois** après
   rejet d'une candidature (ou après réception si jamais traitée) avec anonymisation, et
   **12 mois** pour le vivier avec consentement renouvelé. Faut-il annoncer ces durées dans
   la politique ?
3. Les messages de contact et les réservations de restaurant n'ont **aucune purgation
   automatisée** à ce jour : quelle durée de conservation faut-il annoncer/imposer ?

---

## 2. Mention des formulaires — `COMMUN:mentionFormulaires` (holding, affichée sous **tous** les formulaires du groupe)

> Le {groupe} utilise les renseignements transmis par ce formulaire uniquement pour traiter
> votre demande et vous recontacter. Ils ne sont jamais vendus ni cédés.

**Questions**

4. Une mention unique groupe convient-elle pour contact, suggestion de produit, réservation
   **et** candidature (qui, elle, implique conservation de CV et documents — voir point 3) ?
5. Faut-il y ajouter un renvoi explicite à la politique de confidentialité et à la durée de
   conservation (le lien vers la politique est déjà présent à côté, composant
   `MentionConfidentialite`) ?

---

## 3. Consentement à la candidature — placement, formulaires d'offres

**Formulaires concernés** : candidature à une offre (`OFFRES:candidature.consentement`) et
candidature spontanée (`OFFRES:spontanee.consentement`). Les deux portent, dans le seed, le
même texte (case **obligatoire**, dépôt refusé sans elle) :

> J’accepte que mes renseignements soient utilisés pour traiter ma candidature, conformément à
> la politique de confidentialité.

**Point technique à connaître** : sur une base installée avant l'ajout du texte au seed de la
candidature spontanée, le formulaire affiche un repli codé en dur au lieu du texte ci-dessus :

> J’accepte que mes données soient traitées pour ma candidature.

**Contexte** : le logiciel applique l'anonymisation Loi 25 — suppression des CV/documents,
effacement des PII, ligne statistique conservée, 6 mois (rejet / jamais traitée) et 12 mois
(vivier).

**Questions**

6. Le consentement doit-il annoncer les durées (6 mois / 12 mois) et l'anonymisation, ou le
   renvoi à la politique suffit-il — à condition que la politique liste les durées (q. 2) ?
7. Le vivier « 12 mois renouvelable avec nouveau consentement » : le renouvellement prévu est
   une réactivation manuelle côté recruteur — faut-il un ré-accord explicite du candidat au
   moment du renouvellement ?
8. Les deux formulations ci-dessus conviennent-elles (ou une formulation unique à appliquer
   partout) ?

---

## 4. Mentions légales boissons — `MENTIONS_LEGALES:mentions` (CD Boissons d'Afrique)

> **Mentions légales** — mise à jour : 2026-09-25
>
> **Vente de boissons alcoolisées**
> CD Boissons d’Afrique représente et distribue des marques de boissons alcoolisées et non
> alcoolisées. La vente, la consommation et la publicité de boissons alcoolisées sont
> encadrées par la Régie des alcools, des courses et des jeux (RACJ) du Québec.
>
> **Consommation responsable**
> La consommation d’alcool est réservée aux personnes majeures. Buvez avec modération.
>
> **Publicité**
> Aucun contenu de ce site ne s’adresse aux personnes mineures ni ne présente la consommation
> d’alcool comme associée à la conduite d’un véhicule, au sport ou à la réussite sociale,
> conformément aux lignes directrices d’Éduc’alcool et à la réglementation applicable.

**Point technique à connaître** : le texte est édité dans l'admin et rendu sur la page
`/boissons/mentions-legales` (créée le 2026-10-12, liée depuis le pied de page boissons).

**Question**

9. Formulation conforme aux exigences RACJ (licences, publicité) ? Faut-il mentionner la
   licence/titre de l'établissement ou d'autres mentions obligatoires ?

---

## 5. Mention alcool — `COMMUN:mentionAlcool` (portée : filiale boissons)

> La vente et la consommation de boissons alcoolisées sont réservées aux personnes majeures.
> Buvez avec modération. Certains produits distribués par {nomCourt} sont régis par la Régie
> des alcools, des courses et des jeux (RACJ) du Québec.

**Point technique à connaître** : ce texte est édité dans l'admin et affiché au **pied de page
de la filiale boissons** (avec lien vers `/boissons/mentions-legales`) depuis le 2026-10-12 —
l'emplacement est une hypothèse par défaut à confirmer (question 10).

**Question**

10. Sur quelles pages cette mention doit-elle obligatoirement apparaître (formulaires,
    page boissons, mentions légales, pied de page) ?

---

## 6. Mesures déjà implémentées (à confirmer par le juriste)

- **Candidatures placement** : anonymisation automatique quotidienne (tâche
  `anonymisation-loi25`) à 6 mois après rejet / réception jamais traitée ; bouton
  « Supprimer maintenant » sur demande d'effacement ; vivier 12 mois ; CV et documents
  supprimés, PII effacées, ligne statistique (poste, catégorie, date, statut, filiale)
  conservée ; toute modification d'une candidature anonymisée est refusée (409).
- **Anti-spam** : 3 accusés de réception maximum par destinataire par 24 h.
- **Réservations** : aucune suppression admin (conservation intégrale, cf. q. 3).

---

## Questions transverses (numérotées pour réponse)

| # | Question |
|---|---|
| 1 | Désignation/communication du responsable Loi 25 |
| 2 | Annonce des durées 6 mois / 12 mois dans la politique |
| 3 | Durée de conservation des messages de contact et des réservations |
| 4 | Unicité de la mention formulaires (notamment pour les candidatures) |
| 5 | Renvoi explicite politique + durée dans la mention formulaires |
| 6 | Durées/anonymisation dans le consentement candidature |
| 7 | Ré-accord au renouvellement du vivier (12 mois) |
| 8 | Validation des deux formulations du consentement (seed + repli) |
| 9 | Conformité RACJ des mentions légales boissons |
| 10 | Emplacement obligatoire de la mention alcool |
