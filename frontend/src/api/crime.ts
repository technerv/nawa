import { api } from './axios'

// Types matching DRF serializers
export interface CrimeCategory {
	id: number
	crime_category: string
	crime_short_code: string
}

export interface CrimeReport {
	id: number
	occurance_book_number: string
	date_of_arrest?: string | null
	name_of_crime: string
	description?: string | null
	location_name?: string | null
	location_description?: string | null
	latitude?: number | null
	longitude?: number | null
	county?: string | null
	name_of_criminal?: string | null
	age?: number | null
	criminal_id_number?: number | null
	upload_criminal_photo?: string | null
	date_created: string
	date_updated: string
	category_of_crime: number
	category_of_crime_name: string
}

export interface Paginated<T> {
	count: number
	next: string | null
	previous: string | null
	results: T[]
}

export interface CrimeReportMapPoint {
	id: number
	occurance_book_number: string
	name_of_crime: string
	severity: string
	status: string
	latitude: number
	longitude: number
	location_name?: string | null
	location_description?: string | null
	date_updated: string
}

export async function listCrimeCategories(params?: { search?: string; page?: number }) {
	const res = await api.get<Paginated<CrimeCategory>>('/crimecategory/', { params })
	return res.data
}

export async function createCrimeCategory(payload: Pick<CrimeCategory, 'crime_category' | 'crime_short_code'>) {
	const res = await api.post<CrimeCategory>('/crimecategory/', payload)
	return res.data
}

export async function listCrimeReports(params?: {
	search?: string
	page?: number
	ordering?: string
	age__gte?: number
	age__lte?: number
	category_of_crime?: number
	county?: string
}) {
	// Build params with county filter using icontains for flexible matching
	const apiParams: any = { ...params }
	if (apiParams.county) {
		// Use icontains for better matching (handles "Kajiado County", "Kajiado", etc.)
		apiParams['county__icontains'] = apiParams.county
		delete apiParams.county
	}
	const res = await api.get<Paginated<CrimeReport>>('/crimereportbook/', { params: apiParams })
	return res.data
}

export async function listCrimeReportMapPoints(params?: {
	status?: string
	severity?: string
	category_of_crime?: number
}) {
	const res = await api.get<CrimeReportMapPoint[]>('/crimereportbook/map/', { params })
	return res.data
}

export async function updateCrimeReport(id: number, payload: Partial<CrimeReport> & { change_note?: string }) {
	const res = await api.patch<CrimeReport>(`/crimereportbook/${id}/`, payload)
	return res.data
}

export async function createCrimeReport(payload: Partial<Omit<CrimeReport, 'id' | 'occurance_book_number' | 'date_created' | 'date_updated' | 'category_of_crime_name'>> & { upload_criminal_photo_file?: File }) {
	// Build multipart form data for image upload support
	const form = new FormData()
	if (payload.name_of_crime !== undefined) form.append('name_of_crime', String(payload.name_of_crime))
	if ((payload as any).description !== undefined && (payload as any).description !== null) form.append('description', String((payload as any).description))
	if ((payload as any).location_name !== undefined && (payload as any).location_name !== null) form.append('location_name', String((payload as any).location_name))
	if ((payload as any).location_description !== undefined && (payload as any).location_description !== null) form.append('location_description', String((payload as any).location_description))
	if ((payload as any).latitude !== undefined && (payload as any).latitude !== null) form.append('latitude', String((payload as any).latitude))
	if ((payload as any).longitude !== undefined && (payload as any).longitude !== null) form.append('longitude', String((payload as any).longitude))
	if ((payload as any).county !== undefined && (payload as any).county !== null) form.append('county', String((payload as any).county))
	if (payload.name_of_criminal !== undefined && payload.name_of_criminal !== null) form.append('name_of_criminal', String(payload.name_of_criminal))
	if (payload.age !== undefined && payload.age !== null) form.append('age', String(payload.age))
	if (payload.criminal_id_number !== undefined && payload.criminal_id_number !== null) form.append('criminal_id_number', String(payload.criminal_id_number))
	if (payload.date_of_arrest) form.append('date_of_arrest', String(payload.date_of_arrest))
	if (payload.category_of_crime !== undefined && payload.category_of_crime !== null) form.append('category_of_crime', String(payload.category_of_crime))
	if ((payload as any).upload_criminal_photo_file instanceof File) form.append('upload_criminal_photo', (payload as any).upload_criminal_photo_file as File)
	const res = await api.post<CrimeReport>('/crimereportbook/', form, {
		headers: { 'Content-Type': 'multipart/form-data' }
	})
	return res.data
}

