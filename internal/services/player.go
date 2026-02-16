package services

import (
	"database/sql"

	"gameheros/internal/models"
	"gameheros/internal/repo"
	"gameheros/internal/rules"

	"github.com/google/uuid"
)

type PlayerService struct {
	playerRepo     *repo.PlayerRepo
	teamRepo       *repo.TeamRepo
	tournamentRepo *repo.TournamentRepo
}

func NewPlayerService(playerRepo *repo.PlayerRepo, teamRepo *repo.TeamRepo, tournamentRepo *repo.TournamentRepo) *PlayerService {
	return &PlayerService{
		playerRepo:     playerRepo,
		teamRepo:       teamRepo,
		tournamentRepo: tournamentRepo,
	}
}

func (s *PlayerService) Create(req models.CreatePlayerRequest) (*models.Player, error) {
	name := rules.NormalizeName(req.Name)
	sportType := rules.NormalizeSportType(req.SportType)

	if err := rules.ValidateName(name, 2); err != nil {
		return nil, err
	}

	if err := rules.ValidateSportType(sportType); err != nil {
		return nil, err
	}

	exists, err := s.playerRepo.ExistsByName(name)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, rules.ErrDuplicatePlayer
	}

	player := &models.Player{
		ID:        uuid.New(),
		Name:      name,
		SportType: sportType,
	}

	if req.Role != "" {
		role := rules.NormalizeRole(req.Role)
		if err := rules.ValidateRoleForSport(role, sportType); err != nil {
			return nil, err
		}
		player.Role = models.NullString{NullString: sql.NullString{String: role, Valid: true}}
	}

	if err := s.playerRepo.Create(player); err != nil {
		return nil, err
	}

	return player, nil
}

func (s *PlayerService) GetAll() ([]models.Player, error) {
	return s.playerRepo.GetAll()
}

func (s *PlayerService) UpdateName(playerID, name string) (*models.Player, error) {
	pID, err := rules.ValidateUUID(playerID, "player")
	if err != nil {
		return nil, err
	}

	normalizedName := rules.NormalizeName(name)
	if err := rules.ValidateName(normalizedName, 2); err != nil {
		return nil, err
	}

	player, err := s.playerRepo.GetByID(pID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, rules.ErrPlayerNotFound
		}
		return nil, err
	}

	if err := s.playerRepo.UpdateName(pID, normalizedName); err != nil {
		return nil, err
	}

	player.Name = normalizedName
	return player, nil
}

func (s *PlayerService) UpdateRole(playerID, role string) (*models.Player, error) {
	pID, err := rules.ValidateUUID(playerID, "player")
	if err != nil {
		return nil, err
	}

	player, err := s.playerRepo.GetByID(pID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, rules.ErrPlayerNotFound
		}
		return nil, err
	}

	if role != "" {
		normalizedRole := rules.NormalizeRole(role)
		if err := rules.ValidateRoleForSport(normalizedRole, player.SportType); err != nil {
			return nil, err
		}
		if err := s.playerRepo.UpdateRole(pID, normalizedRole); err != nil {
			return nil, err
		}
		player.Role = models.NullString{NullString: sql.NullString{String: normalizedRole, Valid: true}}
	} else {
		if err := s.playerRepo.UpdateRole(pID, ""); err != nil {
			return nil, err
		}
		player.Role = models.NullString{NullString: sql.NullString{Valid: false}}
	}

	return player, nil
}

func (s *PlayerService) GetByID(playerID string) (*models.Player, error) {
	pID, err := rules.ValidateUUID(playerID, "player")
	if err != nil {
		return nil, err
	}
	return s.playerRepo.GetByID(pID)
}

func (s *PlayerService) GetBySportType(sportType string) ([]models.Player, error) {
	normalized := rules.NormalizeSportType(sportType)
	if err := rules.ValidateSportType(normalized); err != nil {
		return nil, err
	}
	return s.playerRepo.GetBySportType(normalized)
}

func (s *PlayerService) AddToTeamInTournament(tournamentID, teamID, playerID string) error {
	tID, err := rules.ValidateUUID(tournamentID, "tournament")
	if err != nil {
		return err
	}

	tmID, err := rules.ValidateUUID(teamID, "team")
	if err != nil {
		return err
	}

	pID, err := rules.ValidateUUID(playerID, "player")
	if err != nil {
		return err
	}

	_, err = s.tournamentRepo.GetByID(tID)
	if err != nil {
		if err == sql.ErrNoRows {
			return rules.ErrTournamentNotFound
		}
		return err
	}

	_, err = s.teamRepo.GetByID(tmID)
	if err != nil {
		if err == sql.ErrNoRows {
			return rules.ErrTeamNotFound
		}
		return err
	}

	player, err := s.playerRepo.GetByID(pID)
	if err != nil {
		if err == sql.ErrNoRows {
			return rules.ErrPlayerNotFound
		}
		return err
	}

	tournament, err := s.tournamentRepo.GetByID(tID)
	if err != nil {
		return err
	}

	if player.SportType != tournament.SportType {
		return rules.ErrInvalidSportType
	}

	inTeam, existingTeamID, err := s.playerRepo.IsPlayerInTournamentTeam(tID, pID)
	if err != nil {
		return err
	}
	if inTeam {
		if existingTeamID == tmID {
			return rules.ErrPlayerAlreadyInTeam
		}
		return rules.ErrPlayerInDifferentTeam
	}

	return s.playerRepo.AddPlayerToTeamInTournament(tID, tmID, pID)
}

func (s *PlayerService) RemoveFromTeamInTournament(tournamentID, teamID, playerID string) error {
	tID, err := rules.ValidateUUID(tournamentID, "tournament")
	if err != nil {
		return err
	}

	tmID, err := rules.ValidateUUID(teamID, "team")
	if err != nil {
		return err
	}

	pID, err := rules.ValidateUUID(playerID, "player")
	if err != nil {
		return err
	}

	return s.playerRepo.RemovePlayerFromTeamInTournament(tID, tmID, pID)
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

func (s *PlayerService) GetTeamPlayersInTournament(tournamentID, teamID string) ([]models.Player, error) {
	tID, err := rules.ValidateUUID(tournamentID, "tournament")
	if err != nil {
		return nil, err
	}

	tmID, err := rules.ValidateUUID(teamID, "team")
	if err != nil {
		return nil, err
	}

	return s.playerRepo.GetPlayersInTeamForTournament(tID, tmID)
}

func (s *PlayerService) GetAvailablePlayersForTournament(tournamentID string) ([]models.Player, error) {
	tID, err := rules.ValidateUUID(tournamentID, "tournament")
	if err != nil {
		return nil, err
	}

	tournament, err := s.tournamentRepo.GetByID(tID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, rules.ErrTournamentNotFound
		}
		return nil, err
	}

	return s.playerRepo.GetAvailablePlayersForTournament(tID, tournament.SportType)
}
