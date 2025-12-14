import { hasAnyRole, ROLES } from '../lib/roles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCrimeReport, listCrimeCategories } from '../api/crime'
import { showToast } from '../lib/toast'
import { FormEvent, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { defaultMarkerIcon } from '../lib/leafletIcons'

export default function CreateCrimeReportPage() {
	const queryClient = useQueryClient()

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

	const categoriesQuery = useQuery({
		queryKey: ['categories', { for: 'reports' }],
		queryFn: () => listCrimeCategories()
	})

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
			queryClient.invalidateQueries({ queryKey: ['neighborhood_alert_counts'] })
			showToast('Report created', 'success')
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
		<div className="space-y-6">
			<div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6 mb-6">
				<h2 className="text-3xl font-bold mb-2">Create Crime Report</h2>
				<p className="text-gray-100 text-sm">Submit a new crime report with detailed information</p>
			</div>

			{canCreate ? (
				<div className="bg-white shadow-md rounded-lg p-6 mb-6 border border-gray-200">
					<h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Report Details</h3>
					<form onSubmit={onCreate} className="grid gap-4 max-w-3xl">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Crime Name <span className="text-red-500">*</span></label>
							<input 
								required 
								name="name_of_crime" 
								placeholder="Name of crime" 
								value={name_of_crime} 
								onChange={(e) => setNameOfCrime(e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
							<textarea 
								name="description" 
								placeholder="Description of events" 
								value={description} 
								onChange={(e) => setDescription(e.target.value)} 
								rows={4}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
							/>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
								<input 
									name="location_name" 
									placeholder="Location name" 
									value={location_name} 
									onChange={(e) => setLocationName(e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">County</label>
								<input 
									name="county" 
									placeholder="County" 
									value={county} 
									onChange={(e) => setCounty(e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
								/>
							</div>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Location Description</label>
							<input 
								name="location_description" 
								placeholder="Location description" 
								value={location_description} 
								onChange={(e) => setLocationDescription(e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
								<input 
									name="latitude" 
									placeholder="Latitude (-90 to 90)" 
									type="number" 
									step="0.000001" 
									value={latitude ?? ''} 
									onChange={(e) => setLatitude(e.target.value ? Number(e.target.value) : undefined)}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
								<input 
									name="longitude" 
									placeholder="Longitude (-180 to 180)" 
									type="number" 
									step="0.000001" 
									value={longitude ?? ''} 
									onChange={(e) => setLongitude(e.target.value ? Number(e.target.value) : undefined)}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
								/>
							</div>
						</div>
						<div className="flex items-center gap-4">
							<button 
								type="button" 
								onClick={useMyLocation}
								className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium"
							>
								Use my location
							</button>
							<small className="text-gray-500">or click on the map to set position</small>
						</div>
						<div className="border border-gray-300 rounded-lg overflow-hidden" style={{ height: 300 }}>
							<MapContainer center={mapCenter} zoom={7} style={{ height: '100%', width: '100%' }}>
								<FitKenyaMini />
								<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
								<ClickToSetMarker />
								{latitude !== undefined && longitude !== undefined && (
									<Marker position={[latitude, longitude]} icon={defaultMarkerIcon} />
								)}
							</MapContainer>
						</div>
						<div className="border-t pt-4 mt-2">
							<h4 className="text-lg font-semibold mb-3 text-gray-800">Suspect Information</h4>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Name of Criminal</label>
									<input 
										name="name_of_criminal" 
										placeholder="Name of criminal" 
										value={name_of_criminal} 
										onChange={(e) => setNameOfCriminal(e.target.value)}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
									<input 
										name="age" 
										placeholder="Age" 
										type="number" 
										value={age ?? ''} 
										onChange={(e) => setAge(e.target.value ? Number(e.target.value) : undefined)}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Criminal ID Number</label>
									<input 
										name="criminal_id_number" 
										placeholder="Criminal ID Number" 
										type="number" 
										value={criminal_id_number ?? ''} 
										onChange={(e) => setCriminalIdNumber(e.target.value ? Number(e.target.value) : undefined)}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">Date of Arrest</label>
									<input 
										name="date_of_arrest" 
										placeholder="Date of arrest" 
										type="date" 
										value={date_of_arrest} 
										onChange={(e) => setDateOfArrest(e.target.value)}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
									/>
								</div>
							</div>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Criminal Photo</label>
							<input 
								name="upload_criminal_photo" 
								type="file" 
								accept="image/*" 
								onChange={(e) => setUploadCriminalPhotoFile(e.target.files?.[0])}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-secondary"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Crime Category <span className="text-red-500">*</span></label>
							<select 
								required 
								name="category_of_crime" 
								value={category_of_crime ?? ''} 
								onChange={(e) => setCategoryOfCrime(e.target.value ? Number(e.target.value) : undefined)}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
							>
								<option value="" disabled>
									Select category
								</option>
								{categoriesQuery.data?.results.map((c) => (
									<option key={c.id} value={c.id}>
										{c.crime_category}
									</option>
								))}
							</select>
						</div>
						<div className="flex gap-3 pt-2">
							<button 
								type="submit" 
								disabled={createMut.isPending}
								className="px-6 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
							>
								{createMut.isPending ? 'Creating...' : 'Create Report'}
							</button>
							{createMut.isError && (
								<p className="text-red-600 text-sm flex items-center">
									{(createMut.error as any)?.response?.data
										? JSON.stringify((createMut.error as any).response.data)
										: 'Create failed'}
								</p>
							)}
						</div>
					</form>
				</div>
			) : (
				<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
					<p className="text-yellow-800">You do not have permission to create reports.</p>
				</div>
			)}
		</div>
	)
}

