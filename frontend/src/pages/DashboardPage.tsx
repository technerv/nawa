import { useQuery } from '@tanstack/react-query'
import { api, API_BASE_URL } from '../api/axios'
import { normalizeCountyName } from '../lib/normalizeCounty'
import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WebSocketViewer from '../components/WebSocketViewer'

type SummaryResponse = {
    date_from?: string | null
    date_to?: string | null
    national: { low: number; medium: number; high: number; critical: number; total: number }
    by_county: { county: string; low: number; medium: number; high: number; critical: number; total: number }[]
    timeseries?: { date: string; total: number; low: number; medium: number; high: number; critical: number }[]
}

export default function DashboardPage() {
	const [dateFrom, setDateFrom] = useState('')
	const [dateTo, setDateTo] = useState('')
	const [county, setCounty] = useState('')
	const navigate = useNavigate()
	const { data, isLoading, isError, refetch, error } = useQuery({
		queryKey: ['summary', { dateFrom, dateTo, county }],
		queryFn: async () => {
			try {
				const res = await api.get<SummaryResponse>('/crimereportbook/summary/', {
					params: {
						date_from: dateFrom || undefined,
						date_to: dateTo || undefined,
						county: county || undefined
					}
				})
				return res.data
			} catch (e: any) {
				const status = e?.response?.status
				if (status === 401 || status === 403) {
					// Only fallback to public summary for auth errors
					const url = `${API_BASE_URL}/public/summary/`
					const res = await fetch(url + `?` + new URLSearchParams({
						date_from: dateFrom || '',
						date_to: dateTo || '',
						county: county || ''
					}).toString())
					if (!res.ok) throw e
					return (await res.json()) as SummaryResponse
				}
				throw e
			}
		}
	})

	return (
		<div className="space-y-6">
			<div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6 mb-6">
				<h2 className="text-3xl font-bold mb-2">Crime Dashboard</h2>
				<p className="text-gray-100 text-sm">
					Comprehensive overview of crime statistics. Use filters to explore data by date and county.
					Click a county row to view detailed reports. Use the Map for geospatial visualization.
				</p>
			</div>
			
			<div className="bg-white shadow-md rounded-lg p-6 border-l-4 border-blue-500">
				<h3 className="text-xl font-bold mb-4 text-gray-800">Crime Summary</h3>
				<form onSubmit={(e: FormEvent) => { e.preventDefault(); refetch() }} className="bg-gray-50 p-4 rounded-lg mb-4">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
							<input name="date_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent" />
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
							<input name="date_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent" />
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">County</label>
							<input name="county" placeholder="County (optional)" value={county} onChange={(e) => setCounty(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent" />
						</div>
						<div className="flex items-end gap-2">
							<button type="submit" className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium">Apply</button>
							<button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setCounty(''); refetch() }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors">Clear</button>
						</div>
					</div>
					<small className="text-gray-500 text-xs">County accepts aliases and partial matches.</small>
			</form>
				{isLoading && <p className="opacity-80 mb-4">Loading…</p>}
			{isError && (
					<p className="text-red-300 mb-4">
					Failed to load summary. Please check your connection or try clearing filters.
				</p>
			)}
        {data && (
                <>
						<div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
							<div className="bg-emerald-50 border-l-4 border-emerald-500 rounded-lg p-4 shadow-sm">
								<div className="text-sm font-medium text-emerald-700 mb-1">Low</div>
								<div className="text-2xl font-bold text-emerald-900">{data.national.low}</div>
							</div>
							<div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 shadow-sm">
								<div className="text-sm font-medium text-amber-700 mb-1">Medium</div>
								<div className="text-2xl font-bold text-amber-900">{data.national.medium}</div>
							</div>
							<div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
								<div className="text-sm font-medium text-red-700 mb-1">High</div>
								<div className="text-2xl font-bold text-red-900">{data.national.high}</div>
							</div>
							<div className="bg-violet-50 border-l-4 border-violet-500 rounded-lg p-4 shadow-sm">
								<div className="text-sm font-medium text-violet-700 mb-1">Critical</div>
								<div className="text-2xl font-bold text-violet-900">{data.national.critical}</div>
							</div>
							<div className="bg-gray-50 border-l-4 border-gray-500 rounded-lg p-4 shadow-sm">
								<div className="text-sm font-medium text-gray-700 mb-1">Total</div>
								<div className="text-2xl font-bold text-gray-900">{data.national.total}</div>
							</div>
						</div>
						<div className="bg-white shadow-md rounded-lg p-6 mb-6">
							<h4 className="text-lg font-bold mb-4 text-gray-800">Severity Distribution</h4>
                        <div className="grid gap-2 mt-2">
							<div className="grid gap-1">
								<div className="flex items-center gap-2">
									<span className="w-20">Low</span>
									<div className="flex-1 h-4 bg-gray-200 rounded-lg overflow-hidden">
										<div style={{ width: `${data.national.total ? Math.round((data.national.low / data.national.total) * 100) : 0}%`}} className="h-full bg-emerald-500" />
									</div>
									<span className="w-10 text-right">{data.national.low}</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="w-20">Medium</span>
									<div className="flex-1 h-4 bg-gray-200 rounded-lg overflow-hidden">
										<div style={{ width: `${data.national.total ? Math.round((data.national.medium / data.national.total) * 100) : 0}%`}} className="h-full bg-amber-500" />
									</div>
									<span className="w-10 text-right">{data.national.medium}</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="w-20">High</span>
									<div className="flex-1 h-4 bg-gray-200 rounded-lg overflow-hidden">
										<div style={{ width: `${data.national.total ? Math.round((data.national.high / data.national.total) * 100) : 0}%`}} className="h-full bg-red-500" />
									</div>
									<span className="w-10 text-right">{data.national.high}</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="w-20">Critical</span>
									<div className="flex-1 h-4 bg-gray-200 rounded-lg overflow-hidden">
										<div style={{ width: `${data.national.total ? Math.round((data.national.critical / data.national.total) * 100) : 0}%`}} className="h-full bg-violet-500" />
									</div>
									<span className="w-10 text-right">{data.national.critical}</span>
									</div>
								</div>
                        </div>
                    </div>
                    {!!(data.timeseries || []).length && (
							<div className="bg-white shadow-md rounded-lg p-6 mb-6">
								<h4 className="text-lg font-bold mb-4 text-gray-800">Trend (last 30 days)</h4>
                            <div className="flex gap-1 items-end h-32 mt-2">
                                {(() => {
                                    const series = (data.timeseries || [])
                                    const max = Math.max(0, ...series.map((s) => s.total))
                                    return series.map((s, i) => {
                                        const h = max ? Math.max(2, Math.round((s.total / max) * 100)) : 2
                                        const lowH = max ? Math.round(((s.low || 0) / max) * 100) : 0
                                        const medH = max ? Math.round(((s.medium || 0) / max) * 100) : 0
                                        const highH = max ? Math.round(((s.high || 0) / max) * 100) : 0
                                        const critH = max ? Math.round(((s.critical || 0) / max) * 100) : 0
                                        return (
                                            <div key={i} title={`${s.date}: ${s.total}`} className="w-2.5 grid items-end">
                                                <div style={{ height: h }} className="w-full grid">
                                                    <div style={{ height: lowH }} className="bg-emerald-500"></div>
                                                    <div style={{ height: medH }} className="bg-amber-500"></div>
                                                    <div style={{ height: highH }} className="bg-red-500"></div>
                                                    <div style={{ height: critH }} className="bg-violet-500"></div>
                                                </div>
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        </div>
                    )}
						<div className="bg-white shadow-md rounded-lg p-6 mb-6">
							<h4 className="text-lg font-bold mb-4 text-gray-800">Top Counties (Stacked by Severity)</h4>
                    <div className="grid gap-2 mt-2">
                            {data.by_county.filter((r) => (r.total || 0) > 0).slice(0, 10).map((row, idx) => {
                                const total = row.total || 0
                                const pLow = total ? (row.low / total) * 100 : 0
                                const pMed = total ? (row.medium / total) * 100 : 0
								const pHigh = total ? (row.high / total) * 100 : 0
								const pCrit = total ? (row.critical / total) * 100 : 0
								return (
                                    <div key={idx} className="grid gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="w-40">{normalizeCountyName(row.county)}</span>
                                            <div className="flex-1 h-4 bg-gray-200 rounded-lg overflow-hidden flex">
												<div style={{ width: `${Math.round(pLow)}%`}} className="h-full bg-emerald-500" />
												<div style={{ width: `${Math.round(pMed)}%`}} className="h-full bg-amber-500" />
												<div style={{ width: `${Math.round(pHigh)}%`}} className="h-full bg-red-500" />
												<div style={{ width: `${Math.round(pCrit)}%`}} className="h-full bg-violet-500" />
											</div>
											<span className="w-16 text-right">{total}</span>
										</div>
									</div>
								)
							})}
							<div className="flex gap-3 items-center mt-2">
								<span className="w-3 h-3 bg-emerald-500 inline-block" /> Low
								<span className="w-3 h-3 bg-amber-500 inline-block" /> Medium
								<span className="w-3 h-3 bg-red-500 inline-block" /> High
								<span className="w-3 h-3 bg-violet-500 inline-block" /> Critical
							</div>
						</div>
					</div>
						<div className="bg-white shadow-md rounded-lg overflow-hidden mb-6">
							<div className="p-4 bg-gray-50 border-b">
								<h4 className="text-lg font-bold text-gray-800">County Breakdown</h4>
								<p className="text-sm text-gray-600 mt-1">Click on any county row to view detailed reports</p>
							</div>
							<table className="w-full text-left table-bordered">
						<thead>
							<tr>
										<th>County</th>
										<th className="text-center">Low</th>
										<th className="text-center">Medium</th>
										<th className="text-center">High</th>
										<th className="text-center">Critical</th>
										<th className="text-center font-bold">Total</th>
							</tr>
						</thead>
						<tbody>
							{data.by_county.map((row, idx) => (
										<tr key={idx} className="cursor-pointer transition-colors hover:bg-blue-50" onClick={() => navigate(`/reports?county=${encodeURIComponent(normalizeCountyName(row.county))}`)}>
											<td className="font-medium text-primary">{normalizeCountyName(row.county)}</td>
											<td className="text-center text-emerald-600 font-medium">{row.low}</td>
											<td className="text-center text-amber-600 font-medium">{row.medium}</td>
											<td className="text-center text-red-600 font-medium">{row.high}</td>
											<td className="text-center text-violet-600 font-medium">{row.critical}</td>
											<td className="text-center font-bold text-gray-900">{row.total}</td>
                                </tr>
							))}
						</tbody>
					</table>
						</div>
				</>
			)}
			</div>

			{/* WebSocket / Live Updates Viewer */}
			<WebSocketViewer enabled={true} />
		</div>
	)
}
