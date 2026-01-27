import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trophy } from 'lucide-react'
import { tournamentsApi, CreateTournamentRequest } from '../api/tournaments'
import { Link } from 'react-router-dom'

export default function Tournaments() {
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<CreateTournamentRequest>({
    name: '',
    sport_type: 'CRICKET',
  })
  const queryClient = useQueryClient()

  const { data: tournaments, isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => tournamentsApi.getAll().then(res => res.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateTournamentRequest) => tournamentsApi.create(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] })
      setShowModal(false)
      setFormData({ name: '', sport_type: 'CRICKET' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tournaments</h1>
          <p className="mt-2 text-gray-600">Manage your sports tournaments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Tournament
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading tournaments...</p>
        </div>
      ) : tournaments && tournaments.length === 0 ? (
        <div className="card text-center py-12">
          <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No tournaments yet</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            Create Your First Tournament
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments?.map(tournament => (
            <Link
              key={tournament.id}
              to={`/tournaments/${tournament.id}`}
              className="card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{tournament.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{tournament.sport_type}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  tournament.status === 'LIVE' ? 'bg-red-100 text-red-800' :
                  tournament.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {tournament.status}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Started: {new Date(tournament.start_date).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Tournament</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Tournament Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Sport Type</label>
                <select
                  className="input"
                  value={formData.sport_type}
                  onChange={(e) => setFormData({ ...formData, sport_type: e.target.value as any })}
                  required
                >
                  <option value="CRICKET">Cricket</option>
                  <option value="FOOTBALL">Football</option>
                  <option value="BADMINTON">Badminton</option>
                </select>
              </div>
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
                  disabled={createMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
