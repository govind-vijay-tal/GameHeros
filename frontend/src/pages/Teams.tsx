import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { teamsApi, CreateTeamRequest } from '../api/teams'

export default function Teams() {
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState<CreateTeamRequest>({
    name: '',
    short_code: '',
    logo_url: '',
  })
  const queryClient = useQueryClient()

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll().then(res => res.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateTeamRequest) => teamsApi.create(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      setShowModal(false)
      setFormData({ name: '', short_code: '', logo_url: '' })
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
          <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
          <p className="mt-2 text-gray-600">Manage your teams</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Team
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading teams...</p>
        </div>
      ) : teams && teams.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No teams yet</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            Create Your First Team
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Logo</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Team</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Short Code</th>
                </tr>
              </thead>
              <tbody>
                {teams?.map(team => (
                  <tr key={team.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="relative h-10 w-10">
                        {team.logo_url ? (
                          <img
                            src={team.logo_url}
                            alt={team.name}
                            className="h-10 w-10 object-contain"
                            onError={(e) => {

                              const img = e.target as HTMLImageElement
                              img.style.display = 'none'
                              const fallback = img.parentElement?.querySelector('.logo-fallback') as HTMLElement
                              if (fallback) fallback.style.display = 'flex'
                            }}
                          />
                        ) : null}
                        <div
                          className={`logo-fallback h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center ${team.logo_url ? 'hidden' : 'flex'}`}
                        >
                          <span className="text-primary-600 font-bold text-sm">{team.short_code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{team.name}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{team.short_code}</td>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Team</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Team Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Short Code</label>
                <input
                  type="text"
                  className="input"
                  value={formData.short_code}
                  onChange={(e) => setFormData({ ...formData, short_code: e.target.value.toUpperCase() })}
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <label className="label">Logo URL (optional)</label>
                <input
                  type="url"
                  className="input"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                />
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
