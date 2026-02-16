import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, User, Trophy, Edit2, Check, X } from 'lucide-react'
import { playersApi, CreatePlayerRequest, UpdatePlayerRequest, Player } from '../api/players'

const SPORT_TYPES = ['CRICKET', 'FOOTBALL', 'BADMINTON'] as const

const CRICKET_ROLES = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'] as const
const FOOTBALL_ROLES = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'] as const
const BADMINTON_ROLES = ['SINGLES', 'DOUBLES', 'MIXED_DOUBLES'] as const

const getRolesForSport = (sportType: string): readonly string[] => {
  switch (sportType) {
    case 'CRICKET':
      return CRICKET_ROLES
    case 'FOOTBALL':
      return FOOTBALL_ROLES
    case 'BADMINTON':
      return BADMINTON_ROLES
    default:
      return []
  }
}

export default function Players() {
  const [showModal, setShowModal] = useState(false)
  const [sportFilter, setSportFilter] = useState<string>('')
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string>('')
  const [editingRole, setEditingRole] = useState<string>('')
  const [formData, setFormData] = useState<CreatePlayerRequest>({
    name: '',
    sport_type: 'CRICKET',
    role: '',
  })

  const handleSportTypeChange = (sportType: string) => {
    setFormData({ ...formData, sport_type: sportType as any, role: '' })
  }
  const queryClient = useQueryClient()

  const { data: playersData, isLoading } = useQuery({
    queryKey: ['players', sportFilter],
    queryFn: () => playersApi.getAll(sportFilter || undefined).then(res => res.data),
  })

  const playersList = playersData || []
  const filteredPlayers = sportFilter
    ? playersList.filter(p => p.sport_type === sportFilter)
    : playersList

  const createPlayerMutation = useMutation({
    mutationFn: (data: CreatePlayerRequest) => playersApi.create(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      setShowModal(false)
      setFormData({ name: '', sport_type: 'CRICKET', role: '' })
    },
  })

  const updatePlayerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlayerRequest }) =>
      playersApi.update(id, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] })
      setEditingPlayerId(null)
      setEditingName('')
      setEditingRole('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createPlayerMutation.mutate(formData)
  }

  const startEditing = (player: Player) => {
    setEditingPlayerId(player.id)
    setEditingName(player.name)
    setEditingRole(player.role || '')
  }

  const cancelEditing = () => {
    setEditingPlayerId(null)
    setEditingName('')
    setEditingRole('')
  }

  const saveEditing = (playerId: string, sportType: string) => {
    const updateData: UpdatePlayerRequest = {}
    if (editingName.trim() !== '') {
      updateData.name = editingName.trim()
    }
    if (editingRole !== '') {
      updateData.role = editingRole
    }

    updatePlayerMutation.mutate({ id: playerId, data: updateData })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Players</h1>
          <p className="mt-2 text-gray-600">Manage players across all sports</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Player
        </button>
      </div>

      <div className="card">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by Sport:</label>
          <select
            className="input flex-1 max-w-xs"
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
          >
            <option value="">All Sports</option>
            {SPORT_TYPES.map(sport => (
              <option key={sport} value={sport}>{sport}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading players...</div>
      ) : filteredPlayers.length === 0 ? (
        <div className="card text-center py-12">
          <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Players Yet</h3>
          <p className="text-gray-500 mb-4">
            {sportFilter ? `No ${sportFilter} players found` : 'Create your first player to get started'}
          </p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            Create Player
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Sport Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Role</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map(player => (
                  <tr key={player.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {editingPlayerId === player.id ? (
                        <input
                          type="text"
                          className="input text-sm"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-gray-900">{player.name}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                        <Trophy className="h-3 w-3 mr-1" />
                        {player.sport_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {editingPlayerId === player.id ? (
                        <select
                          className="input text-sm"
                          value={editingRole}
                          onChange={(e) => setEditingRole(e.target.value)}
                        >
                          <option value="">No role</option>
                          {getRolesForSport(player.sport_type).map(role => (
                            <option key={role} value={role}>
                              {role.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-600">
                          {player.role ? player.role.replace(/_/g, ' ') : '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {editingPlayerId === player.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => saveEditing(player.id, player.sport_type)}
                            disabled={updatePlayerMutation.isPending}
                            className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                            title="Save"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={updatePlayerMutation.isPending}
                            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(player)}
                          className="p-1 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Player</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Player Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter player name"
                  required
                />
              </div>
              <div>
                <label className="label">Sport Type</label>
                <select
                  className="input"
                  value={formData.sport_type}
                  onChange={(e) => handleSportTypeChange(e.target.value)}
                  required
                >
                  {SPORT_TYPES.map(sport => (
                    <option key={sport} value={sport}>{sport}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Role (optional)</label>
                <select
                  className="input"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  disabled={!formData.sport_type}
                >
                  <option value="">Select role</option>
                  {getRolesForSport(formData.sport_type).map(role => (
                    <option key={role} value={role}>
                      {role.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              {createPlayerMutation.isError && (
                <p className="text-red-500 text-sm">
                  Failed to create player. Please try again.
                </p>
              )}
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPlayerMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {createPlayerMutation.isPending ? 'Creating...' : 'Create Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
