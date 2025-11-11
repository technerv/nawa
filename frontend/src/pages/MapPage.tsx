import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { listCrimeReportMapPoints } from '../api/crime'
import { defaultMarkerIcon } from '../lib/leafletIcons'

const DEFAULT_CENTER: [number, number] = [-1.286389, 36.817223] // Nairobi CBD
const KENYA_BOUNDS: [[number, number], [number, number]] = [[-4.7, 33.9], [5.5, 41.9]]

export default function MapPage() {
	const [severity, setSeverity] = useState<string>('')
	const [status, setStatus] = useState<string>('')
	const [fitKenyaTick, setFitKenyaTick] = useState<number>(0)

	const query = useQuery({
		queryKey: ['map', { severity, status }],
		queryFn: () =>
			listCrimeReportMapPoints({
				severity: severity || undefined,
				status: status || undefined
			})
	})

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

			<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
				<select value={severity} onChange={(e) => setSeverity(e.target.value)}>
					<option value="">All severities</option>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
					<option value="critical">Critical</option>
				</select>
				<select value={status} onChange={(e) => setStatus(e.target.value)}>
					<option value="">All statuses</option>
					<option value="submitted">Submitted</option>
					<option value="triaged">Triaged</option>
					<option value="escalated">Escalated</option>
					<option value="in_progress">In Progress</option>
					<option value="resolved">Resolved</option>
					<option value="closed">Closed</option>
				</select>
				<button onClick={() => query.refetch()}>Refresh</button>
				<button onClick={() => setFitKenyaTick((t) => t + 1)}>Zoom to Kenya</button>
			</div>

			{query.isLoading && <p>Loading map data…</p>}
			{query.isError && <p style={{ color: 'crimson' }}>Failed to load map points.</p>}

			<div style={{ height: '70vh', width: '100%', border: '1px solid #ccc', borderRadius: 8, overflow: 'hidden' }}>
				<MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
					<FitKenya tick={fitKenyaTick} />
					<TileLayer
						attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					/>
					{query.data?.map((point) => (
						<Marker key={point.id} position={[point.latitude, point.longitude]} icon={defaultMarkerIcon}>
							<Popup>
								<strong>{point.name_of_crime}</strong>
								<br />
								OB: {point.occurance_book_number}
								<br />
								Severity: {point.severity}
								<br />
								Status: {point.status}
								<br />
								{point.location_name && (
									<>
										Location: {point.location_name}
										<br />
									</>
								)}
								{point.location_description && (
									<>
										Notes: {point.location_description}
										<br />
									</>
								)}
								Updated: {new Date(point.date_updated).toLocaleString()}
							</Popup>
						</Marker>
					))}
				</MapContainer>
			</div>
		</div>
	)
}

