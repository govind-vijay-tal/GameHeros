import api from './client'
import { Team } from './teams'

export interface Tournament {
  id: string
  name: string
  sport_type: 'CRICKET' | 'FOOTBALL' | 'BADMINTON'
  start_date: string
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED'
  team_count?: number
}

export interface CreateTournamentRequest {
  name: string
  sport_type: 'CRICKET' | 'FOOTBALL' | 'BADMINTON'
}

export const tournamentsApi = {
  getAll: () => api.get<Tournament[]>('/tournaments'),
  getById: (id: string) => api.get<Tournament>(`/tournaments/${id}`),
  create: (data: CreateTournamentRequest) => api.post<Tournament>('/tournaments', data),
  getLeaderboard: (id: string) => api.get(`/tournaments/${id}/leaderboard`),
  getTeams: (id: string) => api.get<Team[]>(`/tournaments/${id}/teams`),
}
