import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Tooltip, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { listCrimeReportMapPoints } from '../api/crime'
import { API_BASE_URL } from '../api/axios'
import { Link, useNavigate } from 'react-router-dom'
import { defaultMarkerIcon, createSeverityIcon } from '../lib/leafletIcons'
import { formatDate } from '../lib/dateFormat'
import { formatLocation, formatLocationForSOS } from '../lib/locationFormat'
import { listNeighborhoods, neighborhoodAlertCounts } from '../api/neighborhood'
import { showToast } from '../lib/toast'
import { normalizeCountyName } from '../lib/normalizeCounty'

const DEFAULT_CENTER: [number, number] = [-1.286389, 36.817223] // Nairobi CBD
const KENYA_BOUNDS: [[number, number], [number, number]] = [[-4.7, 33.9], [5.5, 41.9]]

export default function MapPage() {
	const [severity, setSeverity] = useState<string>('')
	const [status, setStatus] = useState<string>('')
	const [fitKenyaTick, setFitKenyaTick] = useState<number>(0)
    const [showNeighborhoods, setShowNeighborhoods] = useState<boolean>(false)
    const [hoveredId, setHoveredId] = useState<number | null>(null)
    const [showCounties, setShowCounties] = useState<boolean>(false)
    const [countyGeo, setCountyGeo] = useState<any | null>(null)
    const [showSubCounties, setShowSubCounties] = useState<boolean>(false)
    const [subCountyGeo, setSubCountyGeo] = useState<any | null>(null)
    const [showConstituencies, setShowConstituencies] = useState<boolean>(false)
    const [constituencyGeo, setConstituencyGeo] = useState<any | null>(null)
    const [baseMap, setBaseMap] = useState<'standard' | 'satellite' | 'terrain'>('standard')

    const query = useQuery({
        queryKey: ['map', { severity, status }],
        queryFn: async () => {
            try {
                return await listCrimeReportMapPoints({
                    severity: severity || undefined,
                    status: status || undefined
                })
            } catch (e: any) {
                const statusCode = e?.response?.status
                if (statusCode === 401 || statusCode === 403) {
                    const res = await fetch(`${API_BASE_URL}/public/map/`)
                    if (!res.ok) throw e
                    return (await res.json()) as any[]
                }
                throw e
            }
        }
    })

    const nbQuery = useQuery({
        queryKey: ['neighborhoods_map'],
        queryFn: async () => {
            const res = await listNeighborhoods()
            return res.results
        }
    })
    const navigate = useNavigate()
    const [colorByDensity, setColorByDensity] = useState<boolean>(false)
    const [densityDays, setDensityDays] = useState<number>(7)
    const countsQuery = useQuery({
        queryKey: ['neighborhood_alert_counts', { days: densityDays }],
        queryFn: async () => await neighborhoodAlertCounts({ days: densityDays }),
        enabled: colorByDensity
    })

    // Cache and fetch county GeoJSON (7 days)
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

    // Fetch sub-county GeoJSON (prefer backend endpoint, then external fallbacks)
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

    // Fetch constituencies GeoJSON (prefer backend endpoint, then external fallback)
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
        const items = (query.data || []) as any[]
        items.forEach((p) => {
            const cname = normalizeCountyName((p && p.county) || '')
            if (!cname) return
            m[cname] = (m[cname] || 0) + 1
        })
        return m
    }, [query.data])

    const maxCountyCount = useMemo(() => {
        let max = 0
        Object.values(countyCounts).forEach((v) => { if (v > max) max = v })
        return max
    }, [countyCounts])

    function countyFill(v: number, max: number): string {
        if (max <= 0 || v <= 0) return '#e5e7eb'
        const r = v / max
        if (r < 0.2) return '#dbeafe'
        if (r < 0.4) return '#a5b4fc'
        if (r < 0.6) return '#818cf8'
        if (r < 0.8) return '#6366f1'
        return '#4338ca'
    }

	const center = useMemo(() => {
		if (!query.data || query.data.length === 0) return DEFAULT_CENTER
		const lat = query.data[0].latitude
		const lng = query.data[0].longitude
		return [lat, lng] as [number, number]
	}, [query.data])

	function FitKenya({ tick }: { tick: number }) {
		const map = useMap()
		useEffect(() => {
			map.fitBounds(KENYA_BOUNDS, { padding: [20, 20] })
		}, [map, tick])
		return null
	}

	return (
		<div style={{ display: 'grid', gap: 12 }}>
			<h2>Incident Map</h2>

            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <div className="flex flex-wrap gap-3 items-center">
                    <button 
                        onClick={() => query.refetch()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                    <button 
                        onClick={() => setFitKenyaTick((t) => t + 1)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                        Zoom to Kenya
                    </button>
                    <label className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium cursor-pointer hover:bg-purple-200 transition-colors shadow-sm flex items-center gap-2 border border-purple-300">
                        <input 
                            type="checkbox" 
                            checked={showNeighborhoods} 
                            onChange={(e) => setShowNeighborhoods(e.target.checked)}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        Show Neighborhoods
                    </label>
                    <label className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium cursor-pointer hover:bg-indigo-200 transition-colors shadow-sm flex items-center gap-2 border border-indigo-300">
                        <input 
                            type="checkbox" 
                            checked={showCounties} 
                            onChange={(e) => setShowCounties(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        Show Counties
                    </label>
                    <label className="px-4 py-2 bg-teal-100 text-teal-700 rounded-lg font-medium cursor-pointer hover:bg-teal-200 transition-colors shadow-sm flex items-center gap-2 border border-teal-300">
                        <input 
                            type="checkbox" 
                            checked={showSubCounties} 
                            onChange={(e) => setShowSubCounties(e.target.checked)}
                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                        />
                        Show Sub-Counties
                    </label>
                    <label className="px-4 py-2 bg-cyan-100 text-cyan-700 rounded-lg font-medium cursor-pointer hover:bg-cyan-200 transition-colors shadow-sm flex items-center gap-2 border border-cyan-300">
                        <input 
                            type="checkbox" 
                            checked={showConstituencies} 
                            onChange={(e) => setShowConstituencies(e.target.checked)}
                            className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                        />
                        Show Constituencies
                    </label>
                    <label className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium cursor-pointer hover:bg-orange-200 transition-colors shadow-sm flex items-center gap-2 border border-orange-300">
                        <input 
                            type="checkbox" 
                            checked={colorByDensity} 
                            onChange={(e) => setColorByDensity(e.target.checked)}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                        />
                        Color Counties by Density
                    </label>
                    <select 
                        value={baseMap} 
                        onChange={(e) => setBaseMap(e.target.value as any)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium border border-gray-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-colors shadow-sm"
                    >
                        <option value="standard">Standard</option>
                        <option value="satellite">Satellite</option>
                        <option value="terrain">Terrain</option>
                    </select>
                    {colorByDensity && (
                        <select 
                            value={densityDays} 
                            onChange={(e) => setDensityDays(Number(e.target.value))}
                            className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-medium border border-amber-300 hover:bg-amber-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors shadow-sm"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                            <option value={365}>Last 365 days</option>
                        </select>
                    )}
                    <select 
                        value={severity} 
                        onChange={(e) => setSeverity(e.target.value)}
                        className="px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium border border-red-200 hover:bg-red-100 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors shadow-sm"
                    >
                        <option value="">All severities</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                    </select>
                    <select 
                        value={status} 
                        onChange={(e) => setStatus(e.target.value)}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium border border-slate-300 hover:bg-slate-200 focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors shadow-sm"
                    >
                        <option value="">All statuses</option>
                        <option value="submitted">Submitted</option>
                        <option value="triaged">Triaged</option>
                        <option value="escalated">Escalated</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
            </div>

			{query.isLoading && <p>Loading map data…</p>}
            {query.isError && (
                <div style={{ color: '#fecaca', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Failed to load map points.</span>
                    <button onClick={() => { setSeverity(''); setStatus(''); query.refetch() }}>Reset filters</button>
                    <Link to="/public/map" style={{ padding: '6px 10px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', textDecoration: 'none' }}>View Public Map</Link>
                </div>
            )}

			<div style={{ height: '85vh', width: '100%', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, overflow: 'hidden', background: 'rgba(17,24,39,0.6)' }}>
                <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
                    {showCounties && (
                        <div style={{ position: 'absolute', zIndex: 1000, left: 12, top: 12, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.7)', borderRadius: 14, padding: '10px 12px', color: '#e5e7eb', boxShadow: '0 10px 25px rgba(0,0,0,0.6)' }}>
                            <div style={{ fontSize: 12, letterSpacing: 0.2, textTransform: 'uppercase', opacity: 0.9, marginBottom: 4 }}>County color scale</div>
                            <div style={{ display: 'grid', gap: 6, marginTop: 2 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 4, background: countyFill(0, maxCountyCount), boxShadow: '0 0 0 1px rgba(148,163,184,0.8)' }}></span>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>0</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 4, background: countyFill(Math.max(1, Math.floor(maxCountyCount * 0.1)), maxCountyCount), boxShadow: '0 0 0 1px rgba(148,163,184,0.8)' }}></span>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>≤ 20% of max</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 4, background: countyFill(Math.floor(maxCountyCount * 0.3), maxCountyCount), boxShadow: '0 0 0 1px rgba(148,163,184,0.8)' }}></span>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>≤ 40% of max</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 4, background: countyFill(Math.floor(maxCountyCount * 0.5), maxCountyCount), boxShadow: '0 0 0 1px rgba(148,163,184,0.8)' }}></span>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>≤ 60% of max</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 4, background: countyFill(Math.floor(maxCountyCount * 0.7), maxCountyCount), boxShadow: '0 0 0 1px rgba(148,163,184,0.8)' }}></span>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>≤ 80% of max</span>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 4, background: countyFill(maxCountyCount, maxCountyCount), boxShadow: '0 0 0 1px rgba(148,163,184,0.8)' }}></span>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{'>'} 80% of max</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <FitKenya tick={fitKenyaTick} />
                    {baseMap === 'standard' && (
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
                    {showCounties && countyGeo && (
                        <GeoJSON
                            data={countyGeo}
                            style={(feature: any) => {
                                const raw = (feature && feature.properties && (feature.properties.COUNTY_NAM || feature.properties.name)) || ''
                                const name = normalizeCountyName(String(raw))
                                const v = countyCounts[name] || 0
                                return { color: '#7c3aed', weight: 1, fillOpacity: 0.12, fillColor: countyFill(v, maxCountyCount) }
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
                            style={() => ({ color: '#059669', weight: 1, fillOpacity: 0.03 })}
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
                            style={() => ({ color: '#0ea5e9', weight: 1, fillOpacity: 0.03 })}
                            onEachFeature={(feature: any, layer: any) => {
                                const props = (feature && feature.properties) || {}
                                const name = extractConstituencyName(props)
                                try { layer.bindTooltip(name, { sticky: true }) } catch {}
                                layer.bindPopup(name)
                                try { layer.on('click', () => { try { (layer as any)._map.fitBounds(layer.getBounds(), { padding: [20, 20] }) } catch {} }) } catch {}
                            }}
                        />
                    )}
					{showNeighborhoods && (
						<div style={{ position: 'absolute', zIndex: 1000, right: 10, top: 10, background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: 10, color: '#e5e7eb' }}>
							<strong>Legend</strong>
							<div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
								<div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
									<span style={{ width: 14, height: 14, background: '#2b6cb0', opacity: 0.2, border: '2px solid #2b6cb0', display: 'inline-block' }}></span>
									<span>Neighborhood area</span>
								</div>
							</div>
						</div>
					)}
                {query.data && query.data.length === 0 && (
                    <div style={{ position: 'absolute', zIndex: 1000, left: 10, top: 10, background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: 10, color: '#e5e7eb' }}>
                        <span style={{ marginRight: 8 }}>No points found.</span>
                        <button onClick={() => setFitKenyaTick((t) => t + 1)} style={{ marginRight: 8 }}>Fit Kenya</button>
                        <Link to="/public/map" style={{ padding: '6px 10px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', textDecoration: 'none' }}>View Public Map</Link>
                    </div>
                )}
                {!!query.data && query.data.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 1000, right: 12, bottom: 12, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.7)', borderRadius: 14, padding: '10px 12px', color: '#e5e7eb', boxShadow: '0 10px 25px rgba(0,0,0,0.6)' }}>
                        <div style={{ fontSize: 12, letterSpacing: 0.2, textTransform: 'uppercase', opacity: 0.9, marginBottom: 4 }}>Severity</div>
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
                    {showNeighborhoods && nbQuery.data?.map((n) => {
                        const poly = (n as any).polygon
                        const coords = poly?.coordinates?.[0]
                        if (!coords || !Array.isArray(coords)) return null
                        const latlngs = coords.map((c: any) => [c[1], c[0]])
                        const active = hoveredId === n.id
                        let color = active ? '#004e92' : '#2b6cb0'
                        let fillOpacity = active ? 0.2 : 0.1
                        let weight = active ? 3 : 2
                        if (colorByDensity && countsQuery.data?.results) {
                            const entry = countsQuery.data.results.find((r) => r.id === (n as any).id)
                            const c = entry?.count ?? 0
                            if (c > 20) { color = '#a30000'; fillOpacity = 0.35 }
                            else if (c > 10) { color = '#d43f3a'; fillOpacity = 0.3 }
                            else if (c > 5) { color = '#f0ad4e'; fillOpacity = 0.25 }
                            else if (c > 0) { color = '#5cb85c'; fillOpacity = 0.2 }
                        }
                        return (
                          <Polygon
                            key={`nb-${n.id}`}
                            positions={latlngs as any}
                            pathOptions={{ color, weight, fillOpacity }}
                            eventHandlers={{ click: () => navigate(`/neighborhood/${n.id}`), mouseover: () => setHoveredId(n.id), mouseout: () => setHoveredId(null) }}
                          >
                            <Tooltip sticky>{(n as any).name ?? `Neighborhood #${n.id}`}</Tooltip>
                          </Polygon>
                        )
                    })}
                    {query.data?.map((point) => {
                        const icon = createSeverityIcon(point.severity || '')
                        const scName = findSubCountyForPoint(point.latitude, point.longitude, subCountyGeo)
                        const countyName = normalizeCountyName(point.county || scName || '')
                        const coords = `${point.latitude?.toFixed ? point.latitude.toFixed(6) : point.latitude}, ${point.longitude?.toFixed ? point.longitude.toFixed(6) : point.longitude}`
                        return (
                            <Marker key={point.id} position={[point.latitude, point.longitude]} icon={icon}>
                                <Popup>
                                    <strong>{point.name_of_crime}</strong>
                                    <br />
                                    Type: {point.category_of_crime_name || '—'}
                                    <br />
                                    OB: {point.occurance_book_number}
                                    <br />
                                    Severity: {point.severity}
                                    <br />
                                    Status: {point.status}
                                    <br />
                                    County: {countyName || '—'}
                                    <br />
                                    Location: {formatLocation(point.location_name, countyName, scName, point.latitude, point.longitude)} ({coords})
                                    <br />
                                    {point.location_description && (
                                        <>
                                            Notes: {point.location_description}
                                            <br />
                                        </>
                                    )}
                                    Sub-County: {scName || '—'}
                                    <br />
                                    Updated: {formatDate(point.date_updated)}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <button
                                            style={{ padding: '6px 10px', background: '#dc2626', color: 'white', borderRadius: 6 }}
                                            onClick={() => {
                                                const loc = formatLocationForSOS(point.location_name, countyName, point.latitude, point.longitude)
                                                const message = `[${String(point.severity || '').toUpperCase()}] SOS: ${point.name_of_crime} — ${loc}`
                                                const payload = { latitude: point.latitude, longitude: point.longitude, location_name: loc, county: countyName }
                                                window.dispatchEvent(new CustomEvent('open_sos', { detail: { payload, message } }))
                                            }}
                                        >
                                            Open SOS
                                        </button>
                                        <button
                                            style={{ padding: '6px 10px', background: '#25D366', color: '#111827', borderRadius: 6 }}
                                            onClick={() => {
                                                const path = `/public/track?${point.occurance_book_number ? `ob=${encodeURIComponent(point.occurance_book_number)}` : `id=${point.id}`}`
                                                const trackUrl = `${window.location.origin}${path}`
                                                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`
                                                const loc = point.location_name || coords
                                                const text = `Alert: ${point.name_of_crime}\nCounty: ${countyName || '—'}\nSub-County: ${scName || '—'}\nLocation: ${loc}\nGPS: ${mapsUrl}\nTrack: ${trackUrl}`
                                                const url = `https://wa.me/?text=${encodeURIComponent(text)}`
                                                window.open(url, '_blank')
                                            }}
                                        >
                                            Send via WhatsApp
                                        </button>
                                        <a
                                            href={`/public/track?${point.occurance_book_number ? `ob=${encodeURIComponent(point.occurance_book_number)}` : `id=${point.id}`}`}
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
        const v = (props as any)[k]
        if (typeof v === 'string') {
            const s = v.trim()
            if (s && !/^constituency$/i.test(s) && !/^unknown$/i.test(s) && !/^none$/i.test(s) && !/^null$/i.test(s)) return s
        }
    }
    const keys = Object.keys(props)
    for (const k of keys) {
        const v = (props as any)[k]
        if (typeof v === 'string') {
            const s = v.trim()
            const kl = k.toLowerCase()
            if (s && (kl.includes('constituency') || kl.includes('name'))) return s
        }
    }
    let best = ''
    for (const k of keys) {
        const v = (props as any)[k]
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
