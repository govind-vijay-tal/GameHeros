import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Wifi, WifiOff, Play, Square, BarChart3 } from 'lucide-react'
import { matchesApi, CricketState, MatchEvent, MatchStats } from '../api/matches'
import { tournamentsApi } from '../api/tournaments'
import { playersApi, Player } from '../api/players'
import { useMatchWebSocket } from '../hooks/useMatchWebSocketManager'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'

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

  const [events, setEvents] = useState<MatchEvent[]>([])

  const { data: initialEvents } = useQuery({
    queryKey: ['matchEvents', id],
    queryFn: () => matchesApi.getEvents(id!).then(res => res.data),
    enabled: !!id && (match?.status === 'LIVE' || match?.status === 'COMPLETED'),
    refetchInterval: false,
  })

  useEffect(() => {
    if (initialEvents && Array.isArray(initialEvents)) {
      setEvents(initialEvents)
    }
  }, [initialEvents])

  const { data: stats } = useQuery({
    queryKey: ['matchStats', id],
    queryFn: () => matchesApi.getStats(id!).then(res => res.data),
    enabled: !!id && (match?.status === 'COMPLETED' || match?.status === 'LIVE'),
    refetchInterval: false,
  })

  const { data: teamAPlayers } = useQuery({
    queryKey: ['teamPlayers', match?.tournament_id, match?.team_a_id],
    queryFn: () => tournamentsApi.getTeamPlayers(match!.tournament_id, match!.team_a_id).then(res => res.data),
    enabled: !!match?.tournament_id && !!match?.team_a_id,
  })

  const { data: teamBPlayers } = useQuery({
    queryKey: ['teamPlayers', match?.tournament_id, match?.team_b_id],
    queryFn: () => tournamentsApi.getTeamPlayers(match!.tournament_id, match!.team_b_id).then(res => res.data),
    enabled: !!match?.tournament_id && !!match?.team_b_id,
  })

  const [currentBatter, setCurrentBatter] = useState<string>('')
  const [currentBowler, setCurrentBowler] = useState<string>('')

  const { isConnected, state: wsState, score: wsScore, error: wsError, reconnect, sendEvent } = useMatchWebSocket(id, {
    onScoreUpdate: (_state) => {

    },
    onMatchEnded: (_state) => {

      queryClient.invalidateQueries({ queryKey: ['match', id] })
    },
    onStatsUpdate: (statsData) => {

      queryClient.setQueryData(['matchStats', id], {
        id: stats?.id || '',
        match_id: id,
        stats: statsData,
        created_at: stats?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    },
    onEventsUpdate: (eventsData) => {
      setEvents(eventsData || [])
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

  const handleEvent = (eventType: string, eventData: Record<string, any>) => {

    const eventDataWithPlayers = {
      ...eventData,
      ...(currentBatter && { batter_id: currentBatter }),
      ...(currentBowler && { bowler_id: currentBowler }),
    }
    sendEvent(eventType, eventDataWithPlayers)
  }

  const rawState = wsState || match?.score_summary
  const displayState = isValidCricketState(rawState) ? rawState : undefined
  const displayScore = wsScore || displayState?.result || formatCricketScore(displayState)

  useEffect(() => {
    if (!displayState || !match) return

    const battingTeamPlayers = displayState.innings === 1 ? teamAPlayers : teamBPlayers
    const bowlingTeamPlayers = displayState.innings === 1 ? teamBPlayers : teamAPlayers

    if (battingTeamPlayers && battingTeamPlayers.length > 0 && !currentBatter) {
      setCurrentBatter(battingTeamPlayers[0].id)
    }
    if (bowlingTeamPlayers && bowlingTeamPlayers.length > 0 && !currentBowler) {
      setCurrentBowler(bowlingTeamPlayers[0].id)
    }
  }, [teamAPlayers, teamBPlayers, displayState?.innings, currentBatter, currentBowler, displayState, match])

  if (!match) {
    return <div className="text-center py-12">Loading match...</div>
  }

  const isLive = match.status === 'LIVE'
  const isScheduled = match.status === 'SCHEDULED'
  const isCompleted = match.status === 'COMPLETED'

  const battingTeamPlayers = displayState?.innings === 1 ? teamAPlayers : teamBPlayers
  const bowlingTeamPlayers = displayState?.innings === 1 ? teamBPlayers : teamAPlayers

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="btn btn-outline flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-2 text-green-600">
              <Wifi className="h-4 w-4" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-2 text-red-600">
              <WifiOff className="h-4 w-4" />
              Disconnected
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{match.tournament_name}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {match.team_a_name} vs {match.team_b_name}
            </p>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isLive ? 'bg-red-100 text-red-800' :
              isCompleted ? 'bg-gray-100 text-gray-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {match.status}
            </span>
          </div>
        </div>

        {displayScore && (
          <div className="text-center py-4 border-t border-b">
            <div className="text-3xl font-bold text-gray-900">{displayScore}</div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          {isScheduled && (
            <button
              onClick={() => startMatchMutation.mutate()}
              disabled={startMatchMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Start Match
            </button>
          )}
          {isLive && (
            <button
              onClick={() => endMatchMutation.mutate()}
              disabled={endMatchMutation.isPending}
              className="btn btn-danger flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              End Match
            </button>
          )}
        </div>
      </div>

      {isLive && (
        <>
          <div className="card p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Select Players</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batter (Batting Team)
                </label>
                <select
                  value={currentBatter}
                  onChange={(e) => setCurrentBatter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Batter</option>
                  {battingTeamPlayers?.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} {player.role && `(${player.role})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bowler (Bowling Team)
                </label>
                <select
                  value={currentBowler}
                  onChange={(e) => setCurrentBowler(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Bowler</option>
                  {bowlingTeamPlayers?.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} {player.role && `(${player.role})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(!currentBatter || !currentBowler) && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  ⚠️ Please select both batter and bowler to track player stats for Man of the Match calculation.
                </p>
              </div>
            )}
          </div>

          <div className="card">
            <CricketScoringPanel
              onEvent={handleEvent}
              isLoading={!isConnected}
              state={displayState}
              currentBatter={currentBatter}
              currentBowler={currentBowler}
            />
          </div>
        </>
      )}

      {(isLive || isCompleted) && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Ball-by-Ball Commentary</h2>
          {events && events.length > 0 ? (
            <BallByBallTimeline
              events={events}
              teamAPlayers={teamAPlayers}
              teamBPlayers={teamBPlayers}
            />
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No events yet. Start recording events to see ball-by-ball commentary.</p>
            </div>
          )}
        </div>
      )}

      {(isLive || isCompleted) && stats && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-bold text-gray-900">
              {isLive ? 'Live Statistics' : 'Match Statistics'}
            </h2>
            {isLive && (
              <span className="ml-auto text-xs text-gray-500">Updating live...</span>
            )}
          </div>
          <MatchStatsDisplay
            stats={stats.stats}
            teamAName={match.team_a_name || ''}
            teamBName={match.team_b_name || ''}
            matchStatus={match.status}
          />
        </div>
      )}

      {wsError && (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-800">
            {wsError}
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

interface BallByBallTimelineProps {
  events: MatchEvent[]
  teamAPlayers?: Player[]
  teamBPlayers?: Player[]
  currentInnings?: number
}

function BallByBallTimeline({ events, teamAPlayers, teamBPlayers, currentInnings }: BallByBallTimelineProps) {

  const innings1Events = events.filter(e => {
    const innings = e.event_data?.innings
    return innings === 1 || innings === undefined
  })
  const innings2Events = events.filter(e => e.event_data?.innings === 2)

  const innings1WithTotals = calculateRunningTotals(innings1Events)
  const innings2WithTotals = calculateRunningTotals(innings2Events)

  const playersMap = new Map<string, string>()
  if (teamAPlayers && Array.isArray(teamAPlayers)) {
    teamAPlayers.forEach((player: Player) => {
      if (player?.id && player?.name) {
        playersMap.set(String(player.id), player.name)
      }
    })
  }
  if (teamBPlayers && Array.isArray(teamBPlayers)) {
    teamBPlayers.forEach((player: Player) => {
      if (player?.id && player?.name) {
        playersMap.set(String(player.id), player.name)
      }
    })
  }

  return (
    <div className="space-y-4">

      {innings1Events.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-bold text-gray-700">1st Innings</h3>
            {innings1WithTotals.length > 0 && (
              <span className="text-xs text-gray-500">
                ({innings1WithTotals[innings1WithTotals.length - 1]?.runningTotal ?? 0}/
                {innings1WithTotals[innings1WithTotals.length - 1]?.runningWickets ?? 0})
              </span>
            )}
          </div>
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider pb-2 border-b">
            <div className="col-span-1">Over</div>
            <div className="col-span-1">#</div>
            <div className="col-span-2">Event</div>
            <div className="col-span-2">Runs</div>
            <div className="col-span-2">Score</div>
            <div className="col-span-2">Players</div>
            <div className="col-span-2">Time</div>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {[...innings1WithTotals].reverse().map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                ballNumber={innings1WithTotals.length - index}
                playersMap={playersMap}
              />
            ))}
          </div>
        </div>
      )}

      {innings2Events.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h3 className="text-sm font-bold text-gray-700">2nd Innings</h3>
            {innings2WithTotals.length > 0 && (
              <span className="text-xs text-gray-500">
                ({innings2WithTotals[innings2WithTotals.length - 1]?.runningTotal ?? 0}/
                {innings2WithTotals[innings2WithTotals.length - 1]?.runningWickets ?? 0})
              </span>
            )}
          </div>
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider pb-2 border-b">
            <div className="col-span-1">Over</div>
            <div className="col-span-1">#</div>
            <div className="col-span-2">Event</div>
            <div className="col-span-2">Runs</div>
            <div className="col-span-2">Score</div>
            <div className="col-span-2">Players</div>
            <div className="col-span-2">Time</div>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {[...innings2WithTotals].reverse().map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                ballNumber={innings2WithTotals.length - index}
                playersMap={playersMap}
              />
            ))}
          </div>
        </div>
      )}

      <div className="pt-3 border-t mt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Events: {events.length}</span>
          {innings1WithTotals.length > 0 && innings2WithTotals.length > 0 && (
            <span className="font-medium text-gray-900">
              Innings 1: {innings1WithTotals[innings1WithTotals.length - 1]?.runningTotal ?? 0}/
              {innings1WithTotals[innings1WithTotals.length - 1]?.runningWickets ?? 0} |
              Innings 2: {innings2WithTotals[innings2WithTotals.length - 1]?.runningTotal ?? 0}/
              {innings2WithTotals[innings2WithTotals.length - 1]?.runningWickets ?? 0}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface EventWithTotal extends MatchEvent {
  runningTotal: number
  runningWickets: number
  runsScored: number
  over: number
  ball: number
  ballInOver: number
}

function calculateRunningTotals(events: MatchEvent[]): EventWithTotal[] {
  let runningTotal = 0
  let runningWickets = 0
  let validBalls = 0

  return events.map(event => {
    let runsScored = 0
    let isValidBall = false

    switch (event.event_type) {
      case 'BALL_BOWLED':
        runsScored = (event.event_data?.runs as number) || 0
        runningTotal += runsScored
        validBalls++
        isValidBall = true
        break
      case 'WICKET':
        runningWickets++
        validBalls++
        isValidBall = true
        break
      case 'WIDE':
      case 'NO_BALL':
        runsScored = 1
        runningTotal += 1

        break
    }

    const over = Math.floor((validBalls - 1) / 6) + 1
    const ballInOver = ((validBalls - 1) % 6) + 1
    const ball = validBalls

    return {
      ...event,
      runningTotal,
      runningWickets,
      runsScored,
      over,
      ball,
      ballInOver: isValidBall ? ballInOver : 0,
    }
  })
}

function EventRow({ event, ballNumber, playersMap }: { event: EventWithTotal; ballNumber: number; playersMap: Map<string, string> }) {

  const getOverDisplay = () => {
    if (event.ballInOver === 0) {

      return event.event_type === 'WIDE' ? 'Wide' : 'No Ball'
    }
    return `${event.over}.${event.ballInOver}`
  }

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

  const batterId = event.event_data?.batter_id ? String(event.event_data.batter_id) : undefined
  const bowlerId = event.event_data?.bowler_id ? String(event.event_data.bowler_id) : undefined

  const batterName = batterId ? playersMap.get(batterId) : null
  const bowlerName = bowlerId ? playersMap.get(bowlerId) : null

  return (
    <div className={`grid grid-cols-12 gap-2 py-2 px-2 rounded ${style.bg} items-center`}>
      <div className="col-span-1 text-xs font-medium text-gray-700">
        {getOverDisplay()}
      </div>
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
      <div className="col-span-2 text-sm font-semibold text-gray-900">
        {event.runningTotal}/{event.runningWickets}
      </div>
              <div className="col-span-2 text-xs text-gray-600">
        {batterName && bowlerName ? (
          <span>{batterName} <span className="text-gray-400">v</span> {bowlerName}</span>
        ) : batterName ? (
          <span>Bat: {batterName}</span>
        ) : bowlerName ? (
          <span>Bowl: {bowlerName}</span>
        ) : batterId || bowlerId ? (
          <span className="text-gray-400">Loading...</span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </div>
      <div className="col-span-2 text-xs text-gray-500">
        {format(new Date(event.created_at), 'HH:mm:ss')}
      </div>
    </div>
  )
}

function RecentBalls({ events }: { events: MatchEvent[] }) {
  const recentEvents = events.slice(-10).reverse()

  const getEventDisplay = (event: MatchEvent) => {
    const runs = event.event_data?.runs as number | undefined

    switch (event.event_type) {
      case 'BALL_BOWLED':
        if (runs === 0) {
          return { icon: '•', label: 'Dot', color: 'text-gray-400', bg: 'bg-gray-50', runs: '0' }
        } else if (runs === 4) {
          return { icon: '4', label: 'FOUR', color: 'text-blue-600', bg: 'bg-blue-50', runs: '4' }
        } else if (runs === 6) {
          return { icon: '6', label: 'SIX', color: 'text-green-600', bg: 'bg-green-50', runs: '6' }
        } else {
          return { icon: '•', label: `${runs} run${runs !== 1 ? 's' : ''}`, color: 'text-gray-700', bg: 'bg-gray-50', runs: String(runs) }
        }
      case 'WICKET':
        return { icon: 'W', label: 'Wicket', color: 'text-red-600', bg: 'bg-red-50', runs: 'W' }
      case 'WIDE':
        return { icon: 'Wd', label: 'Wide', color: 'text-yellow-600', bg: 'bg-yellow-50', runs: '1wd' }
      case 'NO_BALL':
        return { icon: 'Nb', label: 'No Ball', color: 'text-orange-600', bg: 'bg-orange-50', runs: '1nb' }
      default:
        return { icon: '•', label: event.event_type, color: 'text-gray-600', bg: 'bg-gray-50', runs: '' }
    }
  }

  const calculateRunningScore = (allEvents: MatchEvent[], currentIndex: number) => {

    const originalIndex = allEvents.length - 1 - currentIndex
    let total = 0
    let wickets = 0

    for (let i = 0; i <= originalIndex; i++) {
      const event = allEvents[i]
      if (event.event_type === 'BALL_BOWLED') {
        total += (event.event_data?.runs as number) || 0
      } else if (event.event_type === 'WICKET') {
        wickets++
      } else if (event.event_type === 'WIDE' || event.event_type === 'NO_BALL') {
        total += 1
      }
    }
    return { total, wickets }
  }

  if (recentEvents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-sm">No events yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {recentEvents.map((event, index) => {
        const display = getEventDisplay(event)
        const runningScore = calculateRunningScore(events, index)

        return (
          <div
            key={event.id}
            className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${display.bg}`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full ${display.bg} border-2 border-current flex items-center justify-center ${display.color} font-bold text-xs`}>
                {display.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${display.color} truncate`}>
                  {display.label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <span className={`text-sm font-bold ${display.color}`}>
                  {display.runs}
                </span>
              </div>
              <div className="text-right min-w-[60px]">
                <span className="text-xs text-gray-500">
                  {runningScore.total}/{runningScore.wickets}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface CricketScoringPanelProps {
  onEvent: (type: string, data: Record<string, any>) => void
  isLoading: boolean
  state?: CricketState | null
  currentBatter?: string
  currentBowler?: string
}

function CricketScoringPanel({ onEvent, isLoading, state, currentBatter, currentBowler }: CricketScoringPanelProps) {
  const [selectedRuns, setSelectedRuns] = useState<number | null>(null)

  const handleRunsClick = (runs: number) => {
    const eventData: Record<string, any> = { runs }
    if (currentBatter) eventData.batter_id = currentBatter
    if (currentBowler) eventData.bowler_id = currentBowler
    onEvent('BALL_BOWLED', eventData)
    setSelectedRuns(runs)
    setTimeout(() => setSelectedRuns(null), 200)
  }

  const handleWicket = () => {
    const eventData: Record<string, any> = {}
    if (currentBatter) eventData.batter_id = currentBatter
    if (currentBowler) eventData.bowler_id = currentBowler
    onEvent('WICKET', eventData)
  }

  const handleWide = () => {
    const eventData: Record<string, any> = {}
    if (currentBowler) eventData.bowler_id = currentBowler
    onEvent('WIDE', eventData)
  }

  const handleNoBall = () => {
    const eventData: Record<string, any> = {}
    if (currentBowler) eventData.bowler_id = currentBowler
    onEvent('NO_BALL', eventData)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3, 4, 6].map((runs) => (
          <button
            key={runs}
            onClick={() => handleRunsClick(runs)}
            disabled={isLoading || !currentBatter || !currentBowler}
            className={`btn py-4 font-bold ${
              selectedRuns === runs ? 'bg-primary-700' : 'btn-primary'
            }`}
            title={!currentBatter || !currentBowler ? 'Select batter and bowler first' : ''}
          >
            {runs}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={handleWicket}
          disabled={isLoading || !currentBatter || !currentBowler}
          className="btn btn-danger py-4 font-bold"
          title={!currentBatter || !currentBowler ? 'Select batter and bowler first' : ''}
        >
          🏏 Wicket
        </button>
        <button
          onClick={handleWide}
          disabled={isLoading || !currentBowler}
          className="btn btn-secondary py-4"
          title={!currentBowler ? 'Select bowler first' : ''}
        >
          Wide (+1)
        </button>
        <button
          onClick={handleNoBall}
          disabled={isLoading || !currentBowler}
          className="btn btn-secondary py-4"
          title={!currentBowler ? 'Select bowler first' : ''}
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
  )
}

interface MatchStatsDisplayProps {
  stats: MatchStats['stats']
  teamAName: string
  teamBName: string
  matchStatus: 'SCHEDULED' | 'LIVE' | 'COMPLETED'
}

function MatchStatsDisplay({
  stats,
  teamAName,
  teamBName,
  matchStatus,
}: MatchStatsDisplayProps) {

  const { data: motmPlayer } = useQuery({
    queryKey: ['player', stats?.man_of_the_match],
    queryFn: () => playersApi.getById(stats!.man_of_the_match!).then(res => res.data),
    enabled: !!stats?.man_of_the_match && matchStatus === 'COMPLETED',
  })

  if (!stats || !stats.team_a || !stats.team_b) {
    return <p className="text-gray-500">No statistics available</p>
  }

  const teamA = stats.team_a
  const teamB = stats.team_b

  const calculateRunRate = (runs: number, overs: number) => {
    if (overs === 0) return '0.00'
    return (runs / overs).toFixed(2)
  }

  return (
    <div className="space-y-6">
      {stats.result && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-center">
          <p className="text-lg font-semibold text-primary-900">{stats.result}</p>
        </div>
      )}

      {stats.man_of_the_match && matchStatus === 'COMPLETED' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🏆</span>
            <h3 className="text-lg font-bold text-yellow-900">Man of the Match</h3>
          </div>
          <p className="text-sm text-yellow-700">
            {motmPlayer ? (
              <span>{motmPlayer.name}</span>
            ) : (
              <span>Loading...</span>
            )}
            {stats.man_of_the_match_score !== undefined && (
              <span className="ml-2">(Score: {stats.man_of_the_match_score.toFixed(2)})</span>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{teamAName}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Runs</p>
              <p className="text-2xl font-bold text-gray-900">{teamA.runs}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Wickets</p>
              <p className="text-2xl font-bold text-gray-900">{teamA.wickets}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Overs</p>
              <p className="text-2xl font-bold text-gray-900">{teamA.overs.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Run Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {calculateRunRate(teamA.runs, teamA.overs)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fours</p>
              <p className="text-xl font-semibold text-gray-900">{teamA.fours}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sixes</p>
              <p className="text-xl font-semibold text-gray-900">{teamA.sixes}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-500">Extras</p>
              <p className="text-xl font-semibold text-gray-900">{teamA.extras}</p>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{teamBName}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Runs</p>
              <p className="text-2xl font-bold text-gray-900">{teamB.runs}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Wickets</p>
              <p className="text-2xl font-bold text-gray-900">{teamB.wickets}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Overs</p>
              <p className="text-2xl font-bold text-gray-900">{teamB.overs.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Run Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {calculateRunRate(teamB.runs, teamB.overs)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fours</p>
              <p className="text-xl font-semibold text-gray-900">{teamB.fours}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sixes</p>
              <p className="text-xl font-semibold text-gray-900">{teamB.sixes}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-500">Extras</p>
              <p className="text-xl font-semibold text-gray-900">{teamB.extras}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}