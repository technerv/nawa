import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useQuery } from '@tanstack/react-query'
import { api, API_BASE_URL } from '../api/axios'
import { normalizeCountyName } from '../lib/normalizeCounty'
import { showToast } from '../lib/toast'

type PublicMapPoint = {
  id: number
  occurance_book_number?: string
  name_of_crime: string
  status: string
  severity: string
  category_of_crime_name: string | null
  location_name: string | null
  county: string | null
  latitude: number
  longitude: number
  date_updated: string
}

export default function MapboxPreviewPage() {
  const [baseStyle, setBaseStyle] = useState<'vector' | 'satellite' | 'terrain' | 'custom'>('vector')
  const [showCounties, setShowCounties] = useState(false)
  const [showSubCounties, setShowSubCounties] = useState(false)
  const [showConstituencies, setShowConstituencies] = useState(false)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<maplibregl.Map | null>(null)
  const [countyGeo, setCountyGeo] = useState<any | null>(null)
  const [subCountyGeo, setSubCountyGeo] = useState<any | null>(null)
  const [constituencyGeo, setConstituencyGeo] = useState<any | null>(null)
  const points = useQuery({
    queryKey: ['public_map_preview'],
    queryFn: async () => {
      const res = await api.get<PublicMapPoint[]>('/public/map/')
      return res.data
    }
  })

  const featureCollection = useMemo(() => {
    const feats = (points.data || []).map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        name_of_crime: p.name_of_crime,
        severity: p.severity,
        status: p.status,
        category_of_crime_name: p.category_of_crime_name || '—',
        location_name: p.location_name || '',
        county: normalizeCountyName(p.county || ''),
        occurance_book_number: p.occurance_book_number || '',
        date_updated: p.date_updated
      },
      geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] }
    }))
    return { type: 'FeatureCollection', features: feats } as any
  }, [points.data])

  const countyCounts = useMemo(() => {
    const m: Record<string, number> = {}
    const items = (points.data || []) as PublicMapPoint[]
    if (countyGeo && Array.isArray(countyGeo.features)) {
      items.forEach((p) => {
        const name = findCountyForPoint(p.latitude, p.longitude, countyGeo)
        const n = normalizeCountyName(name || '')
        if (!n) return
        m[n] = (m[n] || 0) + 1
      })
    } else {
      items.forEach((p) => {
        const n = normalizeCountyName(p.county || '')
        if (!n) return
        m[n] = (m[n] || 0) + 1
      })
    }
    return m
  }, [points.data, countyGeo])

  function extractCountyName(props: any): string {
    const raw = (props && (props.COUNTY_NAM || props.name || props.NAME)) || ''
    return normalizeCountyName(String(raw))
  }

  function pointInRing(lon: number, lat: number, ring: any[]): boolean {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1]
      const xj = ring[j][0], yj = ring[j][1]
      const intersect = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }
  function geometryContains(geometry: any, lat: number, lon: number): boolean {
    if (!geometry || !geometry.type || !geometry.coordinates) return false
    const ptLon = lon, ptLat = lat
    if (geometry.type === 'Polygon') {
      const rings = geometry.coordinates
      if (!Array.isArray(rings) || rings.length === 0) return false
      const outer = rings[0]
      if (!pointInRing(ptLon, ptLat, outer)) return false
      for (let r = 1; r < rings.length; r++) {
        if (pointInRing(ptLon, ptLat, rings[r])) return false
      }
      return true
    }
    if (geometry.type === 'MultiPolygon') {
      const polys = geometry.coordinates
      for (const poly of polys) {
        const rings = poly
        if (!Array.isArray(rings) || rings.length === 0) continue
        const outer = rings[0]
        if (!pointInRing(ptLon, ptLat, outer)) continue
        let inHole = false
        for (let r = 1; r < rings.length; r++) {
          if (pointInRing(ptLon, ptLat, rings[r])) { inHole = true; break }
        }
        if (!inHole) return true
      }
      return false
    }
    return false
  }
  function findCountyForPoint(lat: number, lon: number, geo: any | null): string | null {
    try {
      const features = geo && (geo.features || geo.data?.features)
      if (!features || !Array.isArray(features)) return null
      for (const f of features) {
        const g = f && f.geometry
        if (!g) continue
        if (geometryContains(g, lat, lon)) {
          const props = (f && f.properties) || {}
          const name = extractCountyName(props)
          return name || null
        }
      }
      return null
    } catch { return null }
  }
  function extractSubCountyName(props: any): string {
    const candidates = ['name','NAME','SubCounty','SUBCOUNTY','subcounty','SC_NAME','SCNAME','Sub_County','SUB_COUNTY','SUB_CNTY','ADM2_EN','ADM2_REF','ADM2_PCODE','DISTRICT','Constituency','CONSTITUENCY','Ward','WARD','Division','DIVISION']
    for (const k of candidates) {
      const v = props && props[k]
      if (typeof v === 'string') {
        const s = v.trim()
        if (s && !/^sub[\- ]?county$/i.test(s) && !/^unknown$/i.test(s) && !/^none$/i.test(s) && !/^null$/i.test(s)) return s
      }
    }
    const keys = Object.keys(props || {})
    for (const k of keys) {
      const v = props && props[k]
      if (typeof v === 'string') {
        const s = v.trim()
        const kl = k.toLowerCase()
        if (s && (kl.includes('name') || kl.includes('subcounty') || kl.includes('sub_county') || kl.includes('ward') || kl.includes('division'))) return s
      }
    }
    let best = ''
    for (const k of keys) {
      const v = props && props[k]
      if (typeof v === 'string') {
        const s = v.trim()
        if (s && /[a-zA-Z]/.test(s) && s.length > best.length && !/kenya/i.test(s) && !/^sub[\- ]?county$/i.test(s)) best = s
      }
    }
    return best || 'Sub-County'
  }
  function findSubCountyForPoint(lat: number, lon: number, geo: any | null): string | null {
    try {
      const features = geo && (geo.features || geo.data?.features)
      if (!features || !Array.isArray(features)) return null
      for (const f of features) {
        const g = f && f.geometry
        if (!g) continue
        if (geometryContains(g, lat, lon)) {
          const props = (f && f.properties) || {}
          const name = extractSubCountyName(props)
          return name || null
        }
      }
      return null
    } catch { return null }
  }

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const envStyle = (import.meta.env.VITE_MAP_STYLE_URL as any) as string | undefined
    const styleUrl = baseStyle === 'custom' && envStyle
      ? envStyle
      : baseStyle === 'vector'
        ? 'https://demotiles.maplibre.org/style.json'
        : baseStyle === 'satellite'
          ? 'https://api.maptiler.com/maps/hybrid/style.json?key=GET_YOUR_KEY'
          : 'https://api.maptiler.com/maps/topo/style.json?key=GET_YOUR_KEY'
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: styleUrl,
      center: [36.817223, -1.286389],
      zoom: 6
    })
    map.addControl(new maplibregl.NavigationControl())
    map.on('load', () => {
      map.addSource('incidents', {
        type: 'geojson',
        data: featureCollection,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50
      } as any)
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'incidents',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#93c5fd', 10,
            '#60a5fa', 50,
            '#3b82f6'
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            14, 10,
            18, 50,
            22
          ]
        }
      })
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'incidents',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['to-string', ['get', 'point_count']],
          'text-size': 12
        },
        paint: {
          'text-color': '#111827'
        }
      })
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'incidents',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match', ['get', 'severity'],
            'low', '#10b981',
            'medium', '#f59e0b',
            'high', '#ef4444',
            'critical', '#7c3aed',
            '#2563eb'
          ],
          'circle-radius': 8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1
        }
      })
    })
    map.on('click', 'clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] }) as any[]
      const clusterId = features[0].properties?.cluster_id
      const source: any = map.getSource('incidents')
      source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) return
        const center = (features[0].geometry as any).coordinates
        map.easeTo({ center: center as any, zoom })
      })
    })
    map.on('click', 'unclustered-point', (e) => {
      const f = e.features?.[0]
      if (!f) return
      const props: any = f.properties || {}
      const coords: any = f.geometry && (f.geometry as any).coordinates
      const lat = coords[1]
      const lon = coords[0]
      const countyName = findCountyForPoint(lat, lon, countyGeo) || props.county || '—'
      const scName = findSubCountyForPoint(lat, lon, subCountyGeo) || '—'
      const coordText = `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}`
      const path = `/public/track?${props.occurance_book_number ? `ob=${encodeURIComponent(props.occurance_book_number)}` : `id=${props.id}`}`
      const trackUrl = `${window.location.origin}${path}`
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
      const loc = props.location_name || coordText
      const text = `Alert: ${props.name_of_crime}\nCounty: ${normalizeCountyName(countyName)}\nSub-County: ${scName}\nLocation: ${loc}\nGPS: ${mapsUrl}\nTrack: ${trackUrl}`
      const html = `
        <div style="display:flex;flex-direction:column;gap:6px;max-width:260px">
          <strong>${props.name_of_crime}</strong>
          <small>Severity: ${props.severity} · Status: ${props.status}</small>
          <small>County: ${normalizeCountyName(countyName)}</small>
          <small>Sub-County: ${scName}</small>
          <small>Location: ${loc} (${coordText})</small>
          <div style="display:flex;gap:8;margin-top:4px">
            <button id="btn-open-sos" style="padding:6px 10px;background:#dc2626;color:white;border-radius:6px">Open SOS</button>
            <button id="btn-wa" style="padding:6px 10px;background:#25D366;color:#111827;border-radius:6px">Send via WhatsApp</button>
            <a id="btn-track" href="${path}" style="padding:6px 10px;background:#f59e0b;color:#111827;border-radius:6px;text-decoration:none;font-weight:600">Track Case</a>
          </div>
        </div>
      `
      const popup = new maplibregl.Popup({ closeButton: true })
        .setLngLat([lon, lat])
        .setHTML(html)
        .addTo(map)
      setTimeout(() => {
        const sos = document.getElementById('btn-open-sos')
        const wa = document.getElementById('btn-wa')
        sos?.addEventListener('click', () => {
          const message = `[${String(props.severity || '').toUpperCase()}] SOS: ${props.name_of_crime} — ${loc}`
          const payload = { latitude: lat, longitude: lon, location_name: loc, county: countyName }
          window.dispatchEvent(new CustomEvent('open_sos', { detail: { payload, message } }))
        })
        wa?.addEventListener('click', () => {
          const url = `https://wa.me/?text=${encodeURIComponent(text)}`
          window.open(url, '_blank')
        })
      }, 0)
    })
    mapInstance.current = map
    return () => { map.remove(); mapInstance.current = null }
  }, [mapRef.current])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    const src: any = map.getSource('incidents')
    if (src && featureCollection) src.setData(featureCollection)
  }, [featureCollection])

  useEffect(() => {
    if (!showCounties || countyGeo) return
    const url = 'https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/counties.geojson'
    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then((data) => setCountyGeo(data))
      .catch(() => {})
  }, [showCounties, countyGeo])

  useEffect(() => {
    if (subCountyGeo) return
    const backend = `${API_BASE_URL}/public/subcounties_geojson/`
    const primary = 'https://ckan.africadatahub.org/dataset/ebfdedaa-b9c4-442e-9144-72f2303105c5/resource/650999c2-c1f7-4acb-9bbb-d3af84a6a04b/download/kenya-subcounties-simplified.geojson'
    const fallback = 'https://raw.githubusercontent.com/Mondieki/kenya-counties-subcounties/master/geojson/subcounties.geojson'
    fetch(backend, { headers: { 'Accept': 'application/json' } })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then((data) => setSubCountyGeo(data))
      .catch(() => {
        fetch(primary, { headers: { 'Accept': 'application/json' } })
          .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
          .then((data) => setSubCountyGeo(data))
          .catch(() => {
            fetch(fallback, { headers: { 'Accept': 'application/json' } })
              .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
              .then((data) => setSubCountyGeo(data))
              .catch(() => { showToast('Failed to load sub-counties', 'error') })
          })
      })
  }, [subCountyGeo])

  useEffect(() => {
    if (!showConstituencies || constituencyGeo) return
    const backend = `${API_BASE_URL}/public/constituencies_geojson/`
    const fallback = 'https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/constituencies.geojson'
    fetch(backend, { headers: { 'Accept': 'application/json' } })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then((data) => setConstituencyGeo(data))
      .catch(() => {
        fetch(fallback, { headers: { 'Accept': 'application/json' } })
          .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
          .then((data) => setConstituencyGeo(data))
          .catch(() => { showToast('Failed to load constituencies', 'error') })
      })
  }, [showConstituencies, constituencyGeo])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    if (showCounties && countyGeo) {
      const augmented = {
        type: 'FeatureCollection',
        features: (countyGeo.features || []).map((f: any) => {
          const name = extractCountyName(f.properties || {})
          const count = countyCounts[name] || 0
          return { ...f, properties: { ...(f.properties || {}), name, count } }
        })
      }
      if (!map.getSource('counties')) {
        map.addSource('counties', { type: 'geojson', data: augmented } as any)
        map.addLayer({
          id: 'counties-fill',
          type: 'fill',
          source: 'counties',
          paint: {
            'fill-color': [
              'step', ['get', 'count'],
              '#e5e7eb', 1,
              '#dbeafe', 5,
              '#a5b4fc', 10,
              '#818cf8', 20,
              '#6366f1'
            ],
            'fill-opacity': 0.12
          }
        })
        map.addLayer({ id: 'counties-line', type: 'line', source: 'counties', paint: { 'line-color': '#7c3aed', 'line-width': 1 } })
      } else {
        const src: any = map.getSource('counties')
        src.setData(augmented)
      }
    } else {
      if (map.getLayer('counties-fill')) map.removeLayer('counties-fill')
      if (map.getLayer('counties-line')) map.removeLayer('counties-line')
      if (map.getSource('counties')) map.removeSource('counties')
    }
  }, [showCounties, countyGeo, countyCounts])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    if (showSubCounties && subCountyGeo) {
      if (!map.getSource('subcounties')) {
        map.addSource('subcounties', { type: 'geojson', data: subCountyGeo } as any)
        map.addLayer({ id: 'subcounties-line', type: 'line', source: 'subcounties', paint: { 'line-color': '#059669', 'line-width': 1 } })
      } else {
        const src: any = map.getSource('subcounties')
        src.setData(subCountyGeo)
      }
    } else {
      if (map.getLayer('subcounties-line')) map.removeLayer('subcounties-line')
      if (map.getSource('subcounties')) map.removeSource('subcounties')
    }
  }, [showSubCounties, subCountyGeo])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    if (showConstituencies && constituencyGeo) {
      if (!map.getSource('constituencies')) {
        map.addSource('constituencies', { type: 'geojson', data: constituencyGeo } as any)
        map.addLayer({ id: 'constituencies-line', type: 'line', source: 'constituencies', paint: { 'line-color': '#0ea5e9', 'line-width': 1 } })
      } else {
        const src: any = map.getSource('constituencies')
        src.setData(constituencyGeo)
      }
    } else {
      if (map.getLayer('constituencies-line')) map.removeLayer('constituencies-line')
      if (map.getSource('constituencies')) map.removeSource('constituencies')
    }
  }, [showConstituencies, constituencyGeo])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return
    const envStyle = (import.meta.env.VITE_MAP_STYLE_URL as any) as string | undefined
    const styleUrl = baseStyle === 'custom' && envStyle
      ? envStyle
      : baseStyle === 'vector'
        ? 'https://demotiles.maplibre.org/style.json'
        : baseStyle === 'satellite'
          ? 'https://api.maptiler.com/maps/hybrid/style.json?key=GET_YOUR_KEY'
          : 'https://api.maptiler.com/maps/topo/style.json?key=GET_YOUR_KEY'
    map.setStyle(styleUrl)
    map.once('styledata', () => {
      const exists = map.getSource('incidents')
      if (!exists) {
        map.addSource('incidents', {
          type: 'geojson',
          data: featureCollection,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 50
        } as any)
        map.addLayer({ id: 'clusters', type: 'circle', source: 'incidents', filter: ['has', 'point_count'], paint: { 'circle-color': ['step', ['get', 'point_count'], '#93c5fd', 10, '#60a5fa', 50, '#3b82f6'], 'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 22] } })
        map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'incidents', filter: ['has', 'point_count'], layout: { 'text-field': ['to-string', ['get', 'point_count']], 'text-size': 12 }, paint: { 'text-color': '#111827' } })
        map.addLayer({ id: 'unclustered-point', type: 'circle', source: 'incidents', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ['match', ['get', 'severity'], 'low', '#10b981', 'medium', '#f59e0b', 'high', '#ef4444', 'critical', '#7c3aed', '#2563eb'], 'circle-radius': 8, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 } })
      }
    })
  }, [baseStyle])

  return (
    <div>
      <h2>Vector Map Preview</h2>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => points.refetch()}>Refresh</button>
          <select value={baseStyle} onChange={(e) => setBaseStyle(e.target.value as any)}>
            <option value="vector">Vector</option>
            <option value="satellite">Satellite</option>
            <option value="terrain">Terrain</option>
            <option value="custom">Custom (env)</option>
          </select>
          <small style={{ opacity: .8 }}>Satellite/Terrain or Custom may require a provider key.</small>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={showCounties} onChange={(e) => setShowCounties(e.target.checked)} />
            Show counties
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={showSubCounties} onChange={(e) => setShowSubCounties(e.target.checked)} />
            Show sub-counties
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={showConstituencies} onChange={(e) => setShowConstituencies(e.target.checked)} />
            Show constituencies
          </label>
        </div>
      </div>
      {points.isError && (
        <div style={{ color: '#fecaca', marginBottom: 12 }}>Failed to load map points.</div>
      )}
      <div ref={mapRef} style={{ height: '85vh', width: '100%', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, overflow: 'hidden' }} />
    </div>
  )
}
