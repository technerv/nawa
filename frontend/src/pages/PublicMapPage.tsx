import { useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { api } from '../api/axios'
import { defaultMarkerIcon } from '../lib/leafletIcons'

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
	const query = useQuery({
		queryKey: ['public_map'],
		queryFn: async () => {
			const res = await api.get<PublicMapPoint[]>('/public/map/')
			return res.data
		}
	})

	const center: [number, number] = [-1.286389, 36.817223]

	return (
		<div>
			<h2>Public Map</h2>
			<div style={{ height: '70vh', width: '100%', border: '1px solid #ccc', borderRadius: 8, overflow: 'hidden' }}>
				<MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
					<TileLayer
						attribution='&copy; OpenStreetMap contributors'
						url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					/>
					{query.data?.map((p) => (
						<Marker key={p.id} position={[p.latitude, p.longitude]} icon={defaultMarkerIcon}>
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
					))}
				</MapContainer>
			</div>
		</div>
	)
}

