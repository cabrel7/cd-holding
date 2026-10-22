// Helpers d'affichage du module placement (lot 5). Le poste est stocké tantôt comme clé de
// `POSTES_CANDIDAT` (candidatures créées depuis le formulaire public), tantôt comme texte libre
// (vivier saisi manuellement) : on affiche le libellé quand la clé correspond, le texte brut sinon.
import { POSTES_CANDIDAT, POSTE_AUTRE } from '#shared/config/candidature'

/** Libellé lisible d'un poste. `precision` remplace le libellé générique « Autre ». */
export function libellePoste(value: string | null, precision?: string | null): string {
  if (value && value === POSTE_AUTRE && precision) return precision
  if (!value) return '—'
  return POSTES_CANDIDAT.find((p) => p.value === value)?.label ?? value
}

/** Clé de téléchargement d'un fichier privé (jamais affichée : seul `nomOriginal` l'est). */
export function fichierUrl(key: string): string {
  return `/api/files/${encodeURIComponent(key)}`
}
