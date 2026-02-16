import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calendar, Trophy, Plus, Users, RefreshCw, Award, User, X } from 'lucide-react'
import { tournamentsApi, LeaderboardEntry, Tournament } from '../api/tournaments'
import { matchesApi, CreateMatchRequest } from '../api/matches'
import { teamsApi } from '../api/teams'
import { playersApi, Player } from '../api/players'

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>()
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showViewPlayersModal, setShowViewPlayersModal] = useState(false)
  const [selectedTeamForPlayers, setSelectedTeamForPlayers] = useState<string | null>(null)
  const [selectedTeamForView, setSelectedTeamForView] = useState<string | null>(null)
  const [editingMatch, setEditingMatch] = useState<{ id: string; team_a_id: string; team_b_id: string; start_time: string } | null>(null)
  const [matchForm, setMatchForm] = useState<CreateMatchRequest>({
    team_a_id: '',
    team_b_id: '',
    start_time: '',
  })
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const queryClient = useQueryClient()

  const { data: tournament, isLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => tournamentsApi.getById(id!).then(res => res.data),
    enabled: !!id,
  })

  const { data: isLockedData } = useQuery({
    queryKey: ['tournamentLocked', id],
    queryFn: () => tournamentsApi.isLocked(id!).then(res => res.data),
    enabled: !!id,
  })

  const isLocked = isLockedData?.is_locked || false

  const { data: allMatches } = useQuery({
    queryKey: ['matches'],
    queryFn: () => matchesApi.getAll().then(res => res.data),
  })

  const matches = allMatches?.filter(m => m.tournament_id === id) || []

  const { data: tournamentTeams } = useQuery({
    queryKey: ['tournamentTeams', id],
    queryFn: () => tournamentsApi.getTeams(id!).then(res => res.data),
    enabled: !!id,
  })

  const { data: teamPlayerCountsData } = useQuery({
    queryKey: ['teamPlayerCounts', id],
    queryFn: async () => {
      if (!tournamentTeams || tournamentTeams.length === 0) return {}
      const counts: Record<string, number> = {}
      await Promise.all(
        tournamentTeams.map(async (team) => {
          try {
            const players = await tournamentsApi.getTeamPlayers(id!, team.id)
              .then(res => res.data || [])
            counts[team.id] = players.length
          } catch {
            counts[team.id] = 0
          }
        })
      )
      return counts
    },
    enabled: !!id && !!tournamentTeams && tournamentTeams.length > 0,
  })

  const teamPlayerCounts = teamPlayerCountsData || {}

  const { data: leaderboardData } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => tournamentsApi.getLeaderboard(id!).then(res => res.data),
    enabled: !!id,
  })

  const leaderboard = leaderboardData || []

  const addTeamMutation = useMutation({
    mutationFn: (teamId: string) => teamsApi.addToTournament(id!, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentTeams', id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', id] })
      setShowTeamModal(false)
      setSelectedTeamId('')
    },
  })

  const addPlayerToTeamMutation = useMutation({
    mutationFn: ({ teamId, playerId }: { teamId: string; playerId: string }) =>
      playersApi.addToTeamInTournament(id!, teamId, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPlayers', id] })
      queryClient.invalidateQueries({ queryKey: ['availablePlayers', id] })
      if (selectedTeamForPlayers) {
        queryClient.invalidateQueries({ queryKey: ['teamPlayers', id, selectedTeamForPlayers] })
      }
    },
  })

  const createMatchMutation = useMutation({
    mutationFn: (data: CreateMatchRequest) => matchesApi.create(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      queryClient.invalidateQueries({ queryKey: ['tournamentLocked', id] })
      setShowMatchModal(false)
      setMatchForm({ team_a_id: '', team_b_id: '', start_time: '' })
      setEditingMatch(null)
    },
  })

  const updateMatchMutation = useMutation({
    mutationFn: ({ matchId, data }: { matchId: string; data: CreateMatchRequest }) =>
      matchesApi.update(matchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      setShowMatchModal(false)
      setMatchForm({ team_a_id: '', team_b_id: '', start_time: '' })
      setEditingMatch(null)
    },
  })

  const deleteMatchMutation = useMutation({
    mutationFn: (matchId: string) => matchesApi.delete(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      queryClient.invalidateQueries({ queryKey: ['tournamentLocked', id] })
    },
  })

  const recalculateLeaderboardMutation = useMutation({
    mutationFn: () => tournamentsApi.recalculateLeaderboard(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard', id] })
    },
  })

  const handleMatchSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (matchForm.team_a_id === matchForm.team_b_id) {
      alert('Team A and Team B must be different teams')
      return
    }

    if (editingMatch) {
      updateMatchMutation.mutate({ matchId: editingMatch.id, data: matchForm })
    } else {
      createMatchMutation.mutate(matchForm)
    }
  }

  const handleTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addTeamMutation.mutate(selectedTeamId)
    setShowTeamModal(false)
    setSelectedTeamId('')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!tournament) {
    return <div className="text-center py-12">Tournament not found</div>
  }

  return (
    <div className="space-y-6">
      <Link to="/tournaments" className="inline-flex items-center text-primary-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Tournaments
      </Link>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
            <div className="mt-4 space-y-2">
              <div className="flex items-center text-gray-600">
                <Trophy className="h-5 w-5 mr-2" />
                <span className="font-medium">{tournament.sport_type}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Calendar className="h-5 w-5 mr-2" />
                <span>Started: {formatDate(tournament.start_date)}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Users className="h-5 w-5 mr-2" />
                <span>{tournament.team_count || tournamentTeams?.length || 0} Teams</span>
              </div>
            </div>
          </div>
          <span className={`px-4 py-2 text-sm font-medium rounded-full ${
            tournament.status === 'LIVE' ? 'bg-red-100 text-red-800' :
            tournament.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {tournament.status}
          </span>
        </div>
        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            onClick={() => setShowConfigModal(true)}
            className={`btn btn-secondary whitespace-nowrap ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLocked}
            title={isLocked ? 'Tournament is locked because matches have been scheduled' : ''}
          >
            {tournament?.config ? 'Edit Config' : 'Set Config'}
          </button>
          <button
            onClick={() => setShowTeamModal(true)}
            className={`btn btn-secondary whitespace-nowrap ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLocked}
            title={isLocked ? 'Tournament is locked because matches have been scheduled' : ''}
          >
            Add Team
          </button>
          <button
            onClick={() => setShowMatchModal(true)}
            className={`btn btn-primary whitespace-nowrap ${
              !tournamentTeams ||
              tournamentTeams.length < 2 ||
              !canScheduleMatch(tournament, tournamentTeams, teamPlayerCounts)
                ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={
              !tournamentTeams ||
              tournamentTeams.length < 2 ||
              !canScheduleMatch(tournament, tournamentTeams, teamPlayerCounts)
            }
            title={
              !tournamentTeams || tournamentTeams.length < 2
                ? 'Need at least 2 teams to schedule a match'
                : !canScheduleMatch(tournament, tournamentTeams, teamPlayerCounts)
                ? 'All teams must have the required number of players before scheduling matches'
                : ''
            }
          >
            Schedule Match
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Teams ({tournamentTeams?.length || 0})</h2>
          {tournamentTeams && tournamentTeams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tournamentTeams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  tournamentId={id!}
                  isLocked={isLocked}
                  tournament={tournament}
                  teamPlayerCount={teamPlayerCounts[team.id] || 0}
                  onManagePlayers={() => {
                    setSelectedTeamForPlayers(team.id)
                    setShowPlayerModal(true)
                  }}
                  onViewPlayers={() => {
                    setSelectedTeamForView(team.id)
                    setShowViewPlayersModal(true)
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No teams added yet</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Matches ({matches.length})</h2>
          {matches && matches.length > 0 ? (
            <div className="space-y-2">
              {matches.map(match => (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Link
                    to={`/matches/${match.id}`}
                    className="flex-1"
                  >
                    <div>
                      <span className="font-medium">{match.team_a_short_code || 'Team A'} vs {match.team_b_short_code || 'Team B'}</span>
                      <p className="text-sm text-gray-500">{formatDate(match.start_time)}</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      match.status === 'LIVE' ? 'bg-red-100 text-red-800' :
                      match.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {match.status}
                    </span>
                    {match.status === 'SCHEDULED' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            setEditingMatch({
                              id: match.id,
                              team_a_id: match.team_a_id,
                              team_b_id: match.team_b_id,
                              start_time: match.start_time,
                            })
                            setMatchForm({
                              team_a_id: match.team_a_id,
                              team_b_id: match.team_b_id,
                              start_time: match.start_time,
                            })
                            setShowMatchModal(true)
                          }}
                          className="text-xs btn btn-sm btn-secondary"
                          title="Edit match"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            if (confirm('Are you sure you want to delete this match?')) {
                              deleteMatchMutation.mutate(match.id)
                            }
                          }}
                          className="text-xs btn btn-sm btn-danger"
                          title="Delete match"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
      ) : (
            <p className="text-gray-500">No matches scheduled yet</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
          <button
            onClick={() => recalculateLeaderboardMutation.mutate()}
            disabled={recalculateLeaderboardMutation.isPending}
            className="btn btn-secondary flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculateLeaderboardMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculate Leaderboard
          </button>
        </div>
        <LeaderboardDisplay leaderboard={leaderboard} sportType={tournament.sport_type} />
      </div>

      {showTeamModal && (
        <AddTeamModal
          tournamentTeams={tournamentTeams || []}
          selectedTeamId={selectedTeamId}
          onSelectTeam={setSelectedTeamId}
          onSubmit={handleTeamSubmit}
          onClose={() => {
            setShowTeamModal(false)
            setSelectedTeamId('')
          }}
          isPending={addTeamMutation.isPending}
        />
      )}

      {showConfigModal && tournament && (
        <TournamentConfigModal
          tournament={tournament}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      {showViewPlayersModal && selectedTeamForView && (
        <ViewPlayersModal
          tournamentId={id!}
          teamId={selectedTeamForView}
          teamName={tournamentTeams?.find(t => t.id === selectedTeamForView)?.name || ''}
          onClose={() => {
            setShowViewPlayersModal(false)
            setSelectedTeamForView(null)
          }}
        />
      )}

      {showMatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingMatch ? 'Edit Match' : 'Schedule Match'}
            </h2>
            <form onSubmit={handleMatchSubmit} className="space-y-4">
              <div>
                <label className="label">Team A</label>
                <select
                  className="input"
                  value={matchForm.team_a_id}
                  onChange={(e) => {
                    const newTeamAId = e.target.value

                    const newTeamBId = matchForm.team_b_id === newTeamAId ? '' : matchForm.team_b_id
                    setMatchForm({ ...matchForm, team_a_id: newTeamAId, team_b_id: newTeamBId })
                  }}
                  required
                >
                  <option value="">Select team</option>
                  {tournamentTeams?.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Team B</label>
                <select
                  className="input"
                  value={matchForm.team_b_id}
                  onChange={(e) => setMatchForm({ ...matchForm, team_b_id: e.target.value })}
                  required
                >
                  <option value="">Select team</option>
                  {tournamentTeams?.filter(team => team.id !== matchForm.team_a_id).map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Start Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={matchForm.start_time ? (() => {
                    try {
                      const date = new Date(matchForm.start_time)
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      const hours = String(date.getHours()).padStart(2, '0')
                      const minutes = String(date.getMinutes()).padStart(2, '0')
                      return `${year}-${month}-${day}T${hours}:${minutes}`
                    } catch {
                      return ''
                    }
                  })() : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const date = new Date(e.target.value)
                      if (!isNaN(date.getTime())) {
                        setMatchForm({ ...matchForm, start_time: date.toISOString() })
                      }
                    } else {
                      setMatchForm({ ...matchForm, start_time: '' })
                    }
                  }}
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowMatchModal(false)
                    setEditingMatch(null)
                    setMatchForm({ team_a_id: '', team_b_id: '', start_time: '' })
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMatchMutation.isPending || updateMatchMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {createMatchMutation.isPending || updateMatchMutation.isPending
                    ? (editingMatch ? 'Updating...' : 'Creating...')
                    : (editingMatch ? 'Update Match' : 'Create Match')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPlayerModal && selectedTeamForPlayers && (
        <AddPlayerToTeamModal
          tournamentId={id!}
          teamId={selectedTeamForPlayers}
          teamName={tournamentTeams?.find(t => t.id === selectedTeamForPlayers)?.name || ''}
          onClose={() => {
            setShowPlayerModal(false)
            setSelectedTeamForPlayers(null)
          }}
          onAddPlayers={async (playerIds) => {

            await Promise.all(
              playerIds.map(playerId =>
                addPlayerToTeamMutation.mutateAsync(
                  { teamId: selectedTeamForPlayers, playerId }
                )
              )
            )

            queryClient.invalidateQueries({ queryKey: ['teamPlayers', id, selectedTeamForPlayers] })
            queryClient.invalidateQueries({ queryKey: ['availablePlayersForTournament', id] })
            queryClient.invalidateQueries({ queryKey: ['allTeamPlayers', id] })
            queryClient.invalidateQueries({ queryKey: ['teamPlayerCounts', id] })
          }}
          onRemovePlayers={async (playerIds) => {

            await Promise.all(
              playerIds.map(playerId =>
                tournamentsApi.removePlayerFromTeam(id!, selectedTeamForPlayers, playerId).catch(err => {
                  console.error(`Error removing player ${playerId}:`, err)
                  throw err
                })
              )
            )

            queryClient.invalidateQueries({ queryKey: ['teamPlayers', id, selectedTeamForPlayers] })
            queryClient.invalidateQueries({ queryKey: ['availablePlayersForTournament', id] })
            queryClient.invalidateQueries({ queryKey: ['allTeamPlayers', id] })
            queryClient.invalidateQueries({ queryKey: ['teamPlayerCounts', id] })
          }}
        />
      )}
    </div>
  )
}

function AddTeamModal({
  tournamentTeams,
  selectedTeamId,
  onSelectTeam,
  onSubmit,
  onClose,
  isPending,
}: {
  tournamentTeams: any[]
  selectedTeamId: string
  onSelectTeam: (teamId: string) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  isPending: boolean
}) {
  const { data: allTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll().then(res => res.data),
  })

  const availableTeams = allTeams?.filter(t => !tournamentTeams.some(tt => tt.id === t.id)) || []

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Team to Tournament</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Select Team</label>
            <select
              className="input"
              value={selectedTeamId}
              onChange={(e) => onSelectTeam(e.target.value)}
              required
            >
              <option value="">Choose a team</option>
              {availableTeams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-primary flex-1"
            >
              {isPending ? 'Adding...' : 'Add Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TeamCard({
  team,
  tournamentId,
  isLocked,
  tournament,
  teamPlayerCount,
  onManagePlayers,
  onViewPlayers
}: {
  team: any
  tournamentId: string
  isLocked: boolean
  tournament: Tournament | undefined
  teamPlayerCount: number
  onManagePlayers: () => void
  onViewPlayers: () => void
}) {
  const { data: playersData } = useQuery({
    queryKey: ['teamPlayers', tournamentId, team.id],
    queryFn: () =>
      tournamentsApi.getTeamPlayers(tournamentId, team.id).then(res => res.data),
    enabled: !!tournamentId && !!team.id,
  })

  const players = playersData || []
  const requiredPlayers = tournament?.config?.players_per_team || 0
  const hasInsufficientPlayers = requiredPlayers > 0 && teamPlayerCount < requiredPlayers
  const hasExcessPlayers = requiredPlayers > 0 && teamPlayerCount > requiredPlayers

  return (
    <div className={`p-4 border rounded-lg transition-shadow ${
      hasExcessPlayers
        ? 'border-red-300 bg-red-50'
        : hasInsufficientPlayers
        ? 'border-yellow-300 bg-yellow-50'
        : 'border-gray-200 hover:shadow-md'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          {team.logo_url ? (
            <img
              src={team.logo_url}
              alt={team.name}
              className="h-12 w-12 object-contain mr-3"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center mr-3">
              <span className="text-primary-600 font-bold">{team.short_code}</span>
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{team.short_code}</p>
            <p className="text-sm text-gray-500">{team.name}</p>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Players ({teamPlayerCount}
            {requiredPlayers > 0 && `/${requiredPlayers}`})
          </span>
          <button
            onClick={isLocked ? onViewPlayers : onManagePlayers}
            className="text-xs btn btn-sm btn-secondary flex items-center"
            title={
              isLocked
                ? 'View players in this team'
                : hasExcessPlayers
                ? `Team has ${teamPlayerCount} players, but only ${requiredPlayers} are required. Remove players first.`
                : ''
            }
          >
            {isLocked ? (
              <>
                <User className="h-3 w-3 mr-1" />
                View Players
              </>
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1" />
                Add
              </>
            )}
          </button>
        </div>

        {hasExcessPlayers && (
          <div className="mb-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
            <strong>Error:</strong> Team has {teamPlayerCount} players, but only {requiredPlayers} are required. Remove {teamPlayerCount - requiredPlayers} player(s) first.
          </div>
        )}

        {hasInsufficientPlayers && (
          <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
            <strong>Warning:</strong> Team needs {requiredPlayers - teamPlayerCount} more player(s) ({teamPlayerCount}/{requiredPlayers}).
          </div>
        )}

        {players.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No players yet</p>
        ) : (
          <div className="space-y-1">
            {players.slice(0, 3).map((player: Player) => (
              <div key={player.id} className="flex items-center text-xs text-gray-600">
                <User className="h-3 w-3 mr-1" />
                {player.name}
              </div>
            ))}
            {players.length > 3 && (
              <p className="text-xs text-gray-400">+{players.length - 3} more</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AddPlayerToTeamModal({
  tournamentId,
  teamId,
  teamName,
  onClose,
  onAddPlayers,
  onRemovePlayers,
}: {
  tournamentId: string
  teamId: string
  teamName: string
  onClose: () => void
  onAddPlayers: (playerIds: string[]) => Promise<void>
  onRemovePlayers: (playerIds: string[]) => Promise<void>
}) {
  const [isUpdating, setIsUpdating] = useState(false)

  const { data: tournament } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => tournamentsApi.getById(tournamentId).then(res => res.data),
    enabled: !!tournamentId,
  })

  const { data: allPlayersData, isLoading: isLoadingPlayers } = useQuery({
    queryKey: ['players', tournament?.sport_type],
    queryFn: () => playersApi.getAll(tournament?.sport_type).then(res => res.data),
    enabled: !!tournament?.sport_type,
  })

  const { data: tournamentTeams } = useQuery({
    queryKey: ['tournamentTeams', tournamentId],
    queryFn: () => tournamentsApi.getTeams(tournamentId).then(res => res.data),
    enabled: !!tournamentId,
  })

  const { data: allTeamPlayersData } = useQuery({
    queryKey: ['allTeamPlayers', tournamentId],
    queryFn: async () => {
      if (!tournamentTeams) return {}
      const playersByTeam: Record<string, Player[]> = {}
      await Promise.all(
        tournamentTeams.map(async (team) => {
          const players = await tournamentsApi.getTeamPlayers(tournamentId, team.id)
            .then(res => res.data || [])
            .catch(() => [])
          playersByTeam[team.id] = players || []
        })
      )
      return playersByTeam
    },
    enabled: !!tournamentId && !!tournamentTeams,
  })

  const allPlayers = allPlayersData || []
  const playersByTeam = allTeamPlayersData || {}

  const playerToTeamMap = new Map<string, string>()
  Object.entries(playersByTeam).forEach(([tid, players]) => {
    if (players && Array.isArray(players)) {
      players.forEach((player: Player) => {
        playerToTeamMap.set(player.id, tid)
      })
    }
  })

  const getTeamName = (tid: string) => {
    return tournamentTeams?.find(t => t.id === tid)?.name || 'Unknown Team'
  }

  const currentTeamPlayers = playersByTeam[teamId] || []
  const currentPlayerCount = currentTeamPlayers.length
  const requiredPlayers = tournament?.config?.players_per_team || 0
  const canAddMore = requiredPlayers === 0 || currentPlayerCount < requiredPlayers

  const handleTogglePlayer = async (playerId: string) => {
    if (isUpdating) return

    const playerTeamId = playerToTeamMap.get(playerId)
    const isCurrentlyInTeam = playerTeamId === teamId
    const isInOtherTeam = playerTeamId && playerTeamId !== teamId

    if (isInOtherTeam) {
      return
    }

    if (!isCurrentlyInTeam && !canAddMore) {
      return
    }

    setIsUpdating(true)

    try {
      if (isCurrentlyInTeam) {
        await onRemovePlayers([playerId])
      } else {
        await onAddPlayers([playerId])
      }
    } catch (error) {
      console.error('Error updating player:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Manage Players - {teamName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoadingPlayers ? (
          <div className="text-center py-8">Loading players...</div>
        ) : allPlayers.length === 0 ? (
          <div className="text-center py-8">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">No players available</p>
            <Link to="/players" className="btn btn-primary">
              Create New Player
            </Link>
          </div>
        ) : (
          <div className="space-y-4">

            <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
              <div className="divide-y divide-gray-200">
                {allPlayers.map((player: Player) => {
                  const playerTeamId = playerToTeamMap.get(player.id)
                  const isInCurrentTeam = playerTeamId === teamId
                  const isInOtherTeam = playerTeamId && playerTeamId !== teamId
                  const isDisabled = isInOtherTeam || isUpdating || (!isInCurrentTeam && !canAddMore)

                  return (
                    <label
                      key={player.id}
                      className={`flex items-center p-3 hover:bg-gray-50 ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isInCurrentTeam}
                        onChange={() => !isDisabled && handleTogglePlayer(player.id)}
                        disabled={isDisabled}
                        className="mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{player.name}</span>
                          {player.role && (
                            <span className="text-xs text-gray-500">
                              ({player.role.replace(/_/g, ' ')})
                            </span>
                          )}
                        </div>
                        {isInOtherTeam && (
                          <p className="text-xs text-red-600 mt-1">
                            Already in {getTeamName(playerTeamId!)}
                          </p>
                        )}
                        {!isInOtherTeam && !isInCurrentTeam && !canAddMore && (
                          <p className="text-xs text-red-600 mt-1">
                            Team already has {currentPlayerCount} players (required: {requiredPlayers})
                          </p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LeaderboardDisplay({
  leaderboard,
  sportType
}: {
  leaderboard: LeaderboardEntry[]
  sportType: string
}) {
  if (sportType === 'CRICKET') {
    const sortedLeaderboard = [...leaderboard].sort((a, b) =>
      (b.stats.runs || 0) - (a.stats.runs || 0)
    )

    const topRunScorer = sortedLeaderboard[0]
    const topWicketTaker = [...leaderboard].sort((a, b) =>
      (b.stats.wickets || 0) - (a.stats.wickets || 0)
    )[0]

    return (
      <div className="space-y-6">

        {(topRunScorer?.stats.runs || topWicketTaker?.stats.wickets) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topRunScorer && topRunScorer.stats.runs && (
              <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Top Run Scorer</p>
                    <p className="text-xl font-bold text-gray-900">{topRunScorer.player_name}</p>
                    <p className="text-2xl font-bold text-yellow-600">{topRunScorer.stats.runs} runs</p>
                  </div>
                  <Award className="h-12 w-12 text-yellow-500" />
                </div>
              </div>
            )}
            {topWicketTaker && topWicketTaker.stats.wickets && (
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Top Wicket Taker</p>
                    <p className="text-xl font-bold text-gray-900">{topWicketTaker.player_name}</p>
                    <p className="text-2xl font-bold text-blue-600">{topWicketTaker.stats.wickets} wickets</p>
                  </div>
                  <Award className="h-12 w-12 text-blue-500" />
                </div>
              </div>
            )}
          </div>
        )}

        {leaderboard.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Player</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Team</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Runs</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Wickets</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Matches</th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboard.map((entry, index) => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{index + 1}</td>
                    <td className="py-3 px-4">{entry.player_name}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                        {entry.team_code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{entry.stats.runs || 0}</td>
                    <td className="py-3 px-4 text-right">{entry.stats.wickets || 0}</td>
                    <td className="py-3 px-4 text-right">{entry.stats.matches || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            {leaderboard.length === 0 ? 'No completed matches yet. Leaderboard will appear after matches are completed.' : 'No leaderboard data available'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="text-center py-8 text-gray-500">
      Leaderboard not implemented for {sportType} yet
    </div>
  )
}

function canScheduleMatch(
  tournament: Tournament | undefined,
  teams: any[] | undefined,
  teamPlayerCounts: Record<string, number>
): boolean {
  if (!tournament || !teams || teams.length < 2) return false
  if (!tournament.config || !tournament.config.players_per_team) return false

  const requiredPlayers = tournament.config.players_per_team

  for (const team of teams) {
    const playerCount = teamPlayerCounts[team.id] || 0
    if (playerCount < requiredPlayers) {
      return false
    }
  }

  return true
}

function ViewPlayersModal({
  tournamentId,
  teamId,
  teamName,
  onClose,
}: {
  tournamentId: string
  teamId: string
  teamName: string
  onClose: () => void
}) {
  const { data: playersData } = useQuery({
    queryKey: ['teamPlayers', tournamentId, teamId],
    queryFn: () =>
      tournamentsApi.getTeamPlayers(tournamentId, teamId).then(res => res.data),
    enabled: !!tournamentId && !!teamId,
  })

  const players = playersData || []

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Players - {teamName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {players.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No players in this team</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {players.map((player: Player) => (
              <div key={player.id} className="flex items-center p-3 border border-gray-200 rounded-lg">
                <User className="h-5 w-5 mr-3 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{player.name}</p>
                  {player.role && (
                    <p className="text-sm text-gray-500">{player.role.replace(/_/g, ' ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6">
          <button
            onClick={onClose}
            className="btn btn-secondary w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function TournamentConfigModal({
  tournament,
  onClose,
}: {
  tournament: Tournament
  onClose: () => void
}) {
  const [config, setConfig] = useState(tournament.config || {})
  const queryClient = useQueryClient()

  const updateConfigMutation = useMutation({
    mutationFn: (newConfig: Tournament['config']) =>
      tournamentsApi.updateConfig(tournament.id, newConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateConfigMutation.mutate(config)
  }

  const getConfigFields = () => {
    switch (tournament.sport_type) {
      case 'CRICKET':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Players per Team *
              </label>
              <input
                type="number"
                min="1"
                value={config.players_per_team || ''}
                onChange={(e) => setConfig({ ...config, players_per_team: parseInt(e.target.value) || 0 })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overs per Match *
              </label>
              <input
                type="number"
                min="1"
                value={config.overs_per_match || ''}
                onChange={(e) => setConfig({ ...config, overs_per_match: parseInt(e.target.value) || 0 })}
                className="input"
                required
              />
            </div>
          </>
        )
      case 'FOOTBALL':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Players per Team *
              </label>
              <input
                type="number"
                min="1"
                value={config.players_per_team || ''}
                onChange={(e) => setConfig({ ...config, players_per_team: parseInt(e.target.value) || 0 })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Match Duration (minutes) *
              </label>
              <input
                type="number"
                min="1"
                value={config.match_duration_minutes || ''}
                onChange={(e) => setConfig({ ...config, match_duration_minutes: parseInt(e.target.value) || 0 })}
                className="input"
                required
              />
            </div>
          </>
        )
      case 'BADMINTON':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Players per Team *
              </label>
              <input
                type="number"
                min="1"
                value={config.players_per_team || ''}
                onChange={(e) => setConfig({ ...config, players_per_team: parseInt(e.target.value) || 0 })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sets to Win *
              </label>
              <input
                type="number"
                min="1"
                value={config.sets_to_win || ''}
                onChange={(e) => setConfig({ ...config, sets_to_win: parseInt(e.target.value) || 0 })}
                className="input"
                required
              />
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Tournament Configuration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {getConfigFields()}
          </div>
          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateConfigMutation.isPending}
              className="btn btn-primary flex-1"
            >
              {updateConfigMutation.isPending ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
