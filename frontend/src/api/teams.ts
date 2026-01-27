import api from './client'

export interface Team {
  id: string
  name: string
  short_code: string
  logo_url?: string
}

export interface TeamWithPlayers {
  id: string
  name: string
  short_code: string
  logo_url?: string
  players: Player[]
}

export interface CreateTeamRequest {
  name: string
  short_code: string
  logo_url?: string
}

export interface Player {
  id: string
  team_id: string
  name: string
  role?: string
}

export interface AddPlayerRequest {
  name: string
  role?: string
}

export const teamsApi = {
  getAll: () => api.get<Team[]>('/teams'),
  getById: (id: string) => api.get<TeamWithPlayers>(`/teams/${id}`),
  create: (data: CreateTeamRequest) => api.post<Team>('/teams', data),
  addPlayer: (teamId: string, data: AddPlayerRequest) => api.post<Player>(`/teams/${teamId}/players`, data),
  addToTournament: (tournamentId: string, teamId: string) => 
    api.post(`/tournaments/${tournamentId}/teams`, { team_id: teamId }),
}
