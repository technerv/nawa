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
    <div>
      <h2>Join Neighborhood</h2>
      <form onSubmit={submit} className="row mb-3">
        <select name="neighborhood_id" value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Select neighborhood…</option>
          {neighborhoods.data?.map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
        <input name="invite_code" placeholder="Invite code (optional)" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
        <button type="submit" className="btn-primary">Join</button>
      </form>
      {status && <p>Status: {status}</p>}
    </div>
  )
}
