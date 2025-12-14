import { useState, useEffect, useRef } from 'react'
import { useWebSocket, WebSocketMessage } from '../hooks/useWebSocket'
import { API_BASE_URL } from '../api/axios'
import { me, MeResponse } from '../api/auth'
import { useQuery } from '@tanstack/react-query'
import { isSuperAdmin } from '../lib/roles'
import { formatDate } from '../lib/dateFormat'

interface WebSocketViewerProps {
  enabled?: boolean
}

export default function WebSocketViewer({ enabled = true }: WebSocketViewerProps) {
  const [messages, setMessages] = useState<Array<WebSocketMessage & { receivedAt: Date }>>([])
  const [usePolling, setUsePolling] = useState(false)
  const [pollInterval, setPollInterval] = useState(5000) // 5 seconds default
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastEventIdRef = useRef<number | null>(null)
  const maxMessages = 100 // Keep last 100 messages

  // Fetch user profile to determine WebSocket URL
  const { data: userProfile } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: me,
    enabled,
  })

  // Build WebSocket URL based on user role and organization
  const wsUrl = userProfile
    ? isSuperAdmin(userProfile.roles)
      ? `${API_BASE_URL.replace('/api', '')}/ws/alerts/`
      : userProfile.organization
      ? `${API_BASE_URL.replace('/api', '')}/ws/alerts/${userProfile.organization.id}/`
      : `${API_BASE_URL.replace('/api', '')}/ws/alerts/` // Fallback
    : `${API_BASE_URL.replace('/api', '')}/ws/alerts/` // Default while loading

  // WebSocket connection
  const { isConnected, lastMessage } = useWebSocket(
    usePolling ? '' : wsUrl, // Disable WebSocket when polling
    (message) => {
      // Add message to history
      setMessages((prev) => {
        const newMessages = [...prev, { ...message, receivedAt: new Date() }]
        return newMessages.slice(-maxMessages) // Keep only last 100
      })
    }
  )

  // Polling fallback - fetch AlertEvents
  useEffect(() => {
    if (!usePolling || !enabled) return

    const poll = async () => {
      try {
        const token = localStorage.getItem('access_token')
        if (!token) return

        // Fetch recent alert events
        const params = new URLSearchParams({ ordering: '-created_at', limit: '5' })
        if (lastEventIdRef.current) {
          // Only get events newer than last seen
          params.append('id__gt', String(lastEventIdRef.current))
        }

        const res = await fetch(`${API_BASE_URL}/alertevent/?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (res.ok) {
          const data = await res.json()
          const results = Array.isArray(data) ? data : data.results || []
          
          // Process new events
          for (const event of results) {
            if (lastEventIdRef.current === null || event.id > lastEventIdRef.current) {
              lastEventIdRef.current = event.id
            }

            const pollMessage: WebSocketMessage = {
              type: 'alert',
              data: {
                type: event.event_type || 'poll_update',
                id: event.incident,
                severity: event.severity,
                status: event.event_type,
                location: event.incident_name,
                county: event.county,
                ob_number: event.incident_ob_number,
                event_id: event.id,
                created_at: event.created_at,
              },
              timestamp: event.created_at || new Date().toISOString(),
            }

            setMessages((prev) => {
              // Avoid duplicates
              const exists = prev.some(
                (m) => m.data?.event_id === event.id || 
                (m.data?.id === event.incident && m.data?.type === event.event_type)
              )
              if (exists) return prev
              
              const newMessages = [...prev, { ...pollMessage, receivedAt: new Date() }]
              return newMessages.slice(-maxMessages)
            })
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }

    // Initial poll
    poll()
    
    const interval = setInterval(poll, pollInterval)
    return () => clearInterval(interval)
  }, [usePolling, pollInterval, enabled])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const clearMessages = () => {
    setMessages([])
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">WebSocket / Live Updates</h3>
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                usePolling ? 'bg-yellow-400' : isConnected ? 'bg-green-400' : 'bg-red-400'
              }`}
              title={
                usePolling
                  ? 'Polling Mode'
                  : isConnected
                  ? 'WebSocket Connected'
                  : 'WebSocket Disconnected'
              }
            />
            <span className="text-sm text-gray-600">
              {usePolling ? 'Polling' : isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>

          {/* Toggle between WebSocket and Polling */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Mode:</label>
            <button
              onClick={() => setUsePolling(false)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                !usePolling
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              WebSocket
            </button>
            <button
              onClick={() => setUsePolling(true)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                usePolling
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Polling
            </button>
          </div>

          {/* Polling Interval Control */}
          {usePolling && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Interval:</label>
              <select
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value={2000}>2s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
              </select>
            </div>
          )}

          {/* Clear Messages */}
          <button
            onClick={clearMessages}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Message Count */}
      <div className="mb-4 text-sm text-gray-600">
        Messages: {messages.length} / {maxMessages}
      </div>

      {/* Messages List */}
      <div className="border border-gray-200 rounded-lg h-96 overflow-y-auto bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>No messages yet. Waiting for updates...</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className="bg-white rounded p-3 border border-gray-200 shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        msg.type === 'alert'
                          ? 'bg-blue-100 text-blue-800'
                          : msg.type === 'pong'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {msg.type}
                    </span>
                    {msg.data?.severity && (
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          msg.data.severity === 'critical'
                            ? 'bg-violet-100 text-violet-800'
                            : msg.data.severity === 'high'
                            ? 'bg-red-100 text-red-800'
                            : msg.data.severity === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {msg.data.severity}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(msg.receivedAt.toISOString())}
                  </span>
                </div>
                {msg.data && (
                  <div className="text-sm text-gray-700 space-y-1">
                    {msg.data.type && (
                      <div>
                        <strong>Event:</strong> {msg.data.type}
                      </div>
                    )}
                    {msg.data.ob_number && (
                      <div>
                        <strong>OB Number:</strong> {msg.data.ob_number}
                      </div>
                    )}
                    {msg.data.location && (
                      <div>
                        <strong>Location:</strong> {msg.data.location}
                      </div>
                    )}
                    {msg.data.county && (
                      <div>
                        <strong>County:</strong> {msg.data.county}
                      </div>
                    )}
                    {msg.data.status && (
                      <div>
                        <strong>Status:</strong> {msg.data.status}
                      </div>
                    )}
                    {Object.keys(msg.data).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer">
                          View Raw Data
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify(msg.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="mt-4 text-xs text-gray-500">
        {usePolling ? (
          <p>
            Polling mode: Fetching updates every {pollInterval / 1000}s. Switch to WebSocket for
            real-time updates.
          </p>
        ) : (
          <p>
            WebSocket mode: Real-time updates via WebSocket connection. Falls back to polling if
            connection fails.
          </p>
        )}
      </div>
    </div>
  )
}
