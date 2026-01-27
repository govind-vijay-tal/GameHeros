import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Play, RefreshCw } from 'lucide-react'
import { matchesApi } from '../api/matches'
import { format } from 'date-fns'

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: () => matchesApi.getById(id!).then(res => res.data),
    enabled: !!id,
  })

  const { data: liveScore, refetch } = useQuery({
    queryKey: ['liveScore', id],
    queryFn: () => matchesApi.getLiveScore(id!).then(res => res.data),
    enabled: !!id && match?.status === 'LIVE',
    refetchInterval: 5000, 
  })

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!match) {
    return <div className="text-center py-12">Match not found</div>
  }

  return (
    <div className="space-y-6">
      <Link to="/matches" className="inline-flex items-center text-primary-600 hover:text-primary-700">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Matches
      </Link>

      <div className="card">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Match {match.id.slice(0, 8)}</h1>
            <p className="text-gray-600 mt-2">
              {format(new Date(match.start_time), 'PPp')}
            </p>
          </div>
          <div className="flex space-x-3">
            {match.status === 'LIVE' && (
              <Link
                to={`/matches/${match.id}/scoring`}
                className="btn btn-primary flex items-center"
              >
                <Play className="h-4 w-4 mr-2" />
                Live Scoring
              </Link>
            )}
            {match.status === 'LIVE' && (
              <button
                onClick={() => refetch()}
                className="btn btn-secondary flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            )}
          </div>
        </div>

        {match.status === 'LIVE' && liveScore && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-6 mb-6">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-2">LIVE SCORE</div>
              <div className="text-4xl font-bold text-gray-900 mb-2">{liveScore.score}</div>
              <div className="text-lg text-gray-600">
                {liveScore.team_a} vs {liveScore.team_b}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-lg font-semibold text-gray-900">{match.status}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Version</p>
            <p className="text-lg font-semibold text-gray-900">{match.version}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
