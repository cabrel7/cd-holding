import { describe, expect, it } from 'vitest'
import { hitBucket, type Bucket } from '../../server/utils/rate-limit'

const OPTIONS = { max: 3, windowMs: 1000 } as const

describe('hitBucket', () => {
  it('allows the first hit and creates a bucket for the key', () => {
    const buckets = new Map<string, Bucket>()
    const result = hitBucket(buckets, 'a', OPTIONS, 0)
    expect(result).toEqual({ allowed: true, retryAfterMs: 0 })
    expect(buckets.get('a')).toEqual({ count: 1, resetAt: 1000 })
  })

  it('allows hits up to max within the window', () => {
    const buckets = new Map<string, Bucket>()
    hitBucket(buckets, 'a', OPTIONS, 0)
    hitBucket(buckets, 'a', OPTIONS, 100)
    const third = hitBucket(buckets, 'a', OPTIONS, 200)
    expect(third.allowed).toBe(true)
  })

  it('rejects the hit past max within the window, with the remaining time', () => {
    const buckets = new Map<string, Bucket>()
    hitBucket(buckets, 'a', OPTIONS, 0)
    hitBucket(buckets, 'a', OPTIONS, 100)
    hitBucket(buckets, 'a', OPTIONS, 200)
    const fourth = hitBucket(buckets, 'a', OPTIONS, 300)
    expect(fourth.allowed).toBe(false)
    expect(fourth.retryAfterMs).toBe(1000 - 300)
  })

  it('resets the window once resetAt has passed', () => {
    const buckets = new Map<string, Bucket>()
    hitBucket(buckets, 'a', OPTIONS, 0)
    hitBucket(buckets, 'a', OPTIONS, 100)
    hitBucket(buckets, 'a', OPTIONS, 200)
    hitBucket(buckets, 'a', OPTIONS, 300) // rejected, still within window

    const afterWindow = hitBucket(buckets, 'a', OPTIONS, 1000)
    expect(afterWindow.allowed).toBe(true)
    expect(buckets.get('a')).toEqual({ count: 1, resetAt: 2000 })
  })

  it('keeps independent buckets per key', () => {
    const buckets = new Map<string, Bucket>()
    hitBucket(buckets, 'a', OPTIONS, 0)
    hitBucket(buckets, 'a', OPTIONS, 0)
    hitBucket(buckets, 'a', OPTIONS, 0)
    const rejectedA = hitBucket(buckets, 'a', OPTIONS, 0)
    const firstB = hitBucket(buckets, 'b', OPTIONS, 0)

    expect(rejectedA.allowed).toBe(false)
    expect(firstB.allowed).toBe(true)
  })
})
