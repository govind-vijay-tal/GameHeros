package services

import (
	"gameheros/internal/models"
	"gameheros/internal/rules"
)

func (s *TournamentService) UpdateConfig(tournamentID string, req models.UpdateTournamentConfigRequest) (*models.Tournament, error) {
	tID, err := rules.ValidateUUID(tournamentID, "tournament")
	if err != nil {
		return nil, err
	}

	hasMatches, err := s.tournamentRepo.HasMatches(tID)
	if err != nil {
		return nil, err
	}
	if hasMatches {
		return nil, rules.ErrTournamentConfigLocked
	}

	tournament, err := s.tournamentRepo.GetByID(tID)
	if err != nil {
		return nil, err
	}

	if err := s.validateConfig(tournament.SportType, req.Config); err != nil {
		return nil, err
	}

	if err := s.tournamentRepo.UpdateConfig(tID, req.Config); err != nil {
		return nil, err
	}

	updated, err := s.tournamentRepo.GetByID(tID)
	if err != nil {
		return nil, err
	}

	return &updated.Tournament, nil
}

func (s *TournamentService) validateConfig(sportType string, config models.JSONB) error {
	switch sportType {
	case "CRICKET":
		if players, ok := config["players_per_team"].(float64); !ok || players < 1 {
			return rules.ErrInvalidConfig
		}
		if overs, ok := config["overs_per_match"].(float64); !ok || overs < 1 {
			return rules.ErrInvalidConfig
		}
	case "FOOTBALL":
		if players, ok := config["players_per_team"].(float64); !ok || players < 1 {
			return rules.ErrInvalidConfig
		}
		if duration, ok := config["match_duration_minutes"].(float64); !ok || duration < 1 {
			return rules.ErrInvalidConfig
		}
	case "BADMINTON":
		if players, ok := config["players_per_team"].(float64); !ok || players < 1 {
			return rules.ErrInvalidConfig
		}
		if sets, ok := config["sets_to_win"].(float64); !ok || sets < 1 {
			return rules.ErrInvalidConfig
		}
	default:
		return rules.ErrInvalidSportType
	}
	return nil
}

func (s *TournamentService) IsLocked(tournamentID string) (bool, error) {
	tID, err := rules.ValidateUUID(tournamentID, "tournament")
	if err != nil {
		return false, err
	}
	return s.tournamentRepo.HasMatches(tID)
}
