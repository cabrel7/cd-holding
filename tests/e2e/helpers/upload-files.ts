// Fichiers de test pour les candidatures : PDF minimal et faux PDF versionnés dans
// tests/e2e/fixtures/ ; le fichier de 11 Mo est généré en mémoire (jamais écrit, jamais versionné).
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

const FIXTURES_DIR = join(process.cwd(), 'tests', 'e2e', 'fixtures')
const MO = 1024 * 1024
const PDF_MAGIC = '%PDF-1.4\n'

export const CV_PDF_PATH = join(FIXTURES_DIR, 'cv-minimal.pdf')
export const FAUX_PDF_PATH = join(FIXTURES_DIR, 'faux-cv.pdf')

export interface MemoryFile {
  readonly name: string
  readonly mimeType: string
  readonly buffer: Buffer
}

export const cvPdfBuffer = (): Buffer => readFileSync(CV_PDF_PATH)
export const fauxPdfBuffer = (): Buffer => readFileSync(FAUX_PDF_PATH)

/** PDF valide (magic bytes) de `tailleMo` Mo, généré au moment du test. */
export function pdfVolumineux(tailleMo: number): MemoryFile {
  const entete = Buffer.from(PDF_MAGIC, 'latin1')
  const corps = Buffer.alloc(Math.floor(tailleMo * MO) - entete.length, 0x20)
  return { name: 'gros-cv.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([entete, corps]) }
}

/** Écrit un PDF valide (magic bytes) de `tailleMo` Mo à `chemin` (dossier de sortie du test). */
export function ecrireFichierVolumineux(chemin: string, tailleMo: number): void {
  writeFileSync(chemin, pdfVolumineux(tailleMo).buffer)
}
