import api from './client'

export interface Match {
  id: string
  tournament_id: string
  team_a_id: string
  team_b_id: string
  start_time: string
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED'
  score_summary: Record<string, any>
  version: number

  team_a_name?: string
  team_a_short_code?: string
  team_b_name?: string
  team_b_short_code?: string
  tournament_name?: string
}

export interface CreateMatchRequest {
  team_a_id: string
  team_b_id: string
  start_time: string
}

export interface MatchEvent {
  id: number
  match_id: string
  event_type: string
  created_at: string
  event_data: Record<string, any>
}

export interface RecordEventRequest {
  event_type: string
  event_data: Record<string, any>
}

export interface LiveScore {
  match_id: string
  team_a: string
  team_a_code: string
  team_b: string
  team_b_code: string
  tournament: string
  status: string
  score: Record<string, any>
  score_detail: Record<string, any>
  is_live: boolean
}

export interface CricketState {
  sport_type: 'CRICKET'
  team_a_id: string
  team_b_id: string
  batting_team_id: string
  innings: number
  team_a_runs: number
  team_a_wickets: number
  team_a_overs: number
  team_b_runs: number
  team_b_wickets: number
  team_b_overs: number
  current_over: number
  current_ball: number
  balls_in_over: number
  total_overs: number
  max_wickets: number
  is_live: boolean
  is_over: boolean
  target?: number
  result?: string
}

export interface WSMessage {
  type: 'SCORE_UPDATE' | 'MATCH_STARTED' | 'MATCH_ENDED' | 'ERROR' | 'INITIAL_STATE' | 'MATCH_UPDATE'
  match_id: string
  payload: any
  timestamp: number
}

export const getWebSocketUrl = (matchId: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  const host = window.location.host
  return `${protocol}//${host}/ws/matches/${matchId}`
}

export interface UpdateMatchRequest {
  team_a_id?: string
  team_b_id?: string
  start_time?: string
}

export const matchesApi = {
  getAll: () => api.get<Match[]>('/matches'),
  getById: (id: string) => api.get<Match>(`/matches/${id}`),
  create: (tournamentId: string, data: CreateMatchRequest) =>
    api.post<Match>(`/tournaments/${tournamentId}/matches`, data),
  update: (id: string, data: UpdateMatchRequest) =>
    api.put<Match>(`/matches/${id}`, data),
  delete: (id: string) => api.delete(`/matches/${id}`),
  start: (id: string) => api.post(`/matches/${id}/start`),
  end: (id: string) => api.post(`/matches/${id}/end`),
  getEvents: (id: string) => api.get<MatchEvent[]>(`/matches/${id}/events`),
  recordEvent: (id: string, data: RecordEventRequest) =>
    api.post(`/matches/${id}/events`, data),
  getLiveScore: (id: string) => api.get<LiveScore>(`/matches/${id}/score`),
  getStats: (id: string) => api.get<MatchStats>(`/matches/${id}/stats`),
}

export interface MatchStats {
  id: string
  match_id: string
  stats: {
    team_a: {
      runs: number
      wickets: number
      overs: number
      fours: number
      sixes: number
      extras: number
    }
    team_b: {
      runs: number
      wickets: number
      overs: number
      fours: number
      sixes: number
      extras: number
    }
    result?: string
    man_of_the_match?: string
    man_of_the_match_score?: number
    player_stats?: Record<string, {
      runs: number
      wickets: number
      fours: number
      sixes: number
      balls: number
      runs_conceded?: number
      score: number
    }>
  }
  created_at: string
  updated_at: string
}
