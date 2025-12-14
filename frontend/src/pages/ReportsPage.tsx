import { hasAnyRole, ROLES } from '../lib/roles'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listCrimeCategories, listCrimeReports, updateCrimeReport } from '../api/crime'
import { API_BASE_URL } from '../api/axios'
import { normalizeCountyName } from '../lib/normalizeCounty'
import { subscribeAlerts, listSubscriptions, unsubscribeAlert } from '../api/alerts'
import { showToast } from '../lib/toast'
import { useEffect, useState } from 'react'
import { resolveMediaUrl } from '../lib/media'
import { formatDate } from '../lib/dateFormat'
import { formatLocation } from '../lib/locationFormat'
import { useSearchParams, Link } from 'react-router-dom'

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
	const [usedPublic, setUsedPublic] = useState(false)
	const [lastErrorStatus, setLastErrorStatus] = useState<number | null>(null)
    useEffect(() => {
        if (!usedPublic) return
        const timer = setInterval(() => {
            reportsQuery.refetch()
        }, 120000)
        return () => clearInterval(timer)
    }, [usedPublic])

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
		queryFn: async () => {
			try {
				const data = await listCrimeReports({
					search: search || undefined,
					ordering,
					age__gte: ageMin,
					age__lte: ageMax,
					category_of_crime: categoryId,
					county: countyFilter || undefined,
					page
				})
				setUsedPublic(false)
				return data
			} catch (e: any) {
				const params = new URLSearchParams()
				if (search) params.set('search', search)
				if (ordering) params.set('ordering', ordering)
				if (countyFilter) params.set('county', countyFilter)
				if (page) params.set('page', String(page))
				const res = await fetch(`${API_BASE_URL}/public/reports/?` + params.toString())
				if (!res.ok) throw e
                const data = await res.json()
                setLastErrorStatus(e?.response?.status ?? null)
                setUsedPublic(true)
                return {
                    count: data.count ?? data.results?.length ?? 0,
                    next: data.next ?? null,
                    previous: data.previous ?? null,
                    results: (data.results || []).map((r: any) => ({
                        id: r.id,
                        occurance_book_number: r.occurance_book_number ?? '—',
                        name_of_crime: r.name_of_crime,
                        description: r.description,
                        location_name: r.location_name,
                        county: normalizeCountyName(r.county),
                        age: undefined,
                        date_of_arrest: undefined,
                        upload_criminal_photo: null,
                        date_created: r.date_updated,
                        date_updated: r.date_updated,
                        category_of_crime: 0,
                        category_of_crime_name: r.category_of_crime_name
                    }))
                }
			}
		}
	})

	const categoriesQuery = useQuery({
		queryKey: ['categories', { for: 'reports' }],
		queryFn: () => listCrimeCategories()
	})
    const subscriptionsQuery = useQuery({
        queryKey: ['subscriptions'],
        queryFn: () => listSubscriptions()
    })

	return (
		<div className="space-y-6">
			<div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6 mb-6">
				<div className="flex justify-between items-center">
					<div>
						<h2 className="text-3xl font-bold mb-2">Crime Reports</h2>
						<p className="text-gray-100 text-sm">View and manage crime reports. Use filters to find specific incidents.</p>
					</div>
					<span className="text-sm px-4 py-2 rounded-full border border-white border-opacity-30 bg-white bg-opacity-10">
						{usedPublic ? 'Public Data' : 'Private Data'}
					</span>
				</div>
			</div>

		<div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-3">
			<div className="flex flex-wrap gap-3 items-center">
				<div className="flex-1 min-w-[200px]">
					<input 
						placeholder="Search..." 
						value={search} 
						onChange={(e) => setSearch(e.target.value)}
						className="w-full px-4 py-2 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-blue-400"
					/>
				</div>
				<select 
					value={ordering} 
					onChange={(e) => setOrdering(e.target.value)}
					className="px-4 py-2 bg-purple-100 text-purple-700 border border-purple-300 rounded-lg font-medium hover:bg-purple-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors shadow-sm"
				>
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
					className="px-4 py-2 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-indigo-400"
				/>
				<input 
					placeholder="Min age" 
					type="number" 
					value={ageMin ?? ''} 
					onChange={(e) => setAgeMin(e.target.value ? Number(e.target.value) : undefined)}
					className="px-4 py-2 bg-green-50 text-green-900 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-green-400 w-24"
				/>
				<input 
					placeholder="Max age" 
					type="number" 
					value={ageMax ?? ''} 
					onChange={(e) => setAgeMax(e.target.value ? Number(e.target.value) : undefined)}
					className="px-4 py-2 bg-teal-50 text-teal-900 border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-teal-400 w-24"
				/>
				<select 
					value={categoryId ?? ''} 
					onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
					className="px-4 py-2 bg-orange-100 text-orange-700 border border-orange-300 rounded-lg font-medium hover:bg-orange-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors shadow-sm min-w-[180px]"
				>
					<option value="">All categories</option>
					{categoriesQuery.data?.results.map((c) => (
						<option key={c.id} value={c.id}>
							{c.crime_category} ({c.crime_short_code})
						</option>
					))}
				</select>
				<button 
					onClick={() => { setPage(1); reportsQuery.refetch() }}
					className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-secondary transition-colors shadow-sm flex items-center gap-2"
				>
					<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					Apply
				</button>
			{countyFilter && (
				<>
					{(subscriptionsQuery.data?.results || []).some((s) => (s.county || '')?.toLowerCase() === countyFilter.toLowerCase()) ? (
						<button 
							onClick={async () => { const sub = (subscriptionsQuery.data!.results.find((s) => (s.county || '')?.toLowerCase() === countyFilter.toLowerCase())!); await unsubscribeAlert(sub.id); showToast('Unsubscribed from county', 'success'); subscriptionsQuery.refetch() }}
							className="px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded-lg font-medium hover:bg-red-200 transition-colors shadow-sm"
						>
							Unfollow county
						</button>
					) : (
						<button 
							onClick={async () => { await subscribeAlerts({ county: countyFilter, channel: 'sms' }); showToast('Subscribed to county alerts', 'success'); subscriptionsQuery.refetch() }}
							className="px-4 py-2 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg font-medium hover:bg-emerald-200 transition-colors shadow-sm"
						>
							Follow county
						</button>
					)}
				</>
			)}
			{countyFilter && (
				<>
					{(subscriptionsQuery.data?.results || []).some((s) => (s.county || '')?.toLowerCase() === countyFilter.toLowerCase()) ? (
						<button 
							onClick={async () => { const sub = (subscriptionsQuery.data!.results.find((s) => (s.county || '')?.toLowerCase() === countyFilter.toLowerCase())!); await unsubscribeAlert(sub.id); showToast('Unsubscribed from county', 'success'); subscriptionsQuery.refetch() }}
							className="px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded-lg font-medium hover:bg-red-200 transition-colors shadow-sm"
						>
							Unfollow county
						</button>
					) : (
						<button 
							onClick={async () => { await subscribeAlerts({ county: countyFilter, channel: 'sms' }); showToast('Subscribed to county alerts', 'success'); subscriptionsQuery.refetch() }}
							className="px-4 py-2 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg font-medium hover:bg-emerald-200 transition-colors shadow-sm"
						>
							Follow county
						</button>
					)}
				</>
			)}
		</div>
		<small style={{ color: '#cbd5e1', display: 'block', marginTop: -8, marginBottom: 0 }}>County accepts aliases like "Kajiado" or full "Kajiado County".</small></div>

			{reportsQuery.isLoading && <p>Loading...</p>}
			{reportsQuery.isError && (
			<div style={{ color: '#fecaca', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
					<span>Failed to load reports.</span>
					<button onClick={() => { setSearch(''); setOrdering('-date_updated'); setAgeMin(undefined); setAgeMax(undefined); setCategoryId(undefined); setCountyFilter(''); setPage(1); reportsQuery.refetch() }}>Reset filters</button>
					<Link to="/public/dashboard" style={{ padding: '6px 10px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', textDecoration: 'none' }}>View Public Dashboard</Link>
				</div>
			)}
			{reportsQuery.data && (
				<>
					{usedPublic && (
					<div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', color: '#fde68a', padding: 10, borderRadius: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
							<span>
								Showing public data due to private API error{lastErrorStatus === 401 ? ' (unauthorized)' : ''}.
							</span>
							<div style={{ display: 'flex', gap: 8 }}>
								<button onClick={() => reportsQuery.refetch()}>Retry private</button>
								{lastErrorStatus === 401 && (
									<Link to="/login" style={{ padding: '6px 10px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', textDecoration: 'none' }}>Login</Link>
								)}
							</div>
						</div>
					)}
					<div className="bg-white shadow-md rounded-lg overflow-hidden" style={{ overflowX: 'auto', width: '100%' }}>
						<div className="p-4 bg-gray-50 border-b">
							<h3 className="text-lg font-bold text-gray-800">Crime Reports</h3>
							<p className="text-sm text-gray-600 mt-1">Total: {reportsQuery.data.count || 0} reports</p>
						</div>
						<table className="table-bordered" style={{ minWidth: '800px' }}>
							<thead>
								<tr>
									<th>Photo</th>
									<th>OB Number</th>
									<th>Crime</th>
									<th>Suspect</th>
									<th>Category</th>
									<th>Description</th>
									<th>Location</th>
									<th>Age</th>
									<th>Arrest Date</th>
									<th>Updated</th>
									{hasAnyRole([ROLES.SuperAdmin, ROLES.Admin, ROLES.Dispatcher]) && <th>Moderate</th>}
								</tr>
							</thead>
							<tbody>
								{reportsQuery.data.results.length === 0 ? (
									<tr>
										<td colSpan={hasAnyRole([ROLES.SuperAdmin, ROLES.Admin, ROLES.Dispatcher]) ? 11 : 10} className="text-center py-10 text-gray-500">
											No reports found
										</td>
									</tr>
								) : (
						reportsQuery.data.results.map((r: any) => (
										<tr key={r.id} className="transition-colors hover:bg-blue-50">
											<td>
												{r.upload_criminal_photo ? (
													<img
														src={resolveMediaUrl(r.upload_criminal_photo) as string}
														alt="criminal"
														className="w-12 h-12 object-cover rounded"
													/>
												) : (
													<span className="text-gray-400">—</span>
												)}
											</td>
											<td className="font-mono text-sm">{r.occurance_book_number}</td>
											<td className="font-medium">{r.name_of_crime}</td>
											<td>{r.name_of_criminal ?? '-'}</td>
											<td className="text-sm">{r.category_of_crime_name}</td>
											<td className="text-sm max-w-xs truncate" title={r.description}>{r.description ? r.description.slice(0, 80) + (r.description.length > 80 ? '…' : '') : '-'}</td>
											<td className="text-sm">{formatLocation(r.location_name, r.county, undefined, r.latitude, r.longitude)}</td>
											<td>{r.age ?? '-'}</td>
											<td className="text-sm">{r.date_of_arrest ?? '-'}</td>
											<td className="text-sm text-gray-600">{formatDate(r.date_updated)}</td>
											{hasAnyRole([ROLES.SuperAdmin, ROLES.Admin, ROLES.Dispatcher]) && (
												<td>
						<RowModeration id={r.id} currentStatus={(r as any).status} currentSeverity={(r as any).severity} onSaved={() => { queryClient.invalidateQueries({ queryKey: ['neighborhood_alert_counts'] }); reportsQuery.refetch() }} />
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
						{typeof reportsQuery.data.count === 'number' && <span style={{ color: '#cbd5e1' }}>Total: {reportsQuery.data.count}</span>}
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
			showToast('Report updated', 'success')
		} catch (e: any) {
			setErr(e?.response?.data?.detail || 'Save failed')
		} finally {
			setSaving(false)
		}
	}

	const getSeverityColor = (sev: string) => {
		const s = sev.toLowerCase()
		if (s === 'low') return 'text-emerald-700 bg-emerald-50 border-emerald-300'
		if (s === 'medium') return 'text-amber-700 bg-amber-50 border-amber-300'
		if (s === 'high') return 'text-red-700 bg-red-50 border-red-300'
		if (s === 'critical') return 'text-violet-700 bg-violet-50 border-violet-300'
		return 'text-gray-700 bg-gray-50 border-gray-300'
	}

	return (
		<div className="flex flex-col gap-2 min-w-[200px]">
			<div className="flex gap-2">
				<div className="flex-1">
					<label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
					<select 
						value={status} 
						onChange={(e) => setStatus(e.target.value)}
						className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
					>
				{STATUS_OPTIONS.map((s) => (
							<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
				))}
			</select>
				</div>
				<div className="flex-1">
					<label className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
					<select 
						value={severity} 
						onChange={(e) => setSeverity(e.target.value)}
						className={`w-full px-2 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-white ${getSeverityColor(severity)}`}
					>
				{SEVERITY_OPTIONS.map((s) => (
							<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
				))}
			</select>
				</div>
			</div>
			<button 
				onClick={save} 
				disabled={saving}
				className="px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
			>
				{saving ? 'Saving...' : 'Save'}
			</button>
			{err && <small className="text-red-600 text-xs">{err}</small>}
		</div>
	)
}
