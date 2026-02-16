import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, RefreshCw, Radio, BarChart3 } from 'lucide-react'
import { matchesApi, CricketState, MatchEvent, MatchStats } from '../api/matches'
import { playersApi } from '../api/players'
import { tournamentsApi } from '../api/tournaments'
import { format } from 'date-fns'
import { useMatchWebSocket } from '../hooks/useMatchWebSocketManager'

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

  const [events, setEvents] = useState<MatchEvent[]>([])

  const queryClient = useQueryClient()
  const { data: stats } = useQuery({
    queryKey: ['matchStats', id],
    queryFn: () => matchesApi.getStats(id!).then(res => res.data),
    enabled: !!id && (match?.status === 'COMPLETED' || match?.status === 'LIVE'),

    refetchInterval: match?.status === 'COMPLETED' ? false : false,
  })

  const { data: teamAPlayers } = useQuery({
    queryKey: ['teamPlayers', match?.tournament_id, match?.team_a_id],
    queryFn: () => tournamentsApi.getTeamPlayers(match!.tournament_id, match!.team_a_id).then((res: any) => res.data),
    enabled: !!match?.tournament_id && !!match?.team_a_id,
  })

  const { data: teamBPlayers } = useQuery({
    queryKey: ['teamPlayers', match?.tournament_id, match?.team_b_id],
    queryFn: () => tournamentsApi.getTeamPlayers(match!.tournament_id, match!.team_b_id).then((res: any) => res.data),
    enabled: !!match?.tournament_id && !!match?.team_b_id,
  })

  const { isConnected, state: wsState, score: wsScore } = useMatchWebSocket(
    match?.status === 'LIVE' || match?.status === 'COMPLETED' ? id : undefined,
    {
      onScoreUpdate: () => {

      },
      onMatchEnded: () => {

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

  const effectiveStatus = displayState?.is_over === false ? 'LIVE' :
                          displayState?.is_over === true ? 'COMPLETED' :
                          match.status

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
              {effectiveStatus === 'LIVE' && (
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
                onClick={() => { refetchMatch(); }}
                className="btn btn-secondary flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            )}
          </div>
        </div>

        {effectiveStatus === 'LIVE' && displayState && (
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

        {match.status === 'SCHEDULED' && (
          <div className="bg-yellow-50 rounded-lg p-6 mb-6 text-center">
            <p className="text-yellow-800 font-medium">Match not started yet</p>
            <p className="text-sm text-yellow-600 mt-1">
              Click "Score Match" to start the match and begin scoring
            </p>
          </div>
        )}

        {effectiveStatus === 'COMPLETED' && displayState && (
          <div className="bg-primary-50 rounded-lg p-6 mb-6 text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">
              {displayScore}
            </div>
            {displayState.result && (
              <p className="text-lg text-primary-700 font-medium">{displayState.result}</p>
            )}
          </div>
        )}

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
              {displayState?.total_overs ? `${displayState.total_overs} Overs` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {(effectiveStatus === 'LIVE' || effectiveStatus === 'COMPLETED') && stats && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-bold text-gray-900">
              {effectiveStatus === 'LIVE' ? 'Live Statistics' : 'Match Statistics'}
            </h2>
            {effectiveStatus === 'LIVE' && (
              <span className="ml-auto text-xs text-gray-500">Updating live...</span>
            )}
          </div>
          <MatchStatsDisplay
            stats={stats.stats}
            teamAName={match.team_a_name || ''}
            teamBName={match.team_b_name || ''}
            teamAShortCode={match.team_a_short_code || ''}
            teamBShortCode={match.team_b_short_code || ''}
            matchStatus={effectiveStatus}
            tournamentId={match.tournament_id || ''}
            teamAId={match.team_a_id || ''}
            teamBId={match.team_b_id || ''}
          />
        </div>
      )}

      {events && events.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Ball-by-Ball Commentary</h2>
          <BallByBallTimeline
            events={events}
            teamAPlayers={teamAPlayers}
            teamBPlayers={teamBPlayers}
            currentInnings={displayState?.innings}
          />
        </div>
      )}
    </div>
  )
}

function MatchStatsDisplay({
  stats,
  teamAName,
  teamBName,
  teamAShortCode,
  teamBShortCode,
  matchStatus,
  tournamentId,
  teamAId,
  teamBId
}: {
  stats: MatchStats['stats']
  teamAName: string
  teamBName: string
  teamAShortCode: string
  teamBShortCode: string
  matchStatus: string
  tournamentId: string
  teamAId: string
  teamBId: string
}) {
  if (!stats || !stats.team_a || !stats.team_b) {
    return <p className="text-gray-500">No statistics available</p>
  }

  const teamA = stats.team_a
  const teamB = stats.team_b

  const calculateRunRate = (runs: number, overs: number) => {
    if (overs === 0) return '0.00'
    return (runs / overs).toFixed(2)
  }

  const { data: motmPlayer } = useQuery({
    queryKey: ['player', stats.man_of_the_match],
    queryFn: () => playersApi.getById(stats.man_of_the_match!).then(res => res.data),
    enabled: matchStatus === 'COMPLETED' && !!stats.man_of_the_match,
  })

  const { data: teamAPlayersForMOTM } = useQuery({
    queryKey: ['teamPlayers', tournamentId, teamAId],
    queryFn: () => tournamentsApi.getTeamPlayers(tournamentId, teamAId).then((res: any) => res.data),
    enabled: matchStatus === 'COMPLETED' && !!stats.man_of_the_match && !!tournamentId && !!teamAId,
  })

  const { data: teamBPlayersForMOTM } = useQuery({
    queryKey: ['teamPlayers', tournamentId, teamBId],
    queryFn: () => tournamentsApi.getTeamPlayers(tournamentId, teamBId).then((res: any) => res.data),
    enabled: matchStatus === 'COMPLETED' && !!stats.man_of_the_match && !!tournamentId && !!teamBId,
  })

  const motmTeamShortCode = motmPlayer && stats.man_of_the_match
    ? (teamAPlayersForMOTM?.some((p: any) => p.id === stats.man_of_the_match) ? teamAShortCode :
       teamBPlayersForMOTM?.some((p: any) => p.id === stats.man_of_the_match) ? teamBShortCode : '')
    : ''

  return (
    <div className="space-y-6">

      {matchStatus === 'COMPLETED' && stats.man_of_the_match && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🏆</span>
            <h3 className="text-lg font-bold text-yellow-900">Man of the Match</h3>
          </div>
          <p className="text-sm text-yellow-700">
            {motmPlayer?.name || 'Loading...'}
            {motmTeamShortCode && (
              <span className="ml-2">({motmTeamShortCode})</span>
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

function BallByBallTimeline({
  events,
  teamAPlayers,
  teamBPlayers,
  currentInnings
}: {
  events: MatchEvent[]
  teamAPlayers?: any[]
  teamBPlayers?: any[]
  currentInnings?: number
}) {

  const innings1Events = events.filter(e => {
    const innings = e.event_data?.innings
    return innings === 1 || innings === undefined
  })
  const innings2Events = events.filter(e => e.event_data?.innings === 2)

  const innings1WithTotals = calculateRunningTotals(innings1Events)
  const innings2WithTotals = calculateRunningTotals(innings2Events)

  const playersMap = new Map<string, string>()
  if (teamAPlayers && Array.isArray(teamAPlayers)) {
    teamAPlayers.forEach((player: any) => {
      if (player?.id && player?.name) {
        playersMap.set(String(player.id), player.name)
      }
    })
  }
  if (teamBPlayers && Array.isArray(teamBPlayers)) {
    teamBPlayers.forEach((player: any) => {
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
            <div className="col-span-1">#</div>
            <div className="col-span-2">Event</div>
            <div className="col-span-2">Runs</div>
            <div className="col-span-2">Score</div>
            <div className="col-span-3">Players</div>
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
            <div className="col-span-1">#</div>
            <div className="col-span-2">Event</div>
            <div className="col-span-2">Runs</div>
            <div className="col-span-2">Score</div>
            <div className="col-span-3">Players</div>
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

function formatCricketScore(state?: CricketState): string {
  if (!state || !state.sport_type) return ''
  if (state.innings === 1) {
    return `${state.team_a_runs ?? 0}/${state.team_a_wickets ?? 0} (${(state.team_a_overs ?? 0).toFixed(1)})`
  }
  return `${state.team_b_runs ?? 0}/${state.team_b_wickets ?? 0} (${(state.team_b_overs ?? 0).toFixed(1)})`
}
