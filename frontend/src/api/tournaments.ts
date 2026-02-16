import api from './client'
import { Team } from './teams'
import { Player } from './players'

export interface Tournament {
  id: string
  name: string
  sport_type: 'CRICKET' | 'FOOTBALL' | 'BADMINTON'
  start_date: string
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED'
  team_count?: number
  config?: {
    players_per_team?: number
    overs_per_match?: number
    match_duration_minutes?: number
    sets_to_win?: number
  }
}

export interface CreateTournamentRequest {
  name: string
  sport_type: 'CRICKET' | 'FOOTBALL' | 'BADMINTON'
}

export interface PlayerStats {
  [key: string]: number | string | undefined

  runs?: number
  wickets?: number
  matches?: number

}

export interface LeaderboardEntry {
  id: string
  tournament_id: string
  player_id: string
  player_name: string
  team_name: string
  team_code: string
  stats: PlayerStats
}

export const tournamentsApi = {
  getAll: () => api.get<Tournament[]>('/tournaments'),
  getById: (id: string) => api.get<Tournament>(`/tournaments/${id}`),
  create: (data: CreateTournamentRequest) => api.post<Tournament>('/tournaments', data),
  getLeaderboard: (id: string) => api.get<LeaderboardEntry[]>(`/tournaments/${id}/leaderboard`),
  recalculateLeaderboard: (id: string) => api.post(`/tournaments/${id}/leaderboard/recalculate`),
  getTeams: (id: string) => api.get<Team[]>(`/tournaments/${id}/teams`),
  getTeamPlayers: (tournamentId: string, teamId: string) =>
    api.get<Player[]>(`/tournaments/${tournamentId}/teams/${teamId}/players`),
  getAvailablePlayers: (tournamentId: string) =>
    api.get<Player[]>(`/tournaments/${tournamentId}/available-players`),
  removePlayerFromTeam: (tournamentId: string, teamId: string, playerId: string) =>
    api.delete(`/tournaments/${tournamentId}/teams/${teamId}/players/${playerId}`),
  updateConfig: (tournamentId: string, config: Tournament['config']) =>
    api.put<Tournament>(`/tournaments/${tournamentId}/config`, { config }),
  isLocked: (tournamentId: string) =>
    api.get<{ is_locked: boolean }>(`/tournaments/${tournamentId}/locked`),
}
