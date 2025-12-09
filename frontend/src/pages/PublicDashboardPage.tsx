import { useQuery } from '@tanstack/react-query'
import { api } from '../api/axios'
import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeCountyName } from '../lib/normalizeCounty'

type SummaryResponse = {
    date_from?: string | null
    date_to?: string | null
    national: { low: number; medium: number; high: number; critical: number; total: number }
    by_county: { county: string; low: number; medium: number; high: number; critical: number; total: number }[]
    timeseries?: { date: string; total: number; low: number; medium: number; high: number; critical: number }[]
}

export default function PublicDashboardPage() {
	const [dateFrom, setDateFrom] = useState('')
	const [dateTo, setDateTo] = useState('')
	const [county, setCounty] = useState('')
	const navigate = useNavigate()
	const query = useQuery({
		queryKey: ['public_summary', { dateFrom, dateTo, county }],
		queryFn: async () => {
			const res = await api.get<SummaryResponse>('/public/summary/', {
				params: { date_from: dateFrom || undefined, date_to: dateTo || undefined, county: county || undefined }
			})
			return res.data
		}
	})

	return (
		<div>
			<h2>Public Dashboard</h2>
			<form onSubmit={(e: FormEvent) => { e.preventDefault(); query.refetch() }} className="row mb-3">
				<input name="date_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
				<input name="date_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
				<input name="county" placeholder="County (optional)" value={county} onChange={(e) => setCounty(e.target.value)} />
				<button type="submit">Apply</button>
				<button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setCounty(''); query.refetch() }}>Clear</button>
			</form>
			{query.isLoading && <p>Loading…</p>}
			{query.isError && <p style={{ color: 'crimson' }}>Failed to load summary.</p>}
            {query.data && (
                <>
					<div className="card mb-3">
						<strong>National totals:</strong>
						<div className="row mt-2">
							<span>Low: {query.data.national.low}</span>
							<span>Medium: {query.data.national.medium}</span>
							<span>High: {query.data.national.high}</span>
							<span>Critical: {query.data.national.critical}</span>
							<span>Total: {query.data.national.total}</span>
						</div>
					</div>
                    <div className="card mb-3">
                        <strong>Severity distribution</strong>
                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
							<div style={{ display: 'grid', gap: 4 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<span style={{ minWidth: 70 }}>Low</span>
									<div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
										<div style={{ width: `${query.data.national.total ? Math.round((query.data.national.low / query.data.national.total) * 100) : 0}%`, height: '100%', background: '#10b981' }} />
									</div>
									<span style={{ minWidth: 40, textAlign: 'right' }}>{query.data.national.low}</span>
								</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<span style={{ minWidth: 70 }}>Medium</span>
									<div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
										<div style={{ width: `${query.data.national.total ? Math.round((query.data.national.medium / query.data.national.total) * 100) : 0}%`, height: '100%', background: '#f59e0b' }} />
									</div>
									<span style={{ minWidth: 40, textAlign: 'right' }}>{query.data.national.medium}</span>
								</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<span style={{ minWidth: 70 }}>High</span>
									<div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
										<div style={{ width: `${query.data.national.total ? Math.round((query.data.national.high / query.data.national.total) * 100) : 0}%`, height: '100%', background: '#ef4444' }} />
									</div>
									<span style={{ minWidth: 40, textAlign: 'right' }}>{query.data.national.high}</span>
								</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
									<span style={{ minWidth: 70 }}>Critical</span>
									<div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
										<div style={{ width: `${query.data.national.total ? Math.round((query.data.national.critical / query.data.national.total) * 100) : 0}%`, height: '100%', background: '#7c3aed' }} />
									</div>
									<span style={{ minWidth: 40, textAlign: 'right' }}>{query.data.national.critical}</span>
								</div>
                        </div>
                    </div>
                    {!!(query.data.timeseries || []).length && (
                        <div className="card mb-3">
                            <strong>Trend (last 30 days)</strong>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'end', height: 120, marginTop: 8 }}>
                                {(() => {
                                    const series = (query.data.timeseries || [])
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
                            {query.data.by_county.filter((r) => (r.total || 0) > 0).slice(0, 10).map((row, idx) => {
                                const total = row.total || 0
                                const pLow = total ? (row.low / total) * 100 : 0
                                const pMed = total ? (row.medium / total) * 100 : 0
								const pHigh = total ? (row.high / total) * 100 : 0
								const pCrit = total ? (row.critical / total) * 100 : 0
								return (
									<div key={idx} style={{ display: 'grid', gap: 6 }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
											<span style={{ minWidth: 160 }}>{normalizeCountyName(row.county)}</span>
											<div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
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
                            {query.data.by_county.map((row, idx) => (
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
