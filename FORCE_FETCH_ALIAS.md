Status: Frontend now force-fetches county alias map from backend

What changed
- The frontend no longer ships a static alias fallback. The alias map is fetched at app startup from `/api/county_aliases/`.
- `core/nawaapp/views.py` returns JSON with `version` and `aliases` and sets an `ETag` header. It also responds with `304` when the client's `If-None-Match` matches.
- `frontend/src/lib/normalizeCounty.ts` now exposes `initCountyAliases()` and `areAliasesReady()`; the runtime map is empty until `initCountyAliases()` populates it.
- `frontend/src/App.tsx` calls `initCountyAliases()` on app load and surfaces a warning banner when alias fetch fails.
- Unit tests were added to verify fetch behavior (success, 304, failure).

Risks / Notes
- Force-fetch makes the client dependent on the backend alias service being reachable. If the backend is down or unreachable, canonicalization may not match server-side expectations and some UX (clicking county cells to filter) may produce slightly different query strings.
- To mitigate fragility, consider:
  - Adding a small local fallback (kept intentionally out for strictness) or a limited emergency fallback shipped separately.
  - Increasing server availability (replicas, caching layer, CDN) for the alias endpoint.
  - Adding retries with exponential backoff in `initCountyAliases()`.
  - Serving a small, versioned JSON file over CDN and using the ETag/version to keep it in sync.
  - Storing the last-successful alias map in localStorage and using it when offline.

Recommendations
- Add a short retry loop (2 retries) with backoff in `initCountyAliases()` to reduce flakiness for intermittent network issues.
- Persist last-successful alias map in `localStorage` so the client recovers after a temporary outage (still honors "no static fallback" policy because the stored map is runtime-captured).
- Add integration tests to cover clicking county links and asserting the Reports page receives the expected query param (requires mocking summary/report endpoints or providing test fixtures).

Files changed
- core/nawaapp/views.py  (ETag/version added)
- frontend/src/lib/normalizeCounty.ts (force-fetch, init API)
- frontend/src/lib/__tests__/normalizeFetch.test.ts (unit tests)
- frontend/src/lib/__tests__/normalizeCounty.test.ts (updated tests)
- frontend/src/App.tsx (init moved here, UI warning banner)

How to run tests

cd frontend
npm install
npm test

