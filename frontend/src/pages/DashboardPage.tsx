import { useQuery } from '@tanstack/react-query'
import { api } from '../api/axios'
import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type SummaryResponse = {
	date_from?: string | null
	date_to?: string | null
	national: { low: number; medium: number; high: number; critical: number; total: number }
	by_county: { county: string; low: number; medium: number; high: number; critical: number; total: number }[]
}

export default function DashboardPage() {
	const [dateFrom, setDateFrom] = useState('')
	const [dateTo, setDateTo] = useState('')
	const [county, setCounty] = useState('')
	const navigate = useNavigate()
	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: ['summary', { dateFrom, dateTo, county }],
		queryFn: async () => {
			const res = await api.get<SummaryResponse>('/crimereportbook/summary/', {
				params: {
					date_from: dateFrom || undefined,
					date_to: dateTo || undefined,
					county: county || undefined
				}
			})
			return res.data
		}
	})

	return (
		<div>
			<h2>Crime Summary</h2>
			<form onSubmit={(e: FormEvent) => { e.preventDefault(); refetch() }} className="row mb-3">
				<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
				<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
				<input placeholder="County (optional)" value={county} onChange={(e) => setCounty(e.target.value)} />
				<button type="submit">Apply</button>
				<button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setCounty(''); refetch() }}>Clear</button>
			</form>
			{isLoading && <p>Loading…</p>}
			{isError && <p style={{ color: 'crimson' }}>Failed to load summary.</p>}
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
								<tr key={idx} style={{ cursor: 'pointer' }} onClick={() => navigate(`/reports?county=${encodeURIComponent(row.county)}`)}>
									<td><u>{row.county}</u></td>
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

