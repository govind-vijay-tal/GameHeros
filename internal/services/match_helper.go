package services

import (
	"github.com/google/uuid"
)

func (s *MatchService) getTeamPlayerCount(tournamentID, teamID uuid.UUID) (int, error) {
	players, err := s.playerRepo.GetPlayersInTeamForTournament(tournamentID, teamID)
	if err != nil {
		return 0, err
	}
	return len(players), nil
}
