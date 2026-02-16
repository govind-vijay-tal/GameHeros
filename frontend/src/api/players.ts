import api from './client'

export interface Player {
  id: string
  name: string
  sport_type: 'CRICKET' | 'FOOTBALL' | 'BADMINTON'
  role?: string
  team_id?: string
}

export interface CreatePlayerRequest {
  name: string
  sport_type: 'CRICKET' | 'FOOTBALL' | 'BADMINTON'
  role?: string
}

export interface AddPlayerToTeamRequest {
  player_id: string
}

export interface UpdatePlayerRequest {
  name?: string
  role?: string
}

export const playersApi = {
  getAll: (sportType?: string) => {
    const params = sportType ? `?sport_type=${sportType}` : ''
    return api.get<Player[]>(`/players${params}`)
  },
  getById: (id: string) => api.get<Player>(`/players/${id}`),
  create: (data: CreatePlayerRequest) => api.post<Player>('/players', data),
  update: (id: string, data: UpdatePlayerRequest) => api.put<Player>(`/players/${id}`, data),
  getProfile: (id: string) => api.get(`/players/${id}/profile`),
  addToTeamInTournament: (tournamentId: string, teamId: string, playerId: string) =>
    api.post(`/tournaments/${tournamentId}/teams/${teamId}/players`, { player_id: playerId }),
}
