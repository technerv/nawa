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
    category_of_crime_name?: string | null
    severity: string
    status: string
    latitude: number
    longitude: number
    location_name?: string | null
    location_description?: string | null
    county?: string | null
    date_updated: string
}

export interface CrimeWitness {
  id: number
  name: string
  contact_information?: string | null
  statement: string
  crime_report: number
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

export async function getCrimeReport(id: number) {
	const res = await api.get<CrimeReport>(`/crimereportbook/${id}/`)
	return res.data
}

export async function updateCrimeReport(id: number, payload: (Partial<CrimeReport> & { change_note?: string }) | ({ status?: string; severity?: string; change_note?: string })) {
	const res = await api.patch<CrimeReport>(`/crimereportbook/${id}/`, payload)
	return res.data
}

export async function createCrimeReport(payload: Partial<Omit<CrimeReport, 'id' | 'occurance_book_number' | 'date_created' | 'date_updated' | 'category_of_crime_name'>> & { upload_criminal_photo_file?: File; evidence_video_file?: File; evidence_audio_file?: File }) {
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
	if (payload.evidence_video_file instanceof File) form.append('evidence_video', payload.evidence_video_file)
	if (payload.evidence_audio_file instanceof File) form.append('evidence_audio', payload.evidence_audio_file)
	const res = await api.post<CrimeReport>('/crimereportbook/', form, {
		headers: { 'Content-Type': 'multipart/form-data' }
	})
	return res.data
}

export async function createPublicCrimeReport(payload: {
  name_of_crime: string
  category_of_crime: number
  description?: string
  location_name?: string
  location_description?: string
  county?: string
  latitude?: number
  longitude?: number
  evidence_video_file?: File
  evidence_audio_file?: File
  session_id?: string
  honeypot?: string
  captcha_a?: number
  captcha_b?: number
  captcha_answer?: number
}) {
  const { API_BASE_URL } = await import('./axios')
  if (payload.evidence_video_file instanceof File || payload.evidence_audio_file instanceof File) {
    const form = new FormData()
    form.append('name_of_crime', String(payload.name_of_crime))
    form.append('category_of_crime', String(payload.category_of_crime))
    if (payload.description) form.append('description', String(payload.description))
    if (payload.location_name) form.append('location_name', String(payload.location_name))
    if (payload.location_description) form.append('location_description', String(payload.location_description))
    if (payload.county) form.append('county', String(payload.county))
    if (payload.latitude != null) form.append('latitude', String(payload.latitude))
    if (payload.longitude != null) form.append('longitude', String(payload.longitude))
    if (payload.session_id) form.append('session_id', String(payload.session_id))
    // Backend currently only supports evidence_video field
    // Priority: video > audio (if both are present, send video)
    if (payload.evidence_video_file instanceof File) {
    form.append('evidence_video', payload.evidence_video_file)
    } else if (payload.evidence_audio_file instanceof File) {
      // Send audio as evidence_video since backend doesn't have separate audio field
      form.append('evidence_video', payload.evidence_audio_file)
    }
    // Include honeypot and captcha fields (required by backend)
    form.append('honeypot', String((payload as any).honeypot || ''))
    if ((payload as any).captcha_a != null) form.append('captcha_a', String((payload as any).captcha_a))
    if ((payload as any).captcha_b != null) form.append('captcha_b', String((payload as any).captcha_b))
    if ((payload as any).captcha_answer != null) form.append('captcha_answer', String((payload as any).captcha_answer))
    
    const headers: HeadersInit = {}
    if (payload.session_id) {
      headers['X-Session-ID'] = payload.session_id
    }
    
    const res = await fetch(`${API_BASE_URL}/public/reports/`, {
      method: 'POST',
      headers,
      body: form
    })
    if (!res.ok) {
      const text = await res.text()
      let msg = text || 'Public report failed'
      try {
        const json = JSON.parse(text)
        const d = (json && json.detail) || json
        msg = typeof d === 'string' ? d : JSON.stringify(d)
      } catch {}
      throw new Error(msg)
    }
    return await res.json()
  } else {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (payload.session_id) {
      headers['X-Session-ID'] = payload.session_id
    }
    
    const res = await fetch(`${API_BASE_URL}/public/reports/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const text = await res.text()
      let msg = text || 'Public report failed'
      try {
        const json = JSON.parse(text)
        const d = (json && json.detail) || json
        msg = typeof d === 'string' ? d : JSON.stringify(d)
      } catch {}
      throw new Error(msg)
    }
    return await res.json()
  }
}

export async function createAnonymousWitnessMessage(payload: {
  case_id?: string | number
  occurance_book_number?: string
  ob_number?: string
  tracking_code?: string
  name?: string
  contact_information?: string
  statement: string
}) {
  const res = await api.post<CrimeWitness>('/crimewitness/', payload)
  return res.data
}

export async function getPublicCase(idOrOb: string | number) {
  const params: any = {}
  if (typeof idOrOb === 'number' || (/^\d+$/.test(String(idOrOb)))) params.id = Number(idOrOb)
  else params.ob = String(idOrOb)
  const res = await api.get('/public/reports/', { params })
  return res.data as {
    id: number
    name_of_crime: string
    description?: string | null
    location_name?: string | null
    county?: string | null
    date_updated: string
    category_of_crime_name?: string | null
    occurance_book_number: string
    risk_score: number
  }
}

export async function listWitnessMessages(crime_report_id: number) {
  const res = await api.get<CrimeWitness[]>('/crimewitness/', { params: { crime_report: crime_report_id, ordering: '-date_created' } })
  // DRF default for list is paginated only if configured; router defaults to unpaginated here
  return Array.isArray(res.data) ? res.data : (res.data as any).results || []
}
