import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calendar, Trophy, Plus, Users } from 'lucide-react'
import { tournamentsApi } from '../api/tournaments'
import { matchesApi, CreateMatchRequest } from '../api/matches'
import { teamsApi } from '../api/teams'

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>()
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
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

  const { data: matches } = useQuery({
    queryKey: ['matches'],
    queryFn: () => matchesApi.getAll().then(res => res.data),
  })

  const { data: allTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll().then(res => res.data),
  })

  const { data: tournamentTeams } = useQuery({
    queryKey: ['tournamentTeams', id],
    queryFn: () => tournamentsApi.getTeams(id!).then(res => res.data),
    enabled: !!id,
  })

  const tournamentMatches = matches?.filter(m => m.tournament_id === id) || []
  
  const tournamentTeamIds = new Set(tournamentTeams?.map(t => t.id) || [])
  const availableTeams = allTeams?.filter(t => !tournamentTeamIds.has(t.id)) || []

  const createMatchMutation = useMutation({
    mutationFn: (data: CreateMatchRequest) => matchesApi.create(id!, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] })
      setShowMatchModal(false)
      setMatchForm({ team_a_id: '', team_b_id: '', start_time: '' })
    },
  })

  const addTeamMutation = useMutation({
    mutationFn: (teamId: string) => teamsApi.addToTournament(id!, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournamentTeams', id] })
      queryClient.invalidateQueries({ queryKey: ['tournament', id] })
      setShowTeamModal(false)
      setSelectedTeamId('')
    },
  })

  const handleMatchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const isoDateTime = new Date(matchForm.start_time).toISOString()
    createMatchMutation.mutate({ ...matchForm, start_time: isoDateTime })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB') 
  }

  const handleTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedTeamId) {
      addTeamMutation.mutate(selectedTeamId)
    }
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
            tournament.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {tournament.status}
          </span>
        </div>

        <div className="mt-6 flex space-x-3">
          <button
            onClick={() => setShowTeamModal(true)}
            className="btn btn-secondary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Team
          </button>
          <button
            onClick={() => setShowMatchModal(true)}
            className="btn btn-primary flex items-center"
            disabled={!tournamentTeams || tournamentTeams.length < 2}
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule Match
          </button>
        </div>
      </div>

      {/* Teams in Tournament */}
      {tournamentTeams && tournamentTeams.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Teams</h2>
          <div className="flex flex-wrap gap-3">
            {tournamentTeams.map(team => (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <div className="h-8 w-8 flex-shrink-0 mr-2 flex items-center justify-center">
                  {team.logo_url ? (
                    <img 
                      src={team.logo_url} 
                      alt={team.name} 
                      className="h-8 w-8 object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <span className={`h-8 w-8 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center ${team.logo_url ? 'hidden' : ''}`}>
                    {team.short_code.slice(0, 2)}
                  </span>
                </div>
                <span className="font-medium text-gray-900">{team.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Matches</h2>
        {tournamentMatches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No matches scheduled yet</p>
            {(!tournamentTeams || tournamentTeams.length < 2) ? (
              <p className="text-sm text-gray-400">Add at least 2 teams to schedule matches</p>
            ) : (
              <button onClick={() => setShowMatchModal(true)} className="btn btn-primary">
                Schedule First Match
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tournamentMatches.map(match => (
              <Link
                key={match.id}
                to={`/matches/${match.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">
                      <span className="text-primary-600">{match.team_a_short_code}</span>
                      {' vs '}
                      <span className="text-primary-600">{match.team_b_short_code}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      {match.team_a_name} vs {match.team_b_name} • {formatDate(match.start_time)} {new Date(match.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                    match.status === 'LIVE' ? 'bg-red-100 text-red-800' :
                    match.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {match.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Add Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Team to Tournament</h2>
            {availableTeams.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-4">All teams are already in this tournament</p>
                <Link to="/teams" className="btn btn-primary">
                  Create New Team
                </Link>
              </div>
            ) : (
              <form onSubmit={handleTeamSubmit} className="space-y-4">
                <div>
                  <label className="label">Select Team</label>
                  <select
                    className="input"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    required
                  >
                    <option value="">Choose a team</option>
                    {availableTeams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.short_code})
                      </option>
                    ))}
                  </select>
                </div>
                {addTeamMutation.isError && (
                  <p className="text-red-500 text-sm">Failed to add team. Please try again.</p>
                )}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowTeamModal(false)}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addTeamMutation.isPending}
                    className="btn btn-primary flex-1"
                  >
                    {addTeamMutation.isPending ? 'Adding...' : 'Add Team'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Schedule Match Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Schedule Match</h2>
            <form onSubmit={handleMatchSubmit} className="space-y-4">
              <div>
                <label className="label">Team A</label>
                <select
                  className="input"
                  value={matchForm.team_a_id}
                  onChange={(e) => setMatchForm({ ...matchForm, team_a_id: e.target.value })}
                  required
                >
                  <option value="">Select team</option>
                  {tournamentTeams?.map(team => (
                    <option key={team.id} value={team.id} disabled={team.id === matchForm.team_b_id}>
                      {team.name} ({team.short_code})
                    </option>
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
                  {tournamentTeams?.map(team => (
                    <option key={team.id} value={team.id} disabled={team.id === matchForm.team_a_id}>
                      {team.name} ({team.short_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Match Date & Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={matchForm.start_time}
                  onChange={(e) => setMatchForm({ ...matchForm, start_time: e.target.value })}
                  required
                />
              </div>
              {createMatchMutation.isError && (
                <p className="text-red-500 text-sm">Failed to create match. Please try again.</p>
              )}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowMatchModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMatchMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {createMatchMutation.isPending ? 'Creating...' : 'Schedule Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
