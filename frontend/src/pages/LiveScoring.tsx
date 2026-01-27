import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save } from 'lucide-react'
import { matchesApi, RecordEventRequest } from '../api/matches'

export default function LiveScoring() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: liveScore, refetch } = useQuery({
    queryKey: ['liveScore', id],
    queryFn: () => matchesApi.getLiveScore(id!).then(res => res.data),
    enabled: !!id,
    refetchInterval: 2000, 
  })

  const recordEventMutation = useMutation({
    mutationFn: (data: RecordEventRequest) => matchesApi.recordEvent(id!, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liveScore', id] })
      queryClient.invalidateQueries({ queryKey: ['match', id] })
    },
  })

  const handleEvent = (eventType: string, eventData: Record<string, any>) => {
    recordEventMutation.mutate({ event_type: eventType, event_data: eventData })
  }

  if (!liveScore) {
    return <div className="text-center py-12">Loading match...</div>
  }

  const sportType = liveScore.score_detail?.sport_type || 'CRICKET'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/matches/${id}`)}
          className="inline-flex items-center text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Match
        </button>
        <div className="text-sm text-gray-500">
          {liveScore.team_a} vs {liveScore.team_b}
        </div>
      </div>

      <div className="card">
        <div className="text-center mb-8">
          <div className="text-sm text-red-600 font-medium mb-2">LIVE</div>
          <div className="text-5xl font-bold text-gray-900 mb-4">{liveScore.score}</div>
          <div className="text-lg text-gray-600">
            {liveScore.team_a} vs {liveScore.team_b}
          </div>
        </div>

        {sportType === 'CRICKET' && (
          <CricketScoringPanel onEvent={handleEvent} isLoading={recordEventMutation.isPending} />
        )}
        {sportType === 'FOOTBALL' && (
          <FootballScoringPanel onEvent={handleEvent} isLoading={recordEventMutation.isPending} />
        )}
        {sportType === 'BADMINTON' && (
          <BadmintonScoringPanel onEvent={handleEvent} isLoading={recordEventMutation.isPending} />
        )}
      </div>
    </div>
  )
}

function CricketScoringPanel({ onEvent, isLoading }: { onEvent: (type: string, data: Record<string, any>) => void; isLoading: boolean }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-900">Cricket Scoring</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3, 4, 6].map(runs => (
          <button
            key={runs}
            onClick={() => onEvent('BALL_BOWLED', { runs })}
            disabled={isLoading}
            className="btn btn-primary text-lg py-4"
          >
            {runs} {runs === 1 ? 'Run' : 'Runs'}
          </button>
        ))}
        <button
          onClick={() => onEvent('WICKET', {})}
          disabled={isLoading}
          className="btn btn-danger col-span-2 py-4"
        >
          Wicket
        </button>
        <button
          onClick={() => onEvent('WIDE', {})}
          disabled={isLoading}
          className="btn btn-secondary py-4"
        >
          Wide
        </button>
        <button
          onClick={() => onEvent('NO_BALL', {})}
          disabled={isLoading}
          className="btn btn-secondary py-4"
        >
          No Ball
        </button>
      </div>
    </div>
  )
}

function FootballScoringPanel({ onEvent, isLoading }: { onEvent: (type: string, data: Record<string, any>) => void; isLoading: boolean }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-900">Football Scoring</h3>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onEvent('GOAL', { team: 'HOME' })}
          disabled={isLoading}
          className="btn btn-primary py-4"
        >
          Home Goal
        </button>
        <button
          onClick={() => onEvent('GOAL', { team: 'AWAY' })}
          disabled={isLoading}
          className="btn btn-primary py-4"
        >
          Away Goal
        </button>
        <button
          onClick={() => onEvent('CARD', { card: 'YELLOW' })}
          disabled={isLoading}
          className="btn btn-secondary py-4"
        >
          Yellow Card
        </button>
        <button
          onClick={() => onEvent('CARD', { card: 'RED' })}
          disabled={isLoading}
          className="btn btn-danger py-4"
        >
          Red Card
        </button>
      </div>
    </div>
  )
}

function BadmintonScoringPanel({ onEvent, isLoading }: { onEvent: (type: string, data: Record<string, any>) => void; isLoading: boolean }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-900">Badminton Scoring</h3>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onEvent('POINT', { team: 'HOME' })}
          disabled={isLoading}
          className="btn btn-primary py-4"
        >
          Home Point
        </button>
        <button
          onClick={() => onEvent('POINT', { team: 'AWAY' })}
          disabled={isLoading}
          className="btn btn-primary py-4"
        >
          Away Point
        </button>
      </div>
    </div>
  )
}
