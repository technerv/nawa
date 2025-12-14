import { hasAnyRole, ROLES } from '../lib/roles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCrimeCategory, listCrimeCategories } from '../api/crime'
import { showToast } from '../lib/toast'
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
			showToast('Category created', 'success')
		}
	})

	function onSubmit(e: FormEvent) {
		e.preventDefault()
		createMut.mutate()
	}

	const canCreate = hasAnyRole([ROLES.Admin, ROLES.Dispatcher, ROLES.SuperAdmin])
	return (
		<div className="space-y-6">
			<div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6">
				<h2 className="text-3xl font-bold mb-2">Crime Categories</h2>
				<p className="text-gray-100 text-sm">Manage crime categories and their short codes</p>
			</div>

			<div className="bg-white shadow-md rounded-lg p-4 mb-6 border border-gray-200">
				<div className="flex gap-3 items-end">
					<div className="flex-1">
						<label className="block text-sm font-medium text-gray-700 mb-1">Search Categories</label>
						<input 
							placeholder="Search..." 
							value={search} 
							onChange={(e) => setSearch(e.target.value)}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
						/>
					</div>
					<button 
						onClick={() => { setPage(1); refetch() }}
						className="px-4 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium"
					>
						Search
					</button>
				</div>
				<small className="text-gray-500 text-xs mt-1 block">Use keywords to find categories. Admins can create new ones.</small>
			</div>

			{canCreate ? (
				<div className="bg-white shadow-md rounded-lg p-6 mb-6 border border-gray-200">
					<h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Create New Category</h3>
					<form onSubmit={onSubmit} className="grid gap-4 max-w-2xl">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Category Name <span className="text-red-500">*</span></label>
								<input 
									required 
									name="crime_category" 
									placeholder="Category name" 
									value={crime_category} 
									onChange={(e) => setCrimeCategory(e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Short Code <span className="text-red-500">*</span></label>
								<input 
									required 
									name="crime_short_code" 
									placeholder="Short code (3 letters)" 
									value={crime_short_code} 
									onChange={(e) => setCrimeShortCode(e.target.value)}
									maxLength={3}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent uppercase"
								/>
							</div>
						</div>
						<div className="flex gap-3">
							<button 
								type="submit" 
								disabled={createMut.isPending}
								className="px-6 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
							>
								{createMut.isPending ? 'Creating...' : 'Create Category'}
							</button>
							{createMut.isError && (
								<p className="text-red-600 text-sm flex items-center">
									{(createMut.error as any)?.response?.data?.crime_short_code?.[0] ?? 'Create failed'}
								</p>
							)}
						</div>
					</form>
				</div>
			) : (
				<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
					<p className="text-yellow-800">You do not have permission to create categories.</p>
				</div>
			)}

			{isLoading && (
				<div className="bg-white shadow-md rounded-lg p-6 text-center">
					<p className="text-gray-600">Loading...</p>
				</div>
			)}
			{isError && (
				<div className="bg-red-50 border border-red-200 rounded-lg p-4">
					<p className="text-red-600">Failed to load categories</p>
				</div>
			)}
			{data && (
				<>
					<div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
						<div className="p-4 bg-gray-50 border-b">
							<h3 className="text-lg font-bold text-gray-800">Categories List</h3>
							<p className="text-sm text-gray-600 mt-1">Total: {data.count || 0} categories</p>
						</div>
						<table className="w-full text-left table-bordered">
							<thead>
								<tr>
									<th>ID</th>
									<th>Category</th>
									<th>Code</th>
								</tr>
							</thead>
							<tbody>
								{data.results.map((c) => (
									<tr key={c.id} className="transition-colors hover:bg-blue-50">
										<td className="font-mono text-sm">{c.id}</td>
										<td className="font-medium">{c.crime_category}</td>
										<td className="font-mono text-sm text-primary">{c.crime_short_code}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="flex items-center gap-4 mt-4">
						<button 
							disabled={!data.previous || page <= 1} 
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
						>
							Prev
						</button>
						<span className="text-gray-700 font-medium">Page {page}</span>
						<button 
							disabled={!data.next} 
							onClick={() => setPage((p) => p + 1)}
							className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
						>
							Next
						</button>
						{typeof data.count === 'number' && <span className="text-gray-600 text-sm">Total: {data.count}</span>}
					</div>
				</>
			)}
		</div>
	)
}
