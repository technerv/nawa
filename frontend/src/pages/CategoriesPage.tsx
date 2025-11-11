import { hasAnyRole, ROLES } from '../lib/roles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCrimeCategory, listCrimeCategories } from '../api/crime'
import { FormEvent, useState } from 'react'

export default function CategoriesPage() {
	const queryClient = useQueryClient()
	const [crime_category, setCrimeCategory] = useState('')
	const [crime_short_code, setCrimeShortCode] = useState('')
	const [search, setSearch] = useState('')
	const [page, setPage] = useState(1)

	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: ['categories', { search, page }],
		queryFn: () => listCrimeCategories({ search, page })
	})

	const createMut = useMutation({
		mutationFn: () => createCrimeCategory({ crime_category, crime_short_code }),
		onSuccess: () => {
			setCrimeCategory('')
			setCrimeShortCode('')
			queryClient.invalidateQueries({ queryKey: ['categories'] })
		}
	})

	function onSubmit(e: FormEvent) {
		e.preventDefault()
		createMut.mutate()
	}

	const canCreate = hasAnyRole([ROLES.Admin, ROLES.Dispatcher, ROLES.SuperAdmin])
	return (
		<div>
			<h2>Crime Categories</h2>

			<div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
				<input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
				<button onClick={() => { setPage(1); refetch() }}>Search</button>
			</div>

			{canCreate ? (
				<form onSubmit={onSubmit} style={{ display: 'grid', gap: 8, maxWidth: 480, marginBottom: 16 }}>
					<input required placeholder="Category name" value={crime_category} onChange={(e) => setCrimeCategory(e.target.value)} />
					<input required placeholder="Short code (3 letters)" value={crime_short_code} onChange={(e) => setCrimeShortCode(e.target.value)} />
					<button type="submit" disabled={createMut.isLoading}>Create</button>
					{createMut.isError && <p style={{ color: 'crimson' }}>{(createMut.error as any)?.response?.data?.crime_short_code?.[0] ?? 'Create failed'}</p>}
				</form>
			) : (
				<p style={{ color: '#666', marginBottom: 16 }}>You do not have permission to create categories.</p>
			)}

			{isLoading && <p>Loading...</p>}
			{isError && <p style={{ color: 'crimson' }}>Failed to load categories</p>}
			{data && (
				<>
					<table width="100%" cellPadding={8} style={{ borderCollapse: 'collapse' }}>
						<thead>
							<tr>
								<th align="left">ID</th>
								<th align="left">Category</th>
								<th align="left">Code</th>
							</tr>
						</thead>
						<tbody>
							{data.results.map((c) => (
								<tr key={c.id} style={{ borderTop: '1px solid #eee' }}>
									<td>{c.id}</td>
									<td>{c.crime_category}</td>
									<td>{c.crime_short_code}</td>
								</tr>
							))}
						</tbody>
					</table>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
						<button disabled={!data.previous || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
							Prev
						</button>
						<span>Page {page}</span>
						<button disabled={!data.next} onClick={() => setPage((p) => p + 1)}>
							Next
						</button>
						{typeof data.count === 'number' && <span style={{ color: '#666' }}>Total: {data.count}</span>}
					</div>
				</>
			)}
		</div>
	)
}

