import { useEffect, useState } from 'react'
import { listIncidents } from '../api/incidents'

export default function FeedPage() {
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    async function load() {
      const data = await listIncidents()
      if (mounted && Array.isArray(data)) setItems(data)
    }
    load()
    return () => { mounted = false }
  }, [])

  return (
    <div>
      <h2>Recent Alerts</h2>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <strong>{it.category}</strong> — {it.description || it.title} <em>({new Date(it.date_created).toLocaleString()})</em>
          </li>
        ))}
      </ul>
    </div>
  )
}
