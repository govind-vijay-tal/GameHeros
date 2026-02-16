import { useEffect, useRef, useCallback, useState } from 'react'
import { getWebSocketUrl, CricketState } from '../api/matches'

interface WebSocketSubscriber {
  id: string
  onScoreUpdate?: (state: CricketState, score: string) => void
  onMatchStarted?: (state: CricketState) => void
  onMatchEnded?: (state: CricketState, result: string) => void
  onStatsUpdate?: (stats: any) => void
  onEventsUpdate?: (events: any[]) => void
  onError?: (error: string) => void
  onConnectionChange?: (isConnected: boolean) => void
}

interface WebSocketConnection {
  ws: WebSocket | null
  matchId: string
  subscribers: Map<string, WebSocketSubscriber>
  state: CricketState | null
  score: string
  isConnected: boolean
  error: string | null
  reconnectTimeout: ReturnType<typeof setTimeout> | null
  cleanupTimeout: ReturnType<typeof setTimeout> | null
}

class MatchWebSocketManager {
  private connections: Map<string, WebSocketConnection> = new Map()
  private subscriberIdCounter = 0

  private generateSubscriberId(): string {
    return `subscriber-${++this.subscriberIdCounter}`
  }

  private createWebSocket(connection: WebSocketConnection): void {
    const wsUrl = getWebSocketUrl(connection.matchId)
    console.log('[WebSocketManager] Connecting to:', wsUrl)

    try {
      const ws = new WebSocket(wsUrl)
      connection.ws = ws

      ws.onopen = () => {
        console.log('[WebSocketManager] Connected successfully to:', wsUrl)
        connection.isConnected = true
        connection.error = null

        connection.subscribers.forEach((sub) => {
          sub.onConnectionChange?.(true)
        })
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          let messageType = data.type
          let payload = data.payload

          if (payload === undefined) {
            if (data.state) {
              payload = data
            } else {
              payload = data
            }
          }

          switch (messageType) {
            case 'INITIAL_STATE':
            case 'SCORE_UPDATE': {
              const updateState = (payload?.state || payload) as CricketState
              const updateScore = (payload?.score || (updateState && typeof updateState === 'object' && 'result' in updateState ? updateState.result : '')) as string
              if (updateState) {
                connection.state = updateState
                connection.score = updateScore || ''
                connection.subscribers.forEach((sub) => {
                  sub.onScoreUpdate?.(updateState, updateScore || '')
                })
              }
              break
            }

            case 'MATCH_STARTED': {
              const startState = (payload?.state || payload) as CricketState
              if (startState) {
                connection.state = startState
                connection.subscribers.forEach((sub) => {
                  sub.onMatchStarted?.(startState)
                })
              }
              break
            }

            case 'MATCH_ENDED': {
              const endState = (payload?.state || payload) as CricketState
              if (endState) {
                connection.state = endState
                const endScore = payload?.score || endState.result || ''
                connection.score = endScore
                connection.subscribers.forEach((sub) => {
                  sub.onMatchEnded?.(endState, endState.result || '')
                })
              }
              break
            }

            case 'MATCH_UPDATE': {
              const updateState = (payload?.state || payload) as CricketState
              const updateScore = payload?.score || (updateState?.result || '')
              const events = payload?.events || []
              const stats = payload?.stats

              if (updateState) {
                connection.state = updateState
                connection.score = updateScore || ''
                connection.subscribers.forEach((sub) => {
                  sub.onScoreUpdate?.(updateState, updateScore || '')
                })
              }
              if (events && Array.isArray(events) && events.length > 0) {
                connection.subscribers.forEach((sub) => {
                  sub.onEventsUpdate?.(events)
                })
              }
              if (stats) {
                connection.subscribers.forEach((sub) => {
                  sub.onStatsUpdate?.(stats)
                })
              }
              break
            }

            case 'EVENTS_LIST': {

              const events = Array.isArray(payload) ? payload : (payload?.events || [])
              if (events && Array.isArray(events)) {
                connection.subscribers.forEach((sub) => {
                  sub.onEventsUpdate?.(events)
                })
              }
              break
            }

            case 'ERROR':
              const errorMsg = payload?.message || payload || 'Unknown error'
              connection.error = errorMsg
              connection.subscribers.forEach((sub) => {
                sub.onError?.(errorMsg)
              })
              break
          }
        } catch (e) {
          console.error('[WebSocketManager] Error parsing message:', e, event.data)
        }
      }

      ws.onclose = (event) => {
        console.log('[WebSocketManager] Connection closed:', event.code, event.reason || 'No reason provided')
        connection.isConnected = false
        connection.ws = null

        connection.subscribers.forEach((sub) => {
          sub.onConnectionChange?.(false)
        })

        if (event.code !== 1000 && connection.subscribers.size > 0) {
          console.log('[WebSocketManager] Will attempt to reconnect in 3 seconds...')
          connection.reconnectTimeout = setTimeout(() => {
            if (connection.subscribers.size > 0) {

              this.createWebSocket(connection)
            }
          }, 3000)
        } else if (connection.subscribers.size === 0) {

          this.connections.delete(connection.matchId)
        }
      }

      ws.onerror = (event) => {
        console.error('[WebSocketManager] Error:', event)
        if (connection.isConnected) {
          connection.error = 'Connection error'
        } else {
          connection.error = 'Unable to connect to server. Make sure the backend is running on port 8080.'
        }
        connection.subscribers.forEach((sub) => {
          sub.onError?.(connection.error || 'Connection error')
        })
      }
    } catch (e) {
      console.error('[WebSocketManager] Error creating WebSocket:', e)
      connection.error = 'Failed to create WebSocket connection'
    }
  }

  private getOrCreateConnection(matchId: string): WebSocketConnection {
    let connection = this.connections.get(matchId)

    if (!connection) {
      connection = {
        ws: null,
        matchId,
        subscribers: new Map(),
        state: null,
        score: '',
        isConnected: false,
        error: null,
        reconnectTimeout: null,
        cleanupTimeout: null,
      }
      this.connections.set(matchId, connection)
      this.createWebSocket(connection)
    } else {

      if (connection.cleanupTimeout) {
        clearTimeout(connection.cleanupTimeout)
        connection.cleanupTimeout = null
        console.log('[WebSocketManager] Cancelled pending cleanup for:', matchId)
      }
    }

    return connection
  }

  subscribe(
    matchId: string | undefined,
    subscriber: Omit<WebSocketSubscriber, 'id'>
  ): {
    unsubscribe: () => void
    connection: WebSocketConnection | null
  } {
    if (!matchId) {
      return { unsubscribe: () => {}, connection: null }
    }

    const subscriberId = this.generateSubscriberId()
    const fullSubscriber: WebSocketSubscriber = { ...subscriber, id: subscriberId }

    const connection = this.getOrCreateConnection(matchId)
    connection.subscribers.set(subscriberId, fullSubscriber)

    console.log('[WebSocketManager] Subscriber added:', subscriberId, 'Total subscribers:', connection.subscribers.size)

    return {
      unsubscribe: () => {
        const conn = this.connections.get(matchId)
        if (conn) {
          conn.subscribers.delete(subscriberId)
          console.log('[WebSocketManager] Subscriber removed:', subscriberId, 'Remaining:', conn.subscribers.size)

          if (conn.subscribers.size === 0) {
            console.log('[WebSocketManager] No subscribers, scheduling cleanup in 500ms...')
            conn.cleanupTimeout = setTimeout(() => {

              if (conn.subscribers.size === 0) {
                console.log('[WebSocketManager] Cleaning up connection for:', matchId)
                if (conn.reconnectTimeout) {
                  clearTimeout(conn.reconnectTimeout)
                  conn.reconnectTimeout = null
                }
                if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
                  conn.ws.close(1000, 'No more subscribers')
                }
                this.connections.delete(matchId)
              }
            }, 500)
          }
        }
      },
      connection,
    }
  }

  sendEvent(matchId: string, eventType: string, eventData: Record<string, any>): boolean {
    const connection = this.connections.get(matchId)
    if (!connection) {
      console.error('[WebSocketManager] Cannot send event: No connection found for match', matchId)
      return false
    }

    if (!connection.ws) {
      console.error('[WebSocketManager] Cannot send event: WebSocket is null. isConnected:', connection.isConnected)

      if (connection.subscribers.size > 0 && !connection.reconnectTimeout) {
        console.log('[WebSocketManager] Attempting to reconnect...')
        this.createWebSocket(connection)
      }
      return false
    }

    const readyState = connection.ws.readyState
    if (readyState === WebSocket.CONNECTING) {
      console.warn('[WebSocketManager] WebSocket is still connecting. Queuing event...')

      setTimeout(() => {
        this.sendEvent(matchId, eventType, eventData)
      }, 100)
      return false
    }

    if (readyState !== WebSocket.OPEN) {
      console.error('[WebSocketManager] Cannot send event: WebSocket not open. State:', readyState)
      return false
    }

    const message = {
      type: 'RECORD_EVENT',
      event_type: eventType,
      event_data: eventData,
    }

    try {
      connection.ws.send(JSON.stringify(message))
      console.log('[WebSocketManager] Event sent successfully:', eventType)
      return true
    } catch (error) {
      console.error('[WebSocketManager] Error sending event:', error)
      return false
    }
  }

  reconnect(matchId: string): void {
    const connection = this.connections.get(matchId)
    if (connection) {
      if (connection.reconnectTimeout) {
        clearTimeout(connection.reconnectTimeout)
        connection.reconnectTimeout = null
      }
      if (connection.ws) {
        try {
          connection.ws.close(1000, 'Manual reconnect')
        } catch (e) {

        }
        connection.ws = null
      }

      this.createWebSocket(connection)
    }
  }
}

const manager = new MatchWebSocketManager()

export function useMatchWebSocket(
  matchId: string | undefined,
  options: UseMatchWebSocketOptions = {}
): UseMatchWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [state, setState] = useState<CricketState | null>(null)
  const [score, setScore] = useState('')
  const [error, setError] = useState<string | null>(null)
  const subscriberRef = useRef<{ unsubscribe: () => void } | null>(null)

  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    if (!matchId) {
      setIsConnected(false)
      setState(null)
      setScore('')
      setError(null)
      return
    }

    const { unsubscribe, connection } = manager.subscribe(matchId, {
      onScoreUpdate: (updateState, updateScore) => {
        setState(updateState)
        setScore(updateScore)
        optionsRef.current.onScoreUpdate?.(updateState, updateScore)
      },
      onMatchStarted: (startState) => {
        setState(startState)
        optionsRef.current.onMatchStarted?.(startState)
      },
      onMatchEnded: (endState, result) => {
        setState(endState)
        setScore(result)
        optionsRef.current.onMatchEnded?.(endState, result)
      },
      onStatsUpdate: (stats) => {
        optionsRef.current.onStatsUpdate?.(stats)
      },
      onEventsUpdate: (events) => {
        optionsRef.current.onEventsUpdate?.(events)
      },
      onError: (err) => {
        setError(err)
        optionsRef.current.onError?.(err)
      },
      onConnectionChange: (connected) => {
        setIsConnected(connected)
      },
    })

    subscriberRef.current = { unsubscribe }

    if (connection) {

      setIsConnected(connection.isConnected)
      setState(connection.state)
      setScore(connection.score)
      setError(connection.error)
    }

    return () => {
      unsubscribe()
    }
  }, [matchId])

  const reconnect = useCallback(() => {
    if (matchId) {
      manager.reconnect(matchId)
    }
  }, [matchId])

  const sendEvent = useCallback(
    (eventType: string, eventData: Record<string, any>) => {
      if (matchId) {
        const success = manager.sendEvent(matchId, eventType, eventData)
        if (!success) {
          setError('WebSocket not connected. Please wait for reconnection or refresh the page.')
        }
      }
    },
    [matchId]
  )

  return {
    isConnected,
    state,
    score,
    error,
    reconnect,
    sendEvent,
  }
}

interface UseMatchWebSocketOptions {
  onScoreUpdate?: (state: CricketState, score: string) => void
  onMatchStarted?: (state: CricketState) => void
  onMatchEnded?: (state: CricketState, result: string) => void
  onStatsUpdate?: (stats: any) => void
  onEventsUpdate?: (events: any[]) => void
  onError?: (error: string) => void
}

interface UseMatchWebSocketReturn {
  isConnected: boolean
  state: CricketState | null
  score: string
  error: string | null
  reconnect: () => void
  sendEvent: (eventType: string, eventData: Record<string, any>) => void
}
