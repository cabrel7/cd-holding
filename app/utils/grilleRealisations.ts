// Motif éditorial de la grille réalisations (spec §1 « /{filiale}/realisations », §0 : le
// prototype posait l'`aspect` sur l'`<article>`, ce qui produisait des hauteurs incohérentes et
// un trou de 7 colonnes quand la liste s'arrêtait à 3 éléments). Fonction pure : `aspect` est
// destiné au conteneur de l'image, jamais à l'article lui-même.
export interface ClassesRealisation {
  readonly col: string
  readonly aspect: string
}

// Motif par paires (8/4, 5/7, 6/6), chaque paire totalisant 12 colonnes — donc une rangée pleine.
const MOTIFS: readonly ClassesRealisation[] = [
  { col: 'md:col-span-8', aspect: 'aspect-[16/10]' },
  { col: 'md:col-span-4', aspect: 'aspect-[3/4]' },
  { col: 'md:col-span-5', aspect: 'aspect-[4/5]' },
  { col: 'md:col-span-7', aspect: 'aspect-[16/9]' },
  { col: 'md:col-span-6', aspect: 'aspect-[4/3]' },
  { col: 'md:col-span-6', aspect: 'aspect-[4/3]' },
]

const DERNIER_SEUL: ClassesRealisation = { col: 'md:col-span-12', aspect: 'aspect-[21/9]' }

/**
 * Classes de mise en page (colonnes + aspect de l'image) pour l'élément `index` d'une liste de
 * `total` réalisations. Les paires du motif totalisent toujours 12 colonnes (une rangée) : un
 * total impair laisse le dernier élément seul sur sa rangée, qui prend alors toute la largeur.
 */
export function classesRealisation(index: number, total: number): ClassesRealisation {
  const dernierSansPaire = total % 2 === 1 && index === total - 1
  if (dernierSansPaire) return DERNIER_SEUL

  return MOTIFS[index % MOTIFS.length] ?? MOTIFS[0]!
}
