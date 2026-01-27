package services

import (
	"database/sql"

	"gameheros/internal/models"
	"gameheros/internal/repo"
	"gameheros/internal/rules"

	"github.com/google/uuid"
)

type PlayerService struct {
	playerRepo *repo.PlayerRepo
	teamRepo   *repo.TeamRepo
}

func NewPlayerService(playerRepo *repo.PlayerRepo, teamRepo *repo.TeamRepo) *PlayerService {
	return &PlayerService{
		playerRepo: playerRepo,
		teamRepo:   teamRepo,
	}
}

func (s *PlayerService) AddToTeam(teamID string, req models.AddPlayerRequest) (*models.Player, error) {
	tmID, err := rules.ValidateUUID(teamID, "team")
	if err != nil {
		return nil, err
	}

	name := rules.NormalizeName(req.Name)
	role := rules.NormalizeRole(req.Role)

	if err := rules.ValidateName(name, 2); err != nil {
		return nil, err
	}

	if err := rules.ValidateRole(role); err != nil {
		return nil, err
	}

	_, err = s.teamRepo.GetByID(tmID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, rules.ErrTeamNotFound
		}
		return nil, err
	}

	exists, err := s.playerRepo.ExistsInTeam(tmID, name)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, rules.ErrDuplicatePlayer
	}

	player := &models.Player{
		ID:     uuid.New(),
		TeamID: tmID,
		Name:   name,
	}

	if role != "" {
		player.Role = models.NullString{NullString: sql.NullString{String: role, Valid: true}}
	}

	if err := s.playerRepo.Create(player); err != nil {
		return nil, err
	}

	return player, nil
}

func (s *PlayerService) GetProfile(id string) (*models.PlayerProfile, error) {
	playerID, err := rules.ValidateUUID(id, "player")
	if err != nil {
		return nil, err
	}

	profile, err := s.playerRepo.GetProfile(playerID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, rules.ErrPlayerNotFound
		}
		return nil, err
	}

	stats, err := s.playerRepo.GetLatestStats(playerID)
	if err == nil {
		profile.Stats = stats
	}

	return profile, nil
}
