import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Calendar, Play } from 'lucide-react'
import { matchesApi } from '../api/matches'
const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return `${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

export default function Matches() {
  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => matchesApi.getAll().then(res => res.data),
  })

  if (isLoading) {
    return <div className="text-center py-12">Loading matches...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
        <p className="mt-2 text-gray-600">View and manage matches</p>
      </div>

      {matches && matches.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No matches yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches?.map(match => (
            <Link
              key={match.id}
              to={`/matches/${match.id}`}
              className="card hover:shadow-lg transition-shadow block"
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                      <span className="font-bold text-lg text-primary-600">{match.team_a_short_code || 'TBA'}</span>
                      <span className="text-gray-400 text-sm">vs</span>
                      <span className="font-bold text-lg text-primary-600">{match.team_b_short_code || 'TBA'}</span>
                    </div>
                    <div className="border-l pl-4 ml-2">
                      <p className="font-medium text-gray-900">
                        {match.team_a_name || 'Team A'} vs {match.team_b_name || 'Team B'}
                      </p>
                      <p className="text-sm text-gray-500">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        {formatDateTime(match.start_time)}
                        {match.tournament_name && (
                          <span className="ml-2 text-primary-600">• {match.tournament_name}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`px-4 py-2 text-sm font-medium rounded-full ${
                    match.status === 'LIVE' ? 'bg-red-100 text-red-800' :
                    match.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {match.status}
                  </span>
                  {match.status === 'LIVE' && (
                    <Link
                      to={`/matches/${match.id}/scoring`}
                      onClick={(e) => e.stopPropagation()}
                      className="btn btn-primary flex items-center"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Score
                    </Link>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
