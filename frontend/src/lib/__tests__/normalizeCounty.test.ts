import { describe, it, expect, vi } from 'vitest'
import { normalizeCountyName, initCountyAliases } from '../normalizeCounty'

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

describe('normalizeCountyName', () => {
	it('normalizes known aliases (after init)', async () => {
		// mock fetch to return a minimal alias map used for this test
		const aliasMap = { aliases: { 'westlands': 'Nairobi County', 'kajiado east': 'Kajiado County', 'nandi hills': 'Nandi Hills County' } }
		global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => aliasMap })) as any
		await initCountyAliases()
		expect(normalizeCountyName('westlands')).toBe('Nairobi County')
		expect(normalizeCountyName('Nairobi')).toBe('Nairobi County')
		expect(normalizeCountyName('kajiado east')).toBe('Kajiado County')
		expect(normalizeCountyName('nandi hills')).toBe('Nandi Hills County')
		// restore fetch for other tests
		global.fetch = OLD_FETCH
	})

	it('title-cases and appends County when missing', () => {
		expect(normalizeCountyName('kajiado')).toBe('Kajiado County')
		expect(normalizeCountyName('laikipia')).toBe('Laikipia County')
		expect(normalizeCountyName('some random')).toBe('Some Random County')
	})

	it('handles empty/undefined', () => {
		expect(normalizeCountyName('')).toBe('')
		expect(normalizeCountyName(undefined)).toBe('')
	})
})
