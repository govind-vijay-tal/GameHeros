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
  team_b: string
  status: string
  score: string
  score_detail: Record<string, any>
  is_game_over: boolean
}

export const matchesApi = {
  getAll: () => api.get<Match[]>('/matches'),
  getById: (id: string) => api.get<Match>(`/matches/${id}`),
  create: (tournamentId: string, data: CreateMatchRequest) => 
    api.post<Match>(`/tournaments/${tournamentId}/matches`, data),
  start: (id: string) => api.post(`/matches/${id}/start`),
  end: (id: string) => api.post(`/matches/${id}/end`),
  getEvents: (id: string) => api.get<MatchEvent[]>(`/matches/${id}/events`),
  recordEvent: (id: string, data: RecordEventRequest) => 
    api.post(`/matches/${id}/events`, data),
  getLiveScore: (id: string) => api.get<LiveScore>(`/matches/${id}/score`),
}
