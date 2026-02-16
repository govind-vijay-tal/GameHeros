import api from './client'

export interface Team {
  id: string
  name: string
  short_code: string
  logo_url?: string
}

export interface CreateTeamRequest {
  name: string
  short_code: string
  logo_url?: string
}

export const teamsApi = {
  getAll: () => api.get<Team[]>('/teams'),
  create: (data: CreateTeamRequest) => api.post<Team>('/teams', data),
  addToTournament: (tournamentId: string, teamId: string) =>
    api.post(`/tournaments/${tournamentId}/teams`, { team_id: teamId }),
}
