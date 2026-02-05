import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Play, RefreshCw, Radio, Circle } from 'lucide-react'
import { matchesApi, CricketState, MatchEvent } from '../api/matches'
import { format } from 'date-fns'
import { useMatchWebSocket } from '../hooks/useMatchWebSocket'


function isValidCricketState(state: unknown): state is CricketState {
  return !!state && typeof state === 'object' && 'sport_type' in state && (state as CricketState).sport_type === 'CRICKET'
}

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: match, isLoading, refetch: refetchMatch } = useQuery({
    queryKey: ['match', id],
    queryFn: () => matchesApi.getById(id!).then(res => res.data),
    enabled: !!id,
  })

  
  const { data: events = [], refetch: refetchEvents } = useQuery({
    queryKey: ['matchEvents', id],
    queryFn: () => matchesApi.getEvents(id!).then(res => res.data),
    enabled: !!id && match?.status !== 'SCHEDULED',
    refetchInterval: match?.status === 'LIVE' ? 5000 : false,
  })

  
  const { isConnected, state: wsState, score: wsScore } = useMatchWebSocket(
    match?.status === 'LIVE' ? id : undefined,
    {
      onScoreUpdate: () => {
        refetchEvents()
      }
    }
  )

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!match) {
    return <div className="text-center py-12">Match not found</div>
  }

  const rawState = wsState || match.score_summary
  const displayState = isValidCricketState(rawState) ? rawState : undefined
  const displayScore = wsScore || formatCricketScore(displayState)

  return (
    <div className="space-y-6">
      <Link to="/matches" className="inline-flex items-center text-primary-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Matches
      </Link>

      <div className="card">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">
                {match.team_a_short_code} vs {match.team_b_short_code}
              </h1>
              {match.status === 'LIVE' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse"></span>
                  LIVE
                </span>
              )}
              {match.status === 'SCHEDULED' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  SCHEDULED
                </span>
              )}
              {match.status === 'COMPLETED' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  COMPLETED
                </span>
              )}
            </div>
            <p className="text-gray-600">
              {match.team_a_name} vs {match.team_b_name}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {format(new Date(match.start_time), 'dd/MM/yyyy')} at {format(new Date(match.start_time), 'HH:mm')}
            </p>
            <p className="text-sm text-gray-500">
              Tournament: {match.tournament_name}
            </p>
          </div>
          <div className="flex space-x-3">
            <Link
              to={`/matches/${match.id}/scoring`}
              className="btn btn-primary flex items-center"
            >
              <Play className="h-4 w-4 mr-2" />
              {match.status === 'LIVE' ? 'Live Scoring' : 'Score Match'}
            </Link>
            {match.status === 'LIVE' && (
              <button
                onClick={() => { refetchMatch(); refetchEvents(); }}
                className="btn btn-secondary flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            )}
          </div>
        </div>

        {/* Live Score Display */}
        {match.status === 'LIVE' && displayState && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Radio className={`h-4 w-4 ${isConnected ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected to live updates' : 'Connecting...'}
              </span>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900 mb-2">
                {displayScore || '0/0 (0.0)'}
              </div>
              <div className="text-lg text-gray-600 mb-2">
                Innings {displayState.innings} • Over {displayState.current_over}.{displayState.balls_in_over}
              </div>
              {displayState.innings === 2 && displayState.target && (
                <div className="text-primary-600 font-medium">
                  Target: {displayState.target} | Need {displayState.target - displayState.team_b_runs} runs
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scheduled Match Info */}
        {match.status === 'SCHEDULED' && (
          <div className="bg-yellow-50 rounded-lg p-6 mb-6 text-center">
            <p className="text-yellow-800 font-medium">Match not started yet</p>
            <p className="text-sm text-yellow-600 mt-1">
              Click "Score Match" to start the match and begin scoring
            </p>
          </div>
        )}

        {/* Completed Match Result */}
        {match.status === 'COMPLETED' && displayState && (
          <div className="bg-primary-50 rounded-lg p-6 mb-6 text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">
              {displayScore}
            </div>
            {displayState.result && (
              <p className="text-lg text-primary-700 font-medium">{displayState.result}</p>
            )}
          </div>
        )}

        {/* Match Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Team A</p>
            <p className="text-lg font-semibold text-gray-900">{match.team_a_name}</p>
            {displayState && (
              <p className="text-2xl font-bold text-primary-600">
                {displayState.team_a_runs}/{displayState.team_a_wickets}
              </p>
            )}
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Team B</p>
            <p className="text-lg font-semibold text-gray-900">{match.team_b_name}</p>
            {displayState && displayState.innings >= 2 && (
              <p className="text-2xl font-bold text-primary-600">
                {displayState.team_b_runs}/{displayState.team_b_wickets}
              </p>
            )}
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-lg font-semibold text-gray-900">{match.status}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Format</p>
            <p className="text-lg font-semibold text-gray-900">
              {displayState?.total_overs || 20} Overs
            </p>
          </div>
        </div>
      </div>

      {/* Ball-by-Ball Events */}
      {events.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Ball-by-Ball Commentary</h2>
          <BallByBallTimeline events={events} />
        </div>
      )}
    </div>
  )
}


function BallByBallTimeline({ events }: { events: MatchEvent[] }) {
  
  const eventsWithTotals = calculateRunningTotals(events)

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider pb-2 border-b">
        <div className="col-span-1">#</div>
        <div className="col-span-2">Event</div>
        <div className="col-span-2">Runs</div>
        <div className="col-span-3">Score</div>
        <div className="col-span-4">Time</div>
      </div>

      {/* Events - show most recent first */}
      <div className="max-h-96 overflow-y-auto space-y-1">
        {[...eventsWithTotals].reverse().map((event, index) => (
          <EventRow 
            key={event.id} 
            event={event} 
            ballNumber={eventsWithTotals.length - index}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="pt-3 border-t mt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Events: {events.length}</span>
          <span className="font-medium text-gray-900">
            Final: {eventsWithTotals[eventsWithTotals.length - 1]?.runningTotal ?? 0}/
            {eventsWithTotals[eventsWithTotals.length - 1]?.runningWickets ?? 0}
          </span>
        </div>
      </div>
    </div>
  )
}

interface EventWithTotal extends MatchEvent {
  runningTotal: number
  runningWickets: number
  runsScored: number
}

function calculateRunningTotals(events: MatchEvent[]): EventWithTotal[] {
  let runningTotal = 0
  let runningWickets = 0

  return events.map(event => {
    let runsScored = 0

    switch (event.event_type) {
      case 'BALL_BOWLED':
        runsScored = (event.event_data?.runs as number) || 0
        runningTotal += runsScored
        break
      case 'WICKET':
        runningWickets++
        break
      case 'WIDE':
      case 'NO_BALL':
        runsScored = 1
        runningTotal += 1
        break
    }

    return {
      ...event,
      runningTotal,
      runningWickets,
      runsScored,
    }
  })
}

function EventRow({ event, ballNumber }: { event: EventWithTotal; ballNumber: number }) {
  const getEventStyle = () => {
    switch (event.event_type) {
      case 'WICKET':
        return { bg: 'bg-red-50', text: 'text-red-700', icon: '🏏', label: 'WICKET' }
      case 'WIDE':
        return { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: '↔️', label: 'WIDE' }
      case 'NO_BALL':
        return { bg: 'bg-orange-50', text: 'text-orange-700', icon: '⚠️', label: 'NO BALL' }
      case 'BALL_BOWLED':
        if (event.runsScored === 6) return { bg: 'bg-green-50', text: 'text-green-700', icon: '6️⃣', label: 'SIX!' }
        if (event.runsScored === 4) return { bg: 'bg-blue-50', text: 'text-blue-700', icon: '4️⃣', label: 'FOUR!' }
        if (event.runsScored === 0) return { bg: 'bg-gray-50', text: 'text-gray-600', icon: '⚫', label: 'DOT' }
        return { bg: 'bg-gray-50', text: 'text-gray-700', icon: '🏃', label: `${event.runsScored} RUN${event.runsScored > 1 ? 'S' : ''}` }
      default:
        return { bg: 'bg-gray-50', text: 'text-gray-600', icon: '•', label: event.event_type }
    }
  }

  const style = getEventStyle()

  return (
    <div className={`grid grid-cols-12 gap-2 py-2 px-2 rounded ${style.bg} items-center`}>
      <div className="col-span-1 text-xs text-gray-400 font-mono">
        {ballNumber}
      </div>
      <div className={`col-span-2 text-sm font-medium ${style.text}`}>
        <span className="mr-1">{style.icon}</span>
        <span className="hidden sm:inline">{style.label}</span>
      </div>
      <div className="col-span-2 text-sm font-bold">
        {event.event_type === 'WICKET' ? 'W' : `+${event.runsScored}`}
      </div>
      <div className="col-span-3 text-sm font-semibold text-gray-900">
        {event.runningTotal}/{event.runningWickets}
      </div>
      <div className="col-span-4 text-xs text-gray-500">
        {format(new Date(event.created_at), 'HH:mm:ss')}
      </div>
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
