import { useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer, useMap, GeoJSON, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { api, API_BASE_URL } from '../api/axios'
import { defaultMarkerIcon } from '../lib/leafletIcons'
import { showToast } from '../lib/toast'
import { normalizeCountyName } from '../lib/normalizeCounty'

type PublicMapPoint = {
	id: number
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

export default function PublicMapPage() {
    const [severity, setSeverity] = useState<string>('')
	const [fitTo, setFitTo] = useState<{ lat?: number; lon?: number } | null>(null)
    const [newPoint, setNewPoint] = useState<{ lat: number; lon: number } | null>(null)
    const [showCounties, setShowCounties] = useState(false)
    const [countyGeo, setCountyGeo] = useState<any | null>(null)
    const [showSubCounties, setShowSubCounties] = useState(false)
    const [subCountyGeo, setSubCountyGeo] = useState<any | null>(null)
	const query = useQuery({
		queryKey: ['public_map'],
		queryFn: async () => {
			const res = await api.get<PublicMapPoint[]>('/public/map/')
			return res.data
		}
	})

	useEffect(() => {
		function onCreated(e: any) {
			const { lat, lon } = e.detail || {}
			if (typeof lat === 'number' && typeof lon === 'number') {
				setFitTo({ lat, lon })
				setNewPoint({ lat, lon })
				showToast('Report added on map', 'success')
			}
			query.refetch()
			setTimeout(() => { setFitTo(null); setNewPoint(null) }, 5000)
		}
		window.addEventListener('public_report_created', onCreated as any)
		return () => window.removeEventListener('public_report_created', onCreated as any)
	}, [])

    useEffect(() => {
        if (!showCounties || countyGeo) return
        const cached = (() => {
            try {
                const raw = localStorage.getItem('nawa_county_geo_v1')
                const tsRaw = localStorage.getItem('nawa_county_geo_ts_v1')
                const ts = tsRaw ? Number(tsRaw) : 0
                const now = Date.now()
                const sevenDays = 7 * 24 * 3600 * 1000
                if (raw && now - ts < sevenDays) return JSON.parse(raw)
            } catch {}
            return null
        })()
        if (cached) { setCountyGeo(cached); return }
        const controller = new AbortController()
        const url = 'https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/counties.geojson'
        fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
            .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
            .then((data) => {
                setCountyGeo(data)
                try {
                    localStorage.setItem('nawa_county_geo_v1', JSON.stringify(data))
                    localStorage.setItem('nawa_county_geo_ts_v1', String(Date.now()))
                } catch {}
            })
            .catch(() => {})
        return () => controller.abort()
    }, [showCounties, countyGeo])

    useEffect(() => {
        if (!showSubCounties || subCountyGeo) return
        const controller = new AbortController()
        const backend = `${API_BASE_URL}/public/subcounties_geojson/`
        const primary = 'https://ckan.africadatahub.org/dataset/ebfdedaa-b9c4-442e-9144-72f2303105c5/resource/650999c2-c1f7-4acb-9bbb-d3af84a6a04b/download/kenya-subcounties-simplified.geojson'
        const fallback = 'https://raw.githubusercontent.com/Mondieki/kenya-counties-subcounties/master/geojson/subcounties.geojson'
        fetch(backend, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
            .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
            .then((data) => setSubCountyGeo(data))
            .catch(() => {
                fetch(primary, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
                    .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
                    .then((data) => setSubCountyGeo(data))
                    .catch(() => {
                        fetch(fallback, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
                            .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
                            .then((data) => setSubCountyGeo(data))
                            .catch(() => { showToast('Failed to load sub-counties', 'error') })
                    })
            })
        return () => controller.abort()
    }, [showSubCounties, subCountyGeo])

    const countyCounts = useMemo(() => {
        const m: Record<string, number> = {}
        const items: PublicMapPoint[] = (query.data || []) as PublicMapPoint[]
        items.forEach((p: PublicMapPoint) => {
            const name = normalizeCountyName(p.county || '')
            if (!name) return
            m[name] = (m[name] || 0) + 1
        })
        return m
    }, [query.data])

    const maxCount = useMemo(() => {
        let max = 0
        Object.values(countyCounts).forEach((v) => { if (v > max) max = v })
        return max
    }, [countyCounts])

    function colorFor(v: number, max: number): string {
        if (max <= 0 || v <= 0) return '#e5e7eb'
        const r = v / max
        if (r < 0.2) return '#dbeafe'
        if (r < 0.4) return '#a5b4fc'
        if (r < 0.6) return '#818cf8'
        if (r < 0.8) return '#6366f1'
        return '#4338ca'
    }

	const center: [number, number] = [-1.286389, 36.817223]

	return (
		<div>
			<h2>Public Map</h2>
            <div className="row mb-3">
                <button type="button" onClick={() => setShowCounties((v) => !v)}>{showCounties ? 'Hide Counties' : 'Show Counties'}</button>
                <button type="button" onClick={() => setShowSubCounties((v) => !v)}>{showSubCounties ? 'Hide Sub-Counties' : 'Show Sub-Counties'}</button>
                <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                    <option value="">All severities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                </select>
            </div>
			<div style={{ height: '70vh', width: '100%', border: '1px solid #ccc', borderRadius: 8, overflow: 'hidden' }}>
                <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
                    {showCounties && (
                        <div style={{ position: 'absolute', zIndex: 1000, left: 10, top: 10, background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: 8 }}>
                            <strong>County color scale</strong>
                            <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: colorFor(0, maxCount), display: 'inline-block' }}></span>
                                    <span>0</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: colorFor(Math.max(1, Math.floor(maxCount * 0.1)), maxCount), display: 'inline-block' }}></span>
                                    <span>≤ 20% of max</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: colorFor(Math.floor(maxCount * 0.3), maxCount), display: 'inline-block' }}></span>
                                    <span>≤ 40% of max</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: colorFor(Math.floor(maxCount * 0.5), maxCount), display: 'inline-block' }}></span>
                                    <span>≤ 60% of max</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: colorFor(Math.floor(maxCount * 0.7), maxCount), display: 'inline-block' }}></span>
                                    <span>≤ 80% of max</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: colorFor(maxCount, maxCount), display: 'inline-block' }}></span>
                                    <span>{'>'} 80% of max</span>
                                </div>
                            </div>
                        </div>
                    )}
					<TileLayer
						attribution='&copy; OpenStreetMap contributors'
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					/>
					{fitTo && fitTo.lat != null && fitTo.lon != null && <FitToPoint lat={fitTo.lat} lon={fitTo.lon} />}
					{newPoint && (
						<CircleMarker center={[newPoint.lat, newPoint.lon]} radius={10} pathOptions={{ color: '#2b6cb0', fillColor: '#2b6cb0', fillOpacity: 0.2 }} />
					)}
                    {showCounties && countyGeo && (
                        <GeoJSON
                            data={countyGeo}
                            style={(feature: any) => {
                                const raw = (feature && feature.properties && (feature.properties.COUNTY_NAM || feature.properties.name)) || ''
                                const name = normalizeCountyName(String(raw))
                                const v = countyCounts[name] || 0
                                return { color: '#7c3aed', weight: 1, fillOpacity: 0.12, fillColor: colorFor(v, maxCount) }
                            }}
                            onEachFeature={(feature: any, layer: any) => {
                                const raw = (feature && feature.properties && (feature.properties.COUNTY_NAM || feature.properties.name)) || ''
                                const name = normalizeCountyName(String(raw))
                                const v = countyCounts[name] || 0
                                layer.bindPopup(`${name}${v ? ` — ${v} incident${v === 1 ? '' : 's'}` : ''}`)
                                try { layer.on('click', () => { try { (layer as any)._map.fitBounds(layer.getBounds(), { padding: [20, 20] }) } catch {} }) } catch {}
                            }}
                        />
                    )}
                    {showSubCounties && subCountyGeo && (
                        <GeoJSON
                            data={subCountyGeo}
                            style={() => ({ color: '#059669', weight: 1, fillOpacity: 0.06 })}
                            onEachFeature={(feature: any, layer: any) => {
                                const props = (feature && feature.properties) || {}
                                const candidates = ['name','NAME','SubCounty','SUBCOUNTY','subcounty','SC_NAME','SCNAME','Sub_County','SUB_COUNTY','SUB_CNTY']
                                let raw = ''
                                for (const k of candidates) {
                                    const v = props[k]
                                    if (typeof v === 'string' && v.trim() && !/^sub[- ]?county$/i.test(v)) { raw = v.trim(); break }
                                }
                                const name = raw || 'Sub-County'
                                try { layer.bindTooltip(name, { sticky: true }) } catch {}
                                layer.bindPopup(name)
                                try { layer.on('click', () => { try { (layer as any)._map.fitBounds(layer.getBounds(), { padding: [20, 20] }) } catch {} }) } catch {}
                            }}
                        />
                    )}
                    {(query.data || []).length > 0 && (
                        <div style={{ position: 'absolute', zIndex: 1000, right: 10, bottom: 10, background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: 8 }}>
                            <strong>Severity</strong>
                            <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: '#10b981', display: 'inline-block' }}></span>
                                    <span>Low</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: '#f59e0b', display: 'inline-block' }}></span>
                                    <span>Medium</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: '#ef4444', display: 'inline-block' }}></span>
                                    <span>High</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: '#7c3aed', display: 'inline-block' }}></span>
                                    <span>Critical</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {(query.data || []).filter((p) => !severity || String(p.severity).toLowerCase() === severity).map((p) => {
                        const sc = (sev: string) => {
                            const s = String(sev || '').toLowerCase()
                            if (s === 'low') return '#10b981'
                            if (s === 'medium') return '#f59e0b'
                            if (s === 'high') return '#ef4444'
                            if (s === 'critical') return '#7c3aed'
                            return '#2563eb'
                        }
                        const icon = L.divIcon({ className: 'leaflet-div-icon', html: `<span class="pulse-marker" style="--pulse-color:${sc(p.severity)}"></span>`, iconSize: [16,16], iconAnchor: [8,8] })
                        return (
                            <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icon}>
                                <Popup>
                                    <strong>{p.name_of_crime}</strong>
                                    <br />
                                    {p.category_of_crime_name || '—'} · {p.severity}
                                    <br />
                                    {p.location_name || p.county || '—'}
                                    <br />
                                    Updated: {new Date(p.date_updated).toLocaleString()}
                                </Popup>
                            </Marker>
                        )
                    })}
                </MapContainer>
			</div>
		</div>
	)
}

function FitToPoint({ lat, lon }: { lat: number; lon: number }) {
	const map = useMap()
	useEffect(() => {
		map.setView([lat, lon], 14)
	}, [lat, lon])
	return null
}
