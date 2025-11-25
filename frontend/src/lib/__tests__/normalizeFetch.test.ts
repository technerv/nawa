import { afterEach, describe, expect, it, vi } from 'vitest'
import { initCountyAliases, areAliasesReady, normalizeCountyName, getAliasSource } from '../normalizeCounty'

// Provide a minimal localStorage shim for the test environment
if (typeof (global as any).localStorage === 'undefined') {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k in store) delete store[k] }
  }
}

const OLD_FETCH = (global as any).fetch

describe('initCountyAliases fetch behavior with localStorage/ETag and retries', () => {
  afterEach(() => {
    ;(global as any).fetch = OLD_FETCH
    vi.restoreAllMocks()
    try { localStorage.removeItem('nawa_aliases_v1'); localStorage.removeItem('nawa_aliases_etag_v1') } catch {}
  })

  it('stores aliases and etag on successful fetch', async () => {
    const aliasMap = { aliases: { 'westlands': 'Nairobi County', 'mombasa': 'Mombasa County' } }
    const mock = vi.fn(async () => ({ ok: true, status: 200, headers: { get: (k: string) => (k === 'ETag' ? 'etag-123' : null) }, json: async () => aliasMap }))
    ;(global as any).fetch = mock
    await initCountyAliases()
    expect(areAliasesReady()).toBe(true)
    expect(normalizeCountyName('westlands')).toBe('Nairobi County')
    // persisted to localStorage
    const stored = JSON.parse(localStorage.getItem('nawa_aliases_v1') || '{}')
    expect(stored['westlands']).toBe('Nairobi County')
    expect(localStorage.getItem('nawa_aliases_etag_v1')).toBe('etag-123')
    expect(getAliasSource()).toBe('fetched')
  })

  it('sends If-None-Match and uses cached map on 304', async () => {
    // pre-seed localStorage with a cached map and etag
    const cached = { 'westlands': 'Nairobi County' }
    localStorage.setItem('nawa_aliases_v1', JSON.stringify(cached))
    localStorage.setItem('nawa_aliases_etag_v1', 'etag-abc')

    const mock = vi.fn(async (_url: string, opts: any) => {
      // ensure If-None-Match header was sent
      expect(opts.headers['If-None-Match']).toBe('etag-abc')
      return { ok: true, status: 304, headers: { get: () => null }, json: async () => ({}) }
    })
    ;(global as any).fetch = mock
    await initCountyAliases()
    expect(areAliasesReady()).toBe(true)
    expect(normalizeCountyName('westlands')).toBe('Nairobi County')
    expect(getAliasSource()).toBe('cached')
  })

  it('retries on transient failures and eventually succeeds', async () => {
    const aliasMap = { aliases: { 'kajiado east': 'Kajiado County' } }
    // first two attempts fail, third succeeds
    let calls = 0
    const mock = vi.fn(async () => {
      calls += 1
      if (calls < 3) return Promise.reject(new Error('network'))
      return { ok: true, status: 200, headers: { get: () => 'etag-xyz' }, json: async () => aliasMap }
    })
    ;(global as any).fetch = mock
    await initCountyAliases()
    expect(areAliasesReady()).toBe(true)
    expect(normalizeCountyName('kajiado east')).toBe('Kajiado County')
    expect(getAliasSource()).toBe('fetched')
  })

  it('uses cached map if all attempts fail', async () => {
    const cached = { 'mombasa': 'Mombasa County' }
    localStorage.setItem('nawa_aliases_v1', JSON.stringify(cached))
    // network always fails
    const mock = vi.fn(async () => Promise.reject(new Error('offline')))
    ;(global as any).fetch = mock
    await initCountyAliases()
    expect(areAliasesReady()).toBe(true)
    expect(normalizeCountyName('mombasa')).toBe('Mombasa County')
    expect(getAliasSource()).toBe('cached')
  })
})
