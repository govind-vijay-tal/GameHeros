import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trophy, Users, Calendar, TrendingUp } from 'lucide-react'
import { tournamentsApi } from '../api/tournaments'
import { matchesApi } from '../api/matches'
import { teamsApi } from '../api/teams'

export default function Dashboard() {
  const { data: tournaments } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => tournamentsApi.getAll().then(res => res.data),
  })

  const { data: matches } = useQuery({
    queryKey: ['matches'],
    queryFn: () => matchesApi.getAll().then(res => res.data),
  })

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll().then(res => res.data),
  })

  const liveMatches = matches?.filter(m => m.status === 'LIVE') || []
  const upcomingMatches = matches?.filter(m => m.status === 'SCHEDULED') || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome to GameHeros</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-primary-100 rounded-lg p-3">
              <Trophy className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tournaments</p>
              <p className="text-2xl font-bold text-gray-900">{tournaments?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Live Matches</p>
              <p className="text-2xl font-bold text-gray-900">{liveMatches.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Teams</p>
              <p className="text-2xl font-bold text-gray-900">{teams?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 rounded-lg p-3">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Upcoming</p>
              <p className="text-2xl font-bold text-gray-900">{upcomingMatches.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Live Matches</h2>
          {liveMatches.length === 0 ? (
            <p className="text-gray-500">No live matches</p>
          ) : (
            <div className="space-y-3">
              {liveMatches.map(match => (
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
                      <p className="text-sm text-gray-500">{match.team_a_name} vs {match.team_b_name}</p>
                    </div>
                    <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                      LIVE
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Tournaments</h2>
          {tournaments && tournaments.length === 0 ? (
            <p className="text-gray-500">No tournaments yet</p>
          ) : (
            <div className="space-y-3">
              {tournaments?.slice(0, 5).map(tournament => (
                <Link
                  key={tournament.id}
                  to={`/tournaments/${tournament.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{tournament.name}</p>
                      <p className="text-sm text-gray-500">{tournament.sport_type}</p>
                    </div>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      tournament.status === 'LIVE' ? 'bg-red-100 text-red-800' :
                      tournament.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {tournament.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
