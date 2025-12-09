import { useQuery } from '@tanstack/react-query'
import { api, API_BASE_URL } from '../api/axios'
import { normalizeCountyName } from '../lib/normalizeCounty'
import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
		<div>
			<h2>Overview</h2>
			<div className="card mb-3">
				<p style={{ margin: 0 }}>
					Welcome. Use the filters below to explore crime summary by date and county.
					Click a county row to view detailed reports. Use the Map for geospatial view.
					Admins can manage alerts via Alerts, and everyone can join a Neighborhood from Join Neighborhood.
				</p>
			</div>
            <h3>Crime Summary</h3>
			<form onSubmit={(e: FormEvent) => { e.preventDefault(); refetch() }} className="row mb-3">
				<input name="date_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
				<input name="date_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
				<input name="county" placeholder="County (optional)" value={county} onChange={(e) => setCounty(e.target.value)} />
				<button type="submit">Apply</button>
				<button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setCounty(''); refetch() }}>Clear</button>
			</form>
			<small style={{ color: '#cbd5e1', display: 'block', marginTop: -8, marginBottom: 8 }}>County accepts aliases and partial matches.</small>
			{isLoading && <p style={{ opacity: .8 }}>Loading…</p>}
			{isError && (
				<p style={{ color: '#fecaca' }}>
					Failed to load summary. Please check your connection or try clearing filters.
				</p>
			)}
        {data && (
                <>
                    <div className="card mb-3">
                        <strong>National totals:</strong>
						<div className="row mt-2">
							<span>Low: {data.national.low}</span>
							<span>Medium: {data.national.medium}</span>
							<span>High: {data.national.high}</span>
							<span>Critical: {data.national.critical}</span>
							<span>Total: {data.national.total}</span>
						</div>
					</div>
                    <div className="card mb-3">
                        <strong>Severity distribution</strong>
                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
							<div style={{ display: 'grid', gap: 4 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<span style={{ minWidth: 70 }}>Low</span>
									<div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
										<div style={{ width: `${data.national.total ? Math.round((data.national.low / data.national.total) * 100) : 0}%`, height: '100%', background: '#10b981' }} />
									</div>
									<span style={{ minWidth: 40, textAlign: 'right' }}>{data.national.low}</span>
								</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<span style={{ minWidth: 70 }}>Medium</span>
									<div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
										<div style={{ width: `${data.national.total ? Math.round((data.national.medium / data.national.total) * 100) : 0}%`, height: '100%', background: '#f59e0b' }} />
									</div>
									<span style={{ minWidth: 40, textAlign: 'right' }}>{data.national.medium}</span>
								</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<span style={{ minWidth: 70 }}>High</span>
									<div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
										<div style={{ width: `${data.national.total ? Math.round((data.national.high / data.national.total) * 100) : 0}%`, height: '100%', background: '#ef4444' }} />
									</div>
									<span style={{ minWidth: 40, textAlign: 'right' }}>{data.national.high}</span>
								</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<span style={{ minWidth: 70 }}>Critical</span>
									<div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
										<div style={{ width: `${data.national.total ? Math.round((data.national.critical / data.national.total) * 100) : 0}%`, height: '100%', background: '#7c3aed' }} />
									</div>
									<span style={{ minWidth: 40, textAlign: 'right' }}>{data.national.critical}</span>
								</div>
                        </div>
                    </div>
                    {!!(data.timeseries || []).length && (
                        <div className="card mb-3">
                            <strong>Trend (last 30 days)</strong>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'end', height: 120, marginTop: 8 }}>
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
                                            <div key={i} title={`${s.date}: ${s.total}`} style={{ width: 10, display: 'grid', alignItems: 'end' }}>
                                                <div style={{ height: h, width: '100%', display: 'grid' }}>
                                                    <div style={{ height: lowH, background: '#10b981' }}></div>
                                                    <div style={{ height: medH, background: '#f59e0b' }}></div>
                                                    <div style={{ height: highH, background: '#ef4444' }}></div>
                                                    <div style={{ height: critH, background: '#7c3aed' }}></div>
                                                </div>
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        </div>
                    )}
                </div>
                <div className="card mb-3">
                    <strong>Top counties (stacked by severity)</strong>
                    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                            {data.by_county.filter((r) => (r.total || 0) > 0).slice(0, 10).map((row, idx) => {
                                const total = row.total || 0
                                const pLow = total ? (row.low / total) * 100 : 0
                                const pMed = total ? (row.medium / total) * 100 : 0
								const pHigh = total ? (row.high / total) * 100 : 0
								const pCrit = total ? (row.critical / total) * 100 : 0
								return (
                                    <div key={idx} style={{ display: 'grid', gap: 6 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ minWidth: 160 }}>{normalizeCountyName(row.county)}</span>
                                            <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
												<div style={{ width: `${Math.round(pLow)}%`, height: '100%', background: '#10b981' }} />
												<div style={{ width: `${Math.round(pMed)}%`, height: '100%', background: '#f59e0b' }} />
												<div style={{ width: `${Math.round(pHigh)}%`, height: '100%', background: '#ef4444' }} />
												<div style={{ width: `${Math.round(pCrit)}%`, height: '100%', background: '#7c3aed' }} />
											</div>
											<span style={{ minWidth: 60, textAlign: 'right' }}>{total}</span>
										</div>
									</div>
								)
							})}
							<div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
								<span style={{ width: 12, height: 12, background: '#10b981', display: 'inline-block' }} /> Low
								<span style={{ width: 12, height: 12, background: '#f59e0b', display: 'inline-block' }} /> Medium
								<span style={{ width: 12, height: 12, background: '#ef4444', display: 'inline-block' }} /> High
								<span style={{ width: 12, height: 12, background: '#7c3aed', display: 'inline-block' }} /> Critical
							</div>
						</div>
					</div>
					<table>
						<thead>
							<tr>
								<th align="left">County</th>
								<th align="left">Low</th>
								<th align="left">Medium</th>
								<th align="left">High</th>
								<th align="left">Critical</th>
								<th align="left">Total</th>
							</tr>
						</thead>
						<tbody>
							{data.by_county.map((row, idx) => (
                                <tr key={idx} style={{ cursor: 'pointer' }} onClick={() => navigate(`/reports?county=${encodeURIComponent(normalizeCountyName(row.county))}`)}>
                                    <td><u>{normalizeCountyName(row.county)}</u></td>
                                    <td>{row.low}</td>
                                    <td>{row.medium}</td>
                                    <td>{row.high}</td>
                                    <td>{row.critical}</td>
                                    <td>{row.total}</td>
                                </tr>
							))}
						</tbody>
					</table>
				</>
			)}
		</div>
	)
}
