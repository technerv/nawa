import { useQuery } from '@tanstack/react-query'
import { FormEvent, useState } from 'react'
import { listNeighborhoods, joinNeighborhood } from '../api/neighborhood'

export default function NeighborhoodJoinPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [selectedId, setSelectedId] = useState<number | undefined>()
  const [status, setStatus] = useState<string | null>(null)

  const neighborhoods = useQuery({
    queryKey: ['neighborhoods'],
    queryFn: async () => {
      const res = await listNeighborhoods()
      return res.results
    }
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setStatus('joining')
    try {
      await joinNeighborhood(selectedId, inviteCode || undefined)
      setStatus('joined')
    } catch (err: any) {
      setStatus(err?.response?.data?.detail || 'join_failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6">
        <h2 className="text-3xl font-bold mb-2">Join Neighborhood</h2>
        <p className="text-gray-100 text-sm">Join a neighborhood to receive alerts and stay informed about local incidents</p>
      </div>
      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-3">Join a Neighborhood</h3>
        <form onSubmit={submit} className="grid gap-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neighborhood <span className="text-red-500">*</span></label>
            <select 
              name="neighborhood_id" 
              value={selectedId ?? ''} 
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
            >
              <option value="">Select neighborhood…</option>
              {neighborhoods.data?.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invite Code (optional)</label>
            <input 
              name="invite_code" 
              placeholder="Invite code (optional)" 
              value={inviteCode} 
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <button 
              type="submit" 
              disabled={!selectedId || status === 'joining'}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {status === 'joining' ? 'Joining...' : 'Join Neighborhood'}
            </button>
            {status && (
              <div className={`flex items-center px-4 py-2 rounded-md ${status === 'joined' ? 'bg-green-50 text-green-800 border border-green-200' : status === 'join_failed' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-gray-50 text-gray-800 border border-gray-200'}`}>
                <span className="text-sm font-medium">
                  {status === 'joined' ? '✓ Successfully joined!' : status === 'join_failed' ? `✗ Failed: ${status}` : `Status: ${status}`}
                </span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
