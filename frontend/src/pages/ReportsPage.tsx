import { hasAnyRole, ROLES } from '../lib/roles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCrimeReport, listCrimeCategories, listCrimeReports, updateCrimeReport } from '../api/crime'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { resolveMediaUrl } from '../lib/media'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { defaultMarkerIcon } from '../lib/leafletIcons'
import { useSearchParams } from 'react-router-dom'

export default function ReportsPage() {
	const queryClient = useQueryClient()

	const [search, setSearch] = useState('')
	const [ordering, setOrdering] = useState('-date_updated')
	const [ageMin, setAgeMin] = useState<number | undefined>()
	const [ageMax, setAgeMax] = useState<number | undefined>()
	const [categoryId, setCategoryId] = useState<number | undefined>()
	const [page, setPage] = useState(1)
	const [countyFilter, setCountyFilter] = useState<string>('')
	const [searchParams, setSearchParams] = useSearchParams()

	useEffect(() => {
		const county = searchParams.get('county')
		if (county) {
			setCountyFilter(county)
			setPage(1)
		} else {
			// Clear filter if no county in URL
			setCountyFilter('')
		}
	}, [searchParams])

	const reportsQuery = useQuery({
		queryKey: ['reports', { search, ordering, ageMin, ageMax, categoryId, countyFilter, page }],
		queryFn: () =>
			listCrimeReports({
				search: search || undefined,
				ordering,
				age__gte: ageMin,
				age__lte: ageMax,
				category_of_crime: categoryId,
				county: countyFilter || undefined,
				page
			})
	})

	const categoriesQuery = useQuery({
		queryKey: ['categories', { for: 'reports' }],
		queryFn: () => listCrimeCategories()
	})

	// Form state
	const [name_of_crime, setNameOfCrime] = useState('')
	const [description, setDescription] = useState('')
	const [location_name, setLocationName] = useState('')
	const [location_description, setLocationDescription] = useState('')
	const [county, setCounty] = useState('')
	const [latitude, setLatitude] = useState<number | undefined>()
	const [longitude, setLongitude] = useState<number | undefined>()
	const [name_of_criminal, setNameOfCriminal] = useState('')
	const [age, setAge] = useState<number | undefined>()
	const [criminal_id_number, setCriminalIdNumber] = useState<number | undefined>()
	const [date_of_arrest, setDateOfArrest] = useState('')
	const [category_of_crime, setCategoryOfCrime] = useState<number | undefined>()
	const [upload_criminal_photo_file, setUploadCriminalPhotoFile] = useState<File | undefined>()

	const createMut = useMutation({
		mutationFn: () => {
			return createCrimeReport({
				name_of_crime,
				description: description || undefined,
				location_name: location_name || undefined,
				location_description: location_description || undefined,
				latitude,
				longitude,
				name_of_criminal: name_of_criminal || undefined,
				age,
				criminal_id_number,
				date_of_arrest: date_of_arrest || undefined,
				category_of_crime: category_of_crime!,
				upload_criminal_photo_file,
				county: county || undefined
			})
		},
		onSuccess: () => {
			setNameOfCrime('')
			setDescription('')
			setLocationName('')
			setLocationDescription('')
			setNameOfCriminal('')
			setAge(undefined)
			setCriminalIdNumber(undefined)
			setDateOfArrest('')
			setCategoryOfCrime(undefined)
			setUploadCriminalPhotoFile(undefined)
			setLatitude(undefined)
			setLongitude(undefined)
			setCounty('')
			queryClient.invalidateQueries({ queryKey: ['reports'] })
		}
	})

	function onCreate(e: FormEvent) {
		e.preventDefault()
		if (!category_of_crime) return
		createMut.mutate()
	}

	async function reverseGeocode(lat: number, lng: number) {
		try {
			const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
			const res = await fetch(url, {
				headers: {
					'Accept': 'application/json'
				}
			})
			if (!res.ok) return
			const data = await res.json()
			const displayName: string | undefined = data?.display_name
			const addr = data?.address || {}
			// Attempt to normalize Kenyan-like administrative hierarchy:
			// sublocation ~ suburb/neighbourhood/village/ward/estate
			const sublocation: string | undefined =
				addr.suburb || addr.neighbourhood || addr.village || addr.ward || addr.hamlet || addr.quarter || addr.residential
			// location ~ city/town/municipality/locality
			const location: string | undefined =
				addr.city || addr.town || addr.municipality || addr.locality || addr.county || addr.state_district
			const countyVal: string | undefined = addr.county || addr.state

			// Build concise "Sublocation, Location, County" where present
			const parts = [sublocation, location, countyVal].filter(Boolean) as string[]
			const concise = parts.length ? parts.join(', ') : 'Selected location'
			setLocationName(concise)
			// Keep full address (or coordinates) in description for reference
			setLocationDescription(displayName ? displayName : `${lat}, ${lng}`)
			if (countyVal) setCounty(countyVal)
		} catch {
			// Fallback to raw coordinates if reverse geocode fails
			setLocationName('Selected location')
			setLocationDescription(`${lat}, ${lng}`)
		}
	}

	function useMyLocation() {
		if (!navigator.geolocation) return
		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				const lat = Number(pos.coords.latitude.toFixed(6))
				const lng = Number(pos.coords.longitude.toFixed(6))
				setLatitude(lat)
				setLongitude(lng)
				await reverseGeocode(lat, lng)
			},
			() => {},
			{ enableHighAccuracy: true, timeout: 8000 }
		)
	}

	function ClickToSetMarker() {
		useMapEvents({
			click(e) {
				const lat = Number(e.latlng.lat.toFixed(6))
				const lng = Number(e.latlng.lng.toFixed(6))
				setLatitude(lat)
				setLongitude(lng)
				// Also populate location name/description automatically
				void reverseGeocode(lat, lng)
			}
		})
		return null
	}

	const mapCenter: [number, number] = [
		latitude ?? -1.286389, // Nairobi default
		longitude ?? 36.817223
	]
	const KENYA_BOUNDS: [[number, number], [number, number]] = [[-4.7, 33.9], [5.5, 41.9]]

	function FitKenyaMini() {
		const map = useMap()
		return (
			<button
				type="button"
				onClick={() => map.fitBounds(KENYA_BOUNDS, { padding: [10, 10] })}
				style={{ position: 'absolute', zIndex: 1000, right: 10, top: 10 }}
			>
				Zoom Kenya
			</button>
		)
	}

	// Backend allows: SuperAdmin, Admin, Dispatcher (when ENFORCE_ROLE_PERMS=True)
	// Also allow FieldOfficer and Reporter in case ENFORCE_ROLE_PERMS=False
	const canCreate = hasAnyRole([ROLES.Admin, ROLES.Dispatcher, ROLES.FieldOfficer, ROLES.Reporter, ROLES.SuperAdmin])
	return (
		<div>
			<h2>Crime Reports</h2>

			<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
				<input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
				<select value={ordering} onChange={(e) => setOrdering(e.target.value)}>
					<option value="-date_updated">Newest</option>
					<option value="date_updated">Oldest</option>
					<option value="age">Age asc</option>
					<option value="-age">Age desc</option>
				</select>
				<input 
					placeholder="County filter" 
					value={countyFilter} 
					onChange={(e) => { 
						const value = e.target.value
						setCountyFilter(value)
						setPage(1)
						// Update URL to keep it in sync, preserving other params
						const newParams = new URLSearchParams(searchParams)
						if (value) {
							newParams.set('county', value)
						} else {
							newParams.delete('county')
						}
						setSearchParams(newParams)
					}} 
				/>
				<input placeholder="Min age" type="number" value={ageMin ?? ''} onChange={(e) => setAgeMin(e.target.value ? Number(e.target.value) : undefined)} />
				<input placeholder="Max age" type="number" value={ageMax ?? ''} onChange={(e) => setAgeMax(e.target.value ? Number(e.target.value) : undefined)} />
				<select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}>
					<option value="">All categories</option>
					{categoriesQuery.data?.results.map((c) => (
						<option key={c.id} value={c.id}>
							{c.crime_category} ({c.crime_short_code})
						</option>
					))}
				</select>
				<button onClick={() => { setPage(1); reportsQuery.refetch() }}>Apply</button>
			</div>

			{canCreate ? (
			<form onSubmit={onCreate} style={{ display: 'grid', gap: 8, maxWidth: 640, marginBottom: 16 }}>
				<input required placeholder="Name of crime" value={name_of_crime} onChange={(e) => setNameOfCrime(e.target.value)} />
				<textarea placeholder="Description of events" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
				<input placeholder="Location name" value={location_name} onChange={(e) => setLocationName(e.target.value)} />
				<input placeholder="Location description" value={location_description} onChange={(e) => setLocationDescription(e.target.value)} />
				<input placeholder="County" value={county} onChange={(e) => setCounty(e.target.value)} />
				<div style={{ display: 'flex', gap: 8 }}>
					<input style={{ flex: 1 }} placeholder="Latitude (-90 to 90)" type="number" step="0.000001" value={latitude ?? ''} onChange={(e) => setLatitude(e.target.value ? Number(e.target.value) : undefined)} />
					<input style={{ flex: 1 }} placeholder="Longitude (-180 to 180)" type="number" step="0.000001" value={longitude ?? ''} onChange={(e) => setLongitude(e.target.value ? Number(e.target.value) : undefined)} />
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<button type="button" onClick={useMyLocation}>Use my location</button>
					<small>or click on the map to set position</small>
				</div>
				<div style={{ height: 300, width: '100%', border: '1px solid #ccc', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
					<MapContainer center={mapCenter} zoom={7} style={{ height: '100%', width: '100%' }}>
						<FitKenyaMini />
						<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
						<ClickToSetMarker />
						{latitude !== undefined && longitude !== undefined && (
							<Marker position={[latitude, longitude]} icon={defaultMarkerIcon} />
						)}
					</MapContainer>
				</div>
				<input placeholder="Name of criminal" value={name_of_criminal} onChange={(e) => setNameOfCriminal(e.target.value)} />
				<input placeholder="Age" type="number" value={age ?? ''} onChange={(e) => setAge(e.target.value ? Number(e.target.value) : undefined)} />
				<input placeholder="Criminal ID Number" type="number" value={criminal_id_number ?? ''} onChange={(e) => setCriminalIdNumber(e.target.value ? Number(e.target.value) : undefined)} />
				<input placeholder="Date of arrest (YYYY-MM-DD)" type="date" value={date_of_arrest} onChange={(e) => setDateOfArrest(e.target.value)} />
				<input type="file" accept="image/*" onChange={(e) => setUploadCriminalPhotoFile(e.target.files?.[0])} />
				<select required value={category_of_crime ?? ''} onChange={(e) => setCategoryOfCrime(e.target.value ? Number(e.target.value) : undefined)}>
					<option value="" disabled>
						Select category
					</option>
					{categoriesQuery.data?.results.map((c) => (
						<option key={c.id} value={c.id}>
							{c.crime_category}
						</option>
					))}
				</select>
				<button type="submit" disabled={createMut.isLoading}>
					Create Report
				</button>
				{createMut.isError && (
					<p style={{ color: 'crimson' }}>
						{(createMut.error as any)?.response?.data
							? JSON.stringify((createMut.error as any).response.data)
							: 'Create failed'}
					</p>
				)}
			</form>
			) : (
				<p style={{ color: '#666', marginBottom: 16 }}>You do not have permission to create reports.</p>
			)}

			{reportsQuery.isLoading && <p>Loading...</p>}
			{reportsQuery.isError && <p className="text-red-600">Failed to load reports</p>}
			{reportsQuery.data && (
				<>
					<div style={{ overflowX: 'auto', width: '100%' }}>
						<table width="100%" cellPadding={8} style={{ borderCollapse: 'collapse', width: '100%', minWidth: '800px' }}>
							<thead>
								<tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
									<th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>Photo</th>
									<th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>OB Number</th>
									<th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>Crime</th>
									<th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>Suspect</th>
									<th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>Category</th>
									<th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>Description</th>
									<th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>Location</th>
									<th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>Age</th>
									<th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>Arrest Date</th>
									<th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>Updated</th>
									{hasAnyRole([ROLES.SuperAdmin, ROLES.Admin, ROLES.Dispatcher]) && <th align="left" style={{ padding: '12px 8px', fontWeight: '600' }}>Moderate</th>}
								</tr>
							</thead>
							<tbody>
								{reportsQuery.data.results.length === 0 ? (
									<tr>
										<td colSpan={hasAnyRole([ROLES.SuperAdmin, ROLES.Admin, ROLES.Dispatcher]) ? 11 : 10} style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
											No reports found
										</td>
									</tr>
								) : (
									reportsQuery.data.results.map((r) => (
										<tr key={r.id} style={{ borderTop: '1px solid #eee', backgroundColor: '#fff' }}>
											<td style={{ padding: '8px' }}>
												{r.upload_criminal_photo ? (
													<img
														src={resolveMediaUrl(r.upload_criminal_photo) as string}
														alt="criminal"
														style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
													/>
												) : (
													<span style={{ color: '#888' }}>—</span>
												)}
											</td>
											<td style={{ padding: '8px' }}>{r.occurance_book_number}</td>
											<td style={{ padding: '8px' }}>{r.name_of_crime}</td>
											<td style={{ padding: '8px' }}>{r.name_of_criminal ?? '-'}</td>
											<td style={{ padding: '8px' }}>{r.category_of_crime_name}</td>
											<td style={{ padding: '8px', maxWidth: '200px' }}>{r.description ? r.description.slice(0, 80) + (r.description.length > 80 ? '…' : '') : '-'}</td>
											<td style={{ padding: '8px' }}>{r.location_name ?? (r.county ?? '-')}</td>
											<td style={{ padding: '8px' }}>{r.age ?? '-'}</td>
											<td style={{ padding: '8px' }}>{r.date_of_arrest ?? '-'}</td>
											<td style={{ padding: '8px' }}>{new Date(r.date_updated).toLocaleString()}</td>
											{hasAnyRole([ROLES.SuperAdmin, ROLES.Admin, ROLES.Dispatcher]) && (
												<td style={{ padding: '8px' }}>
													<RowModeration id={r.id} currentStatus={(r as any).status} currentSeverity={(r as any).severity} onSaved={() => reportsQuery.refetch()} />
												</td>
											)}
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
						<button disabled={!reportsQuery.data.previous || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
							Prev
						</button>
						<span>Page {page}</span>
						<button disabled={!reportsQuery.data.next} onClick={() => setPage((p) => p + 1)}>
							Next
						</button>
						{typeof reportsQuery.data.count === 'number' && <span style={{ color: '#666' }}>Total: {reportsQuery.data.count}</span>}
					</div>
				</>
			)}
		</div>
	)
}

const STATUS_OPTIONS = ['submitted', 'triaged', 'escalated', 'in_progress', 'resolved', 'closed']
const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical']

function RowModeration({ id, currentStatus, currentSeverity, onSaved }: { id: number; currentStatus?: string; currentSeverity?: string; onSaved: () => void }) {
	const [status, setStatus] = useState(currentStatus || 'submitted')
	const [severity, setSeverity] = useState(currentSeverity || 'medium')
	const [saving, setSaving] = useState(false)
	const [err, setErr] = useState<string | null>(null)

	async function save() {
		setSaving(true)
		setErr(null)
		try {
			await updateCrimeReport(id, { status, severity, change_note: 'moderated via UI' })
			onSaved()
		} catch (e: any) {
			setErr(e?.response?.data?.detail || 'Save failed')
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="row">
			<select value={status} onChange={(e) => setStatus(e.target.value)}>
				{STATUS_OPTIONS.map((s) => (
					<option key={s} value={s}>{s}</option>
				))}
			</select>
			<select value={severity} onChange={(e) => setSeverity(e.target.value)}>
				{SEVERITY_OPTIONS.map((s) => (
					<option key={s} value={s}>{s}</option>
				))}
			</select>
			<button onClick={save} disabled={saving}>Save</button>
			{err && <small style={{ color: 'crimson' }}>{err}</small>}
		</div>
	)
}

