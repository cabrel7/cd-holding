import { describe, expect, it } from 'vitest'
import { classesRealisation } from '@/utils/grilleRealisations'

describe('classesRealisation', () => {
  it('should cycle through the 8/4, 5/7, 6/6 pairs', () => {
    expect(classesRealisation(0, 6).col).toBe('md:col-span-8')
    expect(classesRealisation(1, 6).col).toBe('md:col-span-4')
    expect(classesRealisation(2, 6).col).toBe('md:col-span-5')
    expect(classesRealisation(3, 6).col).toBe('md:col-span-7')
    expect(classesRealisation(4, 6).col).toBe('md:col-span-6')
    expect(classesRealisation(5, 6).col).toBe('md:col-span-6')
  })

  it('should always pair columns summing to 12 within the cycle', () => {
    for (let i = 0; i < 6; i += 2) {
      const a = Number(classesRealisation(i, 6).col.match(/\d+$/)?.[0])
      const b = Number(classesRealisation(i + 1, 6).col.match(/\d+$/)?.[0])
      expect(a + b).toBe(12)
    }
  })

  it('should repeat the pattern past 6 items', () => {
    expect(classesRealisation(6, 8)).toEqual(classesRealisation(0, 8))
    expect(classesRealisation(7, 8)).toEqual(classesRealisation(1, 8))
  })

  it('should put an odd-total last item alone on col-span-12', () => {
    expect(classesRealisation(2, 3).col).toBe('md:col-span-12')
    expect(classesRealisation(4, 5).col).toBe('md:col-span-12')
  })

  it('should not give col-span-12 to the last item of an even total', () => {
    expect(classesRealisation(5, 6).col).not.toBe('md:col-span-12')
  })

  it('should treat a single item as alone on its row', () => {
    expect(classesRealisation(0, 1).col).toBe('md:col-span-12')
  })

  it('should never overflow past index-total-1 for the alone case', () => {
    // Un item pair-du-milieu ne doit jamais recevoir le motif "seul", même sur un total impair.
    expect(classesRealisation(0, 3).col).not.toBe('md:col-span-12')
    expect(classesRealisation(1, 3).col).not.toBe('md:col-span-12')
  })

  it('should set the aspect on the image container, distinct per pattern', () => {
    expect(classesRealisation(0, 6).aspect).toBe('aspect-[16/10]')
    expect(classesRealisation(2, 3).aspect).toBe('aspect-[21/9]')
  })
})
