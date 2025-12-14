import { useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer, useMap, GeoJSON, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { listNeighborhoods } from '../api/neighborhood'
import { api, API_BASE_URL } from '../api/axios'
import { defaultMarkerIcon, createSeverityIcon } from '../lib/leafletIcons'
import { formatDate } from '../lib/dateFormat'
import { formatLocation, formatLocationForSOS } from '../lib/locationFormat'
import { showToast } from '../lib/toast'
import { normalizeCountyName } from '../lib/normalizeCounty'

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

export default function PublicMapPage() {
    const [severity, setSeverity] = useState<string>('')
	const [fitTo, setFitTo] = useState<{ lat?: number; lon?: number } | null>(null)
    const [newPoint, setNewPoint] = useState<{ lat: number; lon: number } | null>(null)
    const [showCounties, setShowCounties] = useState(false)
    const [countyGeo, setCountyGeo] = useState<any | null>(null)
    const [showSubCounties, setShowSubCounties] = useState(false)
    const [subCountyGeo, setSubCountyGeo] = useState<any | null>(null)
    const [showConstituencies, setShowConstituencies] = useState(false)
    const [constituencyGeo, setConstituencyGeo] = useState<any | null>(null)
    const [showNeighborhoods, setShowNeighborhoods] = useState(false)
    const [colorByDensity, setColorByDensity] = useState(true)
    const [fitKenyaTick, setFitKenyaTick] = useState(0)
    const [baseMap, setBaseMap] = useState<'standard' | 'satellite' | 'terrain'>('standard')
	const query = useQuery({
		queryKey: ['public_map'],
		queryFn: async () => {
			const res = await api.get<PublicMapPoint[]>('/public/map/')
			return res.data
		}
	})

    const neighborhoods = useQuery({
        queryKey: ['neighborhoods_all'],
        queryFn: async () => (await listNeighborhoods()).results,
        enabled: showNeighborhoods,
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
        if (subCountyGeo) return
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
    }, [subCountyGeo])

    useEffect(() => {
        if (!showConstituencies || constituencyGeo) return
        const controller = new AbortController()
        const backend = `${API_BASE_URL}/public/constituencies_geojson/`
        const fallback = 'https://raw.githubusercontent.com/mikelmaron/kenya-election-data/master/data/constituencies.geojson'
        fetch(backend, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
            .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
            .then((data) => setConstituencyGeo(data))
            .catch(() => {
                fetch(fallback, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
                    .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
                    .then((data) => setConstituencyGeo(data))
                    .catch(() => { showToast('Failed to load constituencies', 'error') })
            })
        return () => controller.abort()
    }, [showConstituencies, constituencyGeo])

    const countyCounts = useMemo(() => {
        const m: Record<string, number> = {}
        const items: PublicMapPoint[] = (query.data || []) as PublicMapPoint[]
        items.forEach((p: PublicMapPoint) => {
            const scName = findSubCountyForPoint(p.latitude, p.longitude, subCountyGeo)
            const fromSub = normalizeCountyName(scName || '')
            const fromField = normalizeCountyName(p.county || '')
            const name = fromSub || fromField
            if (!name) return
            m[name] = (m[name] || 0) + 1
        })
        return m
    }, [query.data, subCountyGeo])

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
		<div className="space-y-6">
			<div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6 mb-6">
				<h2 className="text-3xl font-bold mb-2">Public Map</h2>
				<p className="text-gray-100 text-sm">View crime incidents on an interactive map</p>
			</div>
			<div style={{ height: '85vh', width: '100%', border: '1px solid #ccc', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                {/* Left Side Controls - Map Properties */}
                <div style={{ position: 'absolute', zIndex: 1000, left: 12, top: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button 
                        type="button" 
                        onClick={() => { query.refetch(); neighborhoods.refetch() }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2 text-sm"
                        title="Refresh map data"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setFitKenyaTick((t) => t + 1)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-lg flex items-center gap-2 text-sm"
                        title="Zoom to Kenya"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                        Zoom to Kenya
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setShowNeighborhoods((v) => !v)}
                        className={`px-3 py-2 rounded-lg font-medium transition-colors shadow-lg flex items-center gap-2 border text-sm ${
                            showNeighborhoods 
                                ? 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700' 
                                : 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {showNeighborhoods ? 'Hide' : 'Show'} Neighborhoods
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setShowCounties((v) => !v)}
                        className={`px-3 py-2 rounded-lg font-medium transition-colors shadow-lg flex items-center gap-2 border text-sm ${
                            showCounties 
                                ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700' 
                                : 'bg-indigo-100 text-indigo-700 border-indigo-300 hover:bg-indigo-200'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        {showCounties ? 'Hide' : 'Show'} Counties
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setShowSubCounties((v) => !v)}
                        className={`px-3 py-2 rounded-lg font-medium transition-colors shadow-lg flex items-center gap-2 border text-sm ${
                            showSubCounties 
                                ? 'bg-teal-600 text-white border-teal-700 hover:bg-teal-700' 
                                : 'bg-teal-100 text-teal-700 border-teal-300 hover:bg-teal-200'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                        </svg>
                        {showSubCounties ? 'Hide' : 'Show'} Sub-Counties
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setShowConstituencies((v) => !v)}
                        className={`px-3 py-2 rounded-lg font-medium transition-colors shadow-lg flex items-center gap-2 border text-sm ${
                            showConstituencies 
                                ? 'bg-cyan-600 text-white border-cyan-700 hover:bg-cyan-700' 
                                : 'bg-cyan-100 text-cyan-700 border-cyan-300 hover:bg-cyan-200'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {showConstituencies ? 'Hide' : 'Show'} Constituencies
                    </button>
                    <label className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium cursor-pointer hover:bg-orange-200 transition-colors shadow-lg flex items-center gap-2 border border-orange-300 text-sm">
                        <input 
                            type="checkbox" 
                            checked={colorByDensity} 
                            onChange={(e) => setColorByDensity(e.target.checked)}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                        />
                        Color by Density
                </label>
                    <select 
                        value={baseMap} 
                        onChange={(e) => setBaseMap(e.target.value as any)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium border border-gray-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-colors shadow-lg text-sm"
                    >
                    <option value="standard">Standard</option>
                    <option value="satellite">Satellite</option>
                    <option value="terrain">Terrain</option>
                </select>
                </div>

                {/* Right Side Controls - Severity Filter */}
                <div style={{ position: 'absolute', zIndex: 1000, right: 12, top: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <select 
                        value={severity} 
                        onChange={(e) => setSeverity(e.target.value)}
                        className="px-3 py-2 bg-red-50 text-red-700 rounded-lg font-medium border border-red-200 hover:bg-red-100 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors shadow-lg text-sm"
                        title="Filter by severity"
                    >
                    <option value="">All severities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                </select>
            </div>

                <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
                    <FitKenya tick={fitKenyaTick} />
                    {showCounties && (
                        <div style={{ position: 'absolute', zIndex: 1000, left: 12, bottom: 12, background: 'rgba(255,255,255,0.95)', border: '1px solid #ddd', borderRadius: 6, padding: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
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
                    {baseMap === 'standard' && (
                        <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                    )}
                    {baseMap === 'satellite' && (
                        <TileLayer
                            attribution='Tiles © Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            maxZoom={19}
                        />
                    )}
                    {baseMap === 'terrain' && (
                        <TileLayer
                            attribution='Map data: &copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)'
                            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                            maxZoom={17}
                        />
                    )}
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
                                return { color: '#7c3aed', weight: 1, fillOpacity: colorByDensity ? 0.12 : 0.06, fillColor: colorByDensity ? colorFor(v, maxCount) : '#e5e7eb' }
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
                    {showNeighborhoods && (neighborhoods.data || []).length > 0 && (
                        <GeoJSON
                            data={{ type: 'FeatureCollection', features: (neighborhoods.data || []).filter((n) => n.polygon).map((n) => ({ type: 'Feature', properties: { id: n.id, name: n.name }, geometry: n.polygon })) } as any}
                            style={() => ({ color: '#2563eb', weight: 2, fillOpacity: 0.06 })}
                            onEachFeature={(feature: any, layer: any) => {
                                const props = (feature && feature.properties) || {}
                                const name = props.name || 'Neighborhood'
                                const id = props.id
                                const html = id ? `<div>${name} <br/><a href="/neighborhood/${id}">Open</a></div>` : String(name)
                                layer.bindPopup(html)
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
                                const name = extractSubCountyName(props)
                                try { layer.bindTooltip(name, { sticky: true }) } catch {}
                                layer.bindPopup(name)
                                try { layer.on('click', () => { try { (layer as any)._map.fitBounds(layer.getBounds(), { padding: [20, 20] }) } catch {} }) } catch {}
                            }}
                        />
                    )}
                    {showConstituencies && constituencyGeo && (
                        <GeoJSON
                            data={constituencyGeo}
                            style={() => ({ color: '#0ea5e9', weight: 1, fillOpacity: 0.06 })}
                            onEachFeature={(feature: any, layer: any) => {
                                const props = (feature && feature.properties) || {}
                                const name = extractConstituencyName(props)
                                try { layer.bindTooltip(name, { sticky: true }) } catch {}
                                layer.bindPopup(name)
                                try { layer.on('click', () => { try { (layer as any)._map.fitBounds(layer.getBounds(), { padding: [20, 20] }) } catch {} }) } catch {}
                            }}
                        />
                    )}
                    {(query.data || []).length > 0 && (
                        <div style={{ position: 'absolute', zIndex: 1000, right: 12, bottom: 12, background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(148,163,184,0.7)', borderRadius: 14, padding: '10px 12px', boxShadow: '0 10px 25px rgba(0,0,0,0.6)' }}>
                            <div style={{ fontSize: 12, letterSpacing: 0.2, textTransform: 'uppercase', opacity: 0.9, marginBottom: 4, fontWeight: 600 }}>Severity Legend</div>
                            <div style={{ display: 'grid', gap: 6, marginTop: 2 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 999, background: '#10b981', border: '1px solid rgba(15,23,42,0.9)', boxShadow: '0 0 0 1px rgba(148,163,184,0.8)' }}></span>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>Low</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 999, background: '#f59e0b', border: '1px solid rgba(15,23,42,0.9)', boxShadow: '0 0 0 1px rgba(148,163,184,0.8)' }}></span>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>Medium</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 999, background: '#ef4444', border: '1px solid rgba(15,23,42,0.9)', boxShadow: '0 0 0 1px rgba(148,163,184,0.8)' }}></span>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>High</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 999, background: '#7c3aed', border: '1px solid rgba(15,23,42,0.9)', boxShadow: '0 0 0 1px rgba(148,163,184,0.8)' }}></span>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>Critical</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {(query.data || []).filter((p) => !severity || String(p.severity).toLowerCase() === severity).map((p) => {
                        const icon = createSeverityIcon(p.severity || '')
                        const scName = findSubCountyForPoint(p.latitude, p.longitude, subCountyGeo)
                        const normalizedFromSub = normalizeCountyName(scName || '')
                        const normalizedFromField = normalizeCountyName(p.county || '')
                        const countyName = normalizedFromSub || normalizedFromField
                        const coords = `${p.latitude?.toFixed ? p.latitude.toFixed(6) : p.latitude}, ${p.longitude?.toFixed ? p.longitude.toFixed(6) : p.longitude}`
                        return (
                            <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icon}>
                                <Popup>
                                    <strong>{p.name_of_crime}</strong>
                                    <br />
                                    Case ID: {p.id}
                                    <br />
                                    OB: {p.occurance_book_number || '—'}
                                    <br />
                                    Type: {p.category_of_crime_name || '—'}
                                    <br />
                                    County: {countyName || '—'}
                                    <br />
                                    Sub-County: {scName || '—'}
                                    <br />
                                    Location: {formatLocation(p.location_name, countyName, scName, p.latitude, p.longitude)} ({coords})
                                    <br />
                                    Severity: {p.severity}
                                    <br />
                                    Updated: {formatDate(p.date_updated)}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <button
                                            style={{ padding: '6px 10px', background: '#dc2626', color: 'white', borderRadius: 6 }}
                                            onClick={() => {
                                                const loc = formatLocationForSOS(p.location_name, countyName, p.latitude, p.longitude)
                                                const message = `[${String(p.severity || '').toUpperCase()}] SOS: ${p.name_of_crime} — ${loc}`
                                                const payload = { latitude: p.latitude, longitude: p.longitude, location_name: loc, county: countyName }
                                                window.dispatchEvent(new CustomEvent('open_sos', { detail: { payload, message } }))
                                            }}
                                        >
                                            Open SOS
                                        </button>
                                        <button
                                            style={{ padding: '6px 10px', background: '#25D366', color: '#111827', borderRadius: 6 }}
                                            onClick={() => {
                                                const path = `/public/track?${p.occurance_book_number ? `ob=${encodeURIComponent(p.occurance_book_number)}` : `id=${p.id}`}`
                                                const trackUrl = `${window.location.origin}${path}`
                                                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`
                                                const loc = p.location_name || coords
                                                const text = `Alert: ${p.name_of_crime}\nCounty: ${countyName || '—'}\nSub-County: ${scName || '—'}\nLocation: ${loc}\nGPS: ${mapsUrl}\nTrack: ${trackUrl}`
                                                const url = `https://wa.me/?text=${encodeURIComponent(text)}`
                                                window.open(url, '_blank')
                                            }}
                                        >
                                            Send via WhatsApp
                                        </button>
                                        <a
                                            href={`/public/track?${p.occurance_book_number ? `ob=${encodeURIComponent(p.occurance_book_number)}` : `id=${p.id}`}`}
                                            style={{ padding: '6px 10px', background: '#f59e0b', color: '#111827', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}
                                        >
                                            Track Case
                                        </a>
                                    </div>
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

function FitKenya({ tick }: { tick: number }) {
    const map = useMap()
    useEffect(() => {
        map.setView([-1.286389, 36.817223], 6)
    }, [tick])
    return null
}
function extractSubCountyName(props: any): string {
    if (!props || typeof props !== 'object') return 'Sub-County'
    const candidates = ['name','NAME','SubCounty','SUBCOUNTY','subcounty','SC_NAME','SCNAME','Sub_County','SUB_COUNTY','SUB_CNTY','ADM2_EN','ADM2_REF','ADM2_PCODE','DISTRICT','Constituency','CONSTITUENCY','Ward','WARD','Division','DIVISION']
    for (const k of candidates) {
        const v = props[k]
        if (typeof v === 'string') {
            const s = v.trim()
            if (s && !/^sub[\- ]?county$/i.test(s) && !/^unknown$/i.test(s) && !/^none$/i.test(s) && !/^null$/i.test(s)) return s
        }
    }
    const keys = Object.keys(props)
    for (const k of keys) {
        const v = props[k]
        if (typeof v === 'string') {
            const s = v.trim()
            const kl = k.toLowerCase()
            if (s && (kl.includes('name') || kl.includes('subcounty') || kl.includes('sub_county') || kl.includes('ward') || kl.includes('division'))) return s
        }
    }
    let best = ''
    for (const k of keys) {
        const v = props[k]
        if (typeof v === 'string') {
            const s = v.trim()
            if (s && /[a-zA-Z]/.test(s) && s.length > best.length && !/kenya/i.test(s) && !/^sub[\- ]?county$/i.test(s)) best = s
        }
    }
    return best || 'Sub-County'
}
function extractConstituencyName(props: any): string {
    if (!props || typeof props !== 'object') return 'Constituency'
    const candidates = ['Constituency','CONSTITUENCY','constituency','name','NAME','ADM2_EN','DISTRICT']
    for (const k of candidates) {
        const v = props[k]
        if (typeof v === 'string') {
            const s = v.trim()
            if (s && !/^constituency$/i.test(s) && !/^unknown$/i.test(s) && !/^none$/i.test(s) && !/^null$/i.test(s)) return s
        }
    }
    const keys = Object.keys(props)
    for (const k of keys) {
        const v = props[k]
        if (typeof v === 'string') {
            const s = v.trim()
            const kl = k.toLowerCase()
            if (s && (kl.includes('constituency') || kl.includes('name'))) return s
        }
    }
    let best = ''
    for (const k of keys) {
        const v = props[k]
        if (typeof v === 'string') {
            const s = v.trim()
            if (s && /[a-zA-Z]/.test(s) && s.length > best.length && !/kenya/i.test(s) && !/^constituency$/i.test(s)) best = s
        }
    }
    return best || 'Constituency'
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
