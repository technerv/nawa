import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../api/axios'

export interface WebSocketMessage {
  type: string
  data: any
  timestamp?: string
}

export function useWebSocket(url: string, onMessage?: (message: WebSocketMessage) => void) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  useEffect(() => {
    const connect = () => {
      try {
        // Get JWT token from localStorage
        const token = localStorage.getItem('access_token')
        if (!token) {
          console.warn('No access token found, WebSocket connection skipped')
          return
        }

        // Convert HTTP URL to WebSocket URL
        const wsUrl = url.replace('http://', 'ws://').replace('https://', 'wss://')
        const wsUrlWithToken = `${wsUrl}?token=${encodeURIComponent(token)}`

        const ws = new WebSocket(wsUrlWithToken)

        ws.onopen = () => {
          console.log('WebSocket connected')
          setIsConnected(true)
          reconnectAttempts.current = 0
          
          // Send ping to keep connection alive
          const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now()
              }))
            } else {
              clearInterval(pingInterval)
            }
          }, 30000) // Ping every 30 seconds
        }

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            
            // Handle pong
            if (message.type === 'pong') {
              return
            }
            
            setLastMessage(message)
            if (onMessage) {
              onMessage(message)
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err)
          }
        }

        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          setIsConnected(false)
        }

        ws.onclose = () => {
          console.log('WebSocket disconnected')
          setIsConnected(false)
          
          // Attempt to reconnect
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`)
            
            reconnectTimeoutRef.current = window.setTimeout(() => {
              connect()
            }, delay) as any
          } else {
            console.error('Max reconnection attempts reached')
          }
        }

        wsRef.current = ws
      } catch (err) {
        console.error('Failed to create WebSocket connection:', err)
        setIsConnected(false)
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [url, onMessage])

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      return true
    }
    return false
  }

  return { isConnected, lastMessage, sendMessage }
}

