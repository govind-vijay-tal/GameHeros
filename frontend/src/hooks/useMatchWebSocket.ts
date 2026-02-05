import { useEffect, useRef, useState, useCallback } from 'react'
import { getWebSocketUrl, WSMessage, CricketState } from '../api/matches'

interface UseMatchWebSocketOptions {
  onScoreUpdate?: (state: CricketState, score: string) => void
  onMatchStarted?: (state: CricketState) => void
  onMatchEnded?: (state: CricketState, result: string) => void
  onError?: (error: string) => void
}

interface UseMatchWebSocketReturn {
  isConnected: boolean
  state: CricketState | null
  score: string
  error: string | null
  reconnect: () => void
}

export function useMatchWebSocket(
  matchId: string | undefined,
  options: UseMatchWebSocketOptions = {}
): UseMatchWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [state, setState] = useState<CricketState | null>(null)
  const [score, setScore] = useState('')
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  
  const optionsRef = useRef(options)
  optionsRef.current = options

  const connect = useCallback(() => {
    if (!matchId) return

    
    if (wsRef.current) {
      wsRef.current.close()
    }

    const wsUrl = getWebSocketUrl(matchId)
    console.log('[WebSocket] Connecting to:', wsUrl)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WebSocket] Connected to match:', matchId)
      setIsConnected(true)
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)
        console.log('[WebSocket] Message received:', message.type, message.payload)

        switch (message.type) {
          case 'INITIAL_STATE':
          case 'SCORE_UPDATE': {
            const updateState = message.payload.state as CricketState
            const updateScore = message.payload.score as string
            setState(updateState)
            setScore(updateScore)
            optionsRef.current.onScoreUpdate?.(updateState, updateScore)
            break
          }

          case 'MATCH_STARTED': {
            const startState = message.payload as CricketState
            setState(startState)
            optionsRef.current.onMatchStarted?.(startState)
            break
          }

          case 'MATCH_ENDED': {
            const endState = message.payload.state as CricketState
            setState(endState)
            setScore(message.payload.score || endState.result || '')
            optionsRef.current.onMatchEnded?.(endState, endState.result || '')
            break
          }

          case 'ERROR':
            setError(message.payload.message || 'Unknown error')
            optionsRef.current.onError?.(message.payload.message)
            break
        }
      } catch (e) {
        console.error('[WebSocket] Error parsing message:', e)
      }
    }

    ws.onclose = (event) => {
      console.log('[WebSocket] Disconnected:', event.code, event.reason)
      setIsConnected(false)
      wsRef.current = null

      
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] Attempting reconnect...')
          connect()
        }, 3000)
      }
    }

    ws.onerror = (event) => {
      console.error('[WebSocket] Error:', event)
      setError('Connection error')
    }
  }, [matchId])

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    connect()
  }, [connect])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted')
      }
    }
  }, [connect])

  return {
    isConnected,
    state,
    score,
    error,
    reconnect,
  }
}
