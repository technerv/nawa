import { useEffect, useState } from 'react'
import { listIncidents } from '../api/incidents'
import { formatDate } from '../lib/dateFormat'

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
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-lg p-6">
        <h2 className="text-3xl font-bold mb-2">Recent Alerts</h2>
        <p className="text-gray-100 text-sm">View the latest incident alerts and updates</p>
      </div>
      {items.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center border border-gray-200">
          <p className="text-gray-600">No alerts available at this time.</p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
          <div className="p-4 bg-gray-50 border-b">
            <h3 className="text-lg font-bold text-gray-800">Alert Feed</h3>
            <p className="text-sm text-gray-600 mt-1">Total: {items.length} alerts</p>
          </div>
          <div className="divide-y divide-gray-200">
            {items.map((it) => (
              <div key={it.id} className="p-4 hover:bg-blue-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-bold text-gray-800 mb-1">{it.category}</div>
                    <div className="text-gray-700">{it.description || it.title}</div>
                  </div>
                  <div className="text-sm text-gray-500 ml-4">
                    {formatDate(it.date_created)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
