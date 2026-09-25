import { describe, expect, it } from 'vitest'
import { createStorage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { purgeRouteCache } from '../../server/utils/isr'

describe('purgeRouteCache', () => {
  it('removes every key under cache:nitro:routes and leaves other keys untouched', async () => {
    const storage = createStorage({ driver: memoryDriver() })
    await storage.setItem('cache:nitro:routes:/a-propos.json', { body: 'x' })
    await storage.setItem('cache:nitro:routes:/entretien/a-propos.json', { body: 'y' })
    await storage.setItem('uploads:some-file.png', 'binaire')

    const removed = await purgeRouteCache(storage)

    expect(removed).toBe(2)
    expect(await storage.getKeys('cache:nitro:routes')).toEqual([])
    expect(await storage.hasItem('uploads:some-file.png')).toBe(true)
  })

  it('returns 0 when there is nothing to purge', async () => {
    const storage = createStorage({ driver: memoryDriver() })
    expect(await purgeRouteCache(storage)).toBe(0)
  })
})
