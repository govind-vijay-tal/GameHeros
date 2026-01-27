import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, User, Shield } from 'lucide-react'
import { teamsApi, AddPlayerRequest } from '../api/teams'

const ROLES = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>()
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<AddPlayerRequest>({ name: '', role: '' })
  const queryClient = useQueryClient()

  const { data: team, isLoading } = useQuery({
    queryKey: ['team', id],
    queryFn: () => teamsApi.getById(id!).then(res => res.data),
    enabled: !!id,
  })

  const addPlayerMutation = useMutation({
    mutationFn: (data: AddPlayerRequest) => teamsApi.addPlayer(id!, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', id] })
      setShowModal(false)
      setFormData({ name: '', role: '' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addPlayerMutation.mutate(formData)
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!team) {
    return <div className="text-center py-12">Team not found</div>
  }

  return (
    <div className="space-y-6">
      <Link to="/teams" className="inline-flex items-center text-primary-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Teams
      </Link>

      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {team.logo_url ? (
              <img 
                src={team.logo_url} 
                alt={team.name}
                className="h-20 w-20 object-contain mr-6"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary-100 flex items-center justify-center mr-6">
                <span className="text-primary-600 font-bold text-2xl">{team.short_code}</span>
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
              <p className="text-lg text-gray-500">{team.short_code}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Players ({team.players?.length || 0})
          </h2>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Player
          </button>
        </div>

        {!team.players || team.players.length === 0 ? (
          <div className="text-center py-8">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No players in this team yet</p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              Add First Player
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.players.map(player => (
              <div
                key={player.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mr-4">
                    <User className="h-6 w-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{player.name}</p>
                    {player.role && (
                      <p className="text-sm text-gray-500 flex items-center">
                        <Shield className="h-3 w-3 mr-1" />
                        {player.role.replace('_', ' ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Player</h2>
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
                <label className="label">Role (optional)</label>
                <select
                  className="input"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="">Select role</option>
                  {ROLES.map(role => (
                    <option key={role} value={role}>
                      {role.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              {addPlayerMutation.isError && (
                <p className="text-red-500 text-sm">
                  Failed to add player. Please try again.
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
                  disabled={addPlayerMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {addPlayerMutation.isPending ? 'Adding...' : 'Add Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
