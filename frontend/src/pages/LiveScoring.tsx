import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Wifi, WifiOff, Play, Square } from 'lucide-react'
import { matchesApi, RecordEventRequest, CricketState, MatchEvent } from '../api/matches'
import { useMatchWebSocket } from '../hooks/useMatchWebSocket'
import { useState } from 'react'


function isValidCricketState(state: unknown): state is CricketState {
  return !!state && typeof state === 'object' && 'sport_type' in state && (state as CricketState).sport_type === 'CRICKET'
}

export default function LiveScoring() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  
  const { data: match } = useQuery({
    queryKey: ['match', id],
    queryFn: () => matchesApi.getById(id!).then(res => res.data),
    enabled: !!id,
  })

  
  const { data: eventsData, refetch: refetchEvents } = useQuery({
    queryKey: ['matchEvents', id],
    queryFn: () => matchesApi.getEvents(id!).then(res => res.data),
    enabled: !!id && match?.status !== 'SCHEDULED',
  })
  
  const events = eventsData || []

  
  const { isConnected, state: wsState, score: wsScore, error: wsError, reconnect } = useMatchWebSocket(id, {
    onScoreUpdate: (_state, score) => {
      console.log('Score updated:', score)
      queryClient.invalidateQueries({ queryKey: ['match', id] })
      refetchEvents()
    },
    onMatchEnded: (_state, result) => {
      console.log('Match ended:', result)
      queryClient.invalidateQueries({ queryKey: ['match', id] })
      refetchEvents()
    },
  })

  
  const startMatchMutation = useMutation({
    mutationFn: () => matchesApi.start(id!).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] })
      reconnect() 
    },
  })

  
  const endMatchMutation = useMutation({
    mutationFn: () => matchesApi.end(id!).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] })
    },
  })

  
  const recordEventMutation = useMutation({
    mutationFn: (data: RecordEventRequest) => matchesApi.recordEvent(id!, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', id] })
      refetchEvents()
    },
  })

  const handleEvent = (eventType: string, eventData: Record<string, any>) => {
    recordEventMutation.mutate({ event_type: eventType, event_data: eventData })
  }

  if (!match) {
    return <div className="text-center py-12">Loading match...</div>
  }

  const isLive = match.status === 'LIVE'
  const isScheduled = match.status === 'SCHEDULED'
  const isCompleted = match.status === 'COMPLETED'

  
  const rawState = wsState || match.score_summary
  const displayState = isValidCricketState(rawState) ? rawState : undefined
  const displayScore = wsScore || displayState?.result || formatCricketScore(displayState)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/matches/${id}`)}
          className="inline-flex items-center text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Match
        </button>
        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className={`flex items-center gap-1 text-sm ${isConnected ? 'text-green-600' : 'text-gray-400'}`}>
            {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {isConnected ? 'Live' : 'Connecting...'}
          </div>
          <span className="text-sm text-gray-500">
            {match.team_a_short_code} vs {match.team_b_short_code}
          </span>
        </div>
      </div>

      {/* Match Status Banner */}
      <div className="card">
        <div className="text-center">
          {isLive && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 mb-4">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
              LIVE
            </span>
          )}
          {isScheduled && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 mb-4">
              SCHEDULED
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 mb-4">
              COMPLETED
            </span>
          )}

          {/* Score Display */}
          <div className="mb-6">
            <div className="text-5xl font-bold text-gray-900 mb-2">
              {displayScore || '0/0 (0.0)'}
            </div>
            <div className="text-lg text-gray-600">
              {match.team_a_name} vs {match.team_b_name}
            </div>
            {displayState?.innings === 2 && displayState?.target && (
              <div className="text-md text-primary-600 mt-2">
                Target: {displayState.target} runs
              </div>
            )}
          </div>

          {/* Match Controls */}
          <div className="flex justify-center gap-4 mb-6">
            {isScheduled && (
              <button
                onClick={() => startMatchMutation.mutate()}
                disabled={startMatchMutation.isPending}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                {startMatchMutation.isPending ? 'Starting...' : 'Start Match'}
              </button>
            )}
            {isLive && (
              <button
                onClick={() => endMatchMutation.mutate()}
                disabled={endMatchMutation.isPending}
                className="btn btn-danger inline-flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                {endMatchMutation.isPending ? 'Ending...' : 'End Match'}
              </button>
            )}
          </div>

          {/* Current Match Details */}
          {displayState && isLive && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center border-t pt-4">
              <div>
                <div className="text-2xl font-bold text-gray-900">{displayState.innings}</div>
                <div className="text-sm text-gray-500">Innings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {displayState.current_over}.{displayState.balls_in_over}
                </div>
                <div className="text-sm text-gray-500">Overs</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {displayState.innings === 1 ? displayState.team_a_wickets : displayState.team_b_wickets}
                </div>
                <div className="text-sm text-gray-500">Wickets</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {displayState.total_overs}
                </div>
                <div className="text-sm text-gray-500">Total Overs</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scoring Panel - Only show when live */}
      {isLive && (
        <div className="card">
          <CricketScoringPanel 
            onEvent={handleEvent} 
            isLoading={recordEventMutation.isPending}
            state={displayState}
          />
        </div>
      )}

      {/* Recent Events - This Over */}
      {(isLive || isCompleted) && events && events.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Recent Balls</h3>
          <RecentBalls events={events} />
        </div>
      )}

      {/* Completed Match Result */}
      {isCompleted && displayState?.result && (
        <div className="card bg-primary-50 border-primary-200">
          <div className="text-center">
            <h3 className="text-xl font-bold text-primary-900 mb-2">Match Result</h3>
            <p className="text-lg text-primary-700">{displayState.result}</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {(wsError || recordEventMutation.error) && (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-700">
            {wsError || (recordEventMutation.error as Error)?.message || 'An error occurred'}
          </p>
        </div>
      )}
    </div>
  )
}


function formatCricketScore(state?: CricketState): string {
  if (!state || !state.sport_type) return ''
  if (state.innings === 1) {
    return `${state.team_a_runs ?? 0}/${state.team_a_wickets ?? 0} (${(state.team_a_overs ?? 0).toFixed(1)})`
  }
  return `${state.team_b_runs ?? 0}/${state.team_b_wickets ?? 0} (${(state.team_b_overs ?? 0).toFixed(1)})`
}


interface CricketScoringPanelProps {
  onEvent: (type: string, data: Record<string, any>) => void
  isLoading: boolean
  state?: CricketState | null
}

function CricketScoringPanel({ onEvent, isLoading, state }: CricketScoringPanelProps) {
  const [selectedRuns, setSelectedRuns] = useState<number | null>(null)

  const handleRunsClick = (runs: number) => {
    onEvent('BALL_BOWLED', { runs })
    setSelectedRuns(runs)
    setTimeout(() => setSelectedRuns(null), 200)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Cricket Scoring</h3>
        {state && (
          <div className="text-sm text-gray-500">
            Over {state.current_over}.{state.balls_in_over} / {state.total_overs}
          </div>
        )}
      </div>

      {/* Runs Buttons */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Runs</h4>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[0, 1, 2, 3, 4, 6].map(runs => (
            <button
              key={runs}
              onClick={() => handleRunsClick(runs)}
              disabled={isLoading}
              className={`btn ${selectedRuns === runs ? 'btn-secondary' : 'btn-primary'} text-xl py-6 font-bold transition-all ${
                runs === 4 ? 'bg-blue-600 hover:bg-blue-700' :
                runs === 6 ? 'bg-green-600 hover:bg-green-700' :
                ''
              }`}
            >
              {runs}
            </button>
          ))}
        </div>
      </div>

      {/* Special Events */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Special Events</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onEvent('WICKET', {})}
            disabled={isLoading}
            className="btn btn-danger py-4 font-bold"
          >
            🏏 Wicket
          </button>
          <button
            onClick={() => onEvent('WIDE', {})}
            disabled={isLoading}
            className="btn btn-secondary py-4"
          >
            Wide (+1)
          </button>
          <button
            onClick={() => onEvent('NO_BALL', {})}
            disabled={isLoading}
            className="btn btn-secondary py-4"
          >
            No Ball (+1)
          </button>
          <button
            onClick={() => onEvent('INNINGS_END', {})}
            disabled={isLoading || (state?.innings === 2)}
            className="btn btn-outline py-4"
          >
            End Innings
          </button>
        </div>
      </div>

      {/* Quick Reference */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <h4 className="font-medium text-gray-900 mb-2">Quick Reference</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Tap a number to record runs (0-6)</li>
          <li>Wide and No Ball add 1 run but don't count as a legal delivery</li>
          <li>Wicket records a dismissal and counts as a legal delivery</li>
          <li>Over automatically advances after 6 legal deliveries</li>
        </ul>
      </div>
    </div>
  )
}


function RecentBalls({ events }: { events: MatchEvent[] }) {
  
  const recentEvents = events.slice(-12).reverse()
  
  
  let totalRuns = 0
  let totalWickets = 0
  events.forEach(e => {
    if (e.event_type === 'BALL_BOWLED') totalRuns += (e.event_data?.runs as number) || 0
    if (e.event_type === 'WICKET') totalWickets++
    if (e.event_type === 'WIDE' || e.event_type === 'NO_BALL') totalRuns++
  })

  return (
    <div className="space-y-3">
      {/* Ball indicators */}
      <div className="flex flex-wrap gap-2">
        {recentEvents.map((event) => (
          <BallIndicator key={event.id} event={event} />
        ))}
      </div>
      
      {/* Summary */}
      <div className="flex justify-between items-center pt-2 border-t text-sm">
        <span className="text-gray-500">
          Total: {events.length} balls
        </span>
        <span className="font-bold text-gray-900">
          {totalRuns}/{totalWickets}
        </span>
      </div>
    </div>
  )
}

function BallIndicator({ event }: { event: MatchEvent }) {
  const getStyle = () => {
    switch (event.event_type) {
      case 'WICKET':
        return { bg: 'bg-red-500', text: 'text-white', label: 'W' }
      case 'WIDE':
        return { bg: 'bg-yellow-400', text: 'text-yellow-900', label: 'Wd' }
      case 'NO_BALL':
        return { bg: 'bg-orange-400', text: 'text-orange-900', label: 'Nb' }
      case 'BALL_BOWLED': {
        const runs = (event.event_data?.runs as number) || 0
        if (runs === 6) return { bg: 'bg-green-500', text: 'text-white', label: '6' }
        if (runs === 4) return { bg: 'bg-blue-500', text: 'text-white', label: '4' }
        if (runs === 0) return { bg: 'bg-gray-300', text: 'text-gray-700', label: '•' }
        return { bg: 'bg-gray-100', text: 'text-gray-900', label: String(runs) }
      }
      default:
        return { bg: 'bg-gray-200', text: 'text-gray-600', label: '?' }
    }
  }

  const style = getStyle()

  return (
    <div 
      className={`w-10 h-10 rounded-full ${style.bg} ${style.text} flex items-center justify-center font-bold text-sm shadow-sm`}
      title={`${event.event_type}${event.event_data?.runs !== undefined ? `: ${event.event_data.runs} runs` : ''}`}
    >
      {style.label}
    </div>
  )
}
