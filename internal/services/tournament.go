package services

import (
	"database/sql"
	"time"

	"gameheros/internal/models"
	"gameheros/internal/repo"
	"gameheros/internal/rules"

	"github.com/google/uuid"
)

type TournamentService struct {
	tournamentRepo *repo.TournamentRepo
	teamRepo       *repo.TeamRepo
}

func NewTournamentService(tournamentRepo *repo.TournamentRepo, teamRepo *repo.TeamRepo) *TournamentService {
	return &TournamentService{
		tournamentRepo: tournamentRepo,
		teamRepo:       teamRepo,
	}
}

func (s *TournamentService) Create(req models.CreateTournamentRequest) (*models.Tournament, error) {
	sportType := rules.NormalizeSportType(req.SportType)
	if err := rules.ValidateSportType(sportType); err != nil {
		return nil, err
	}

	name := rules.NormalizeName(req.Name)
	if err := rules.ValidateName(name, 2); err != nil {
		return nil, err
	}

	exists, err := s.tournamentRepo.ExistsByName(name)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, rules.ErrDuplicateTournament
	}

	config := req.Config
	if config == nil {
		config = models.JSONB{}
	}

	tournament := &models.Tournament{
		ID:        uuid.New(),
		Name:      name,
		SportType: sportType,
		StartDate: time.Now(),
		Status:    "UPCOMING",
		Config:    config,
	}

	if err := s.tournamentRepo.Create(tournament); err != nil {
		return nil, err
	}

	return tournament, nil
}

func (s *TournamentService) GetByID(id string) (*models.TournamentResponse, error) {
	tournamentID, err := rules.ValidateUUID(id, "tournament")
	if err != nil {
		return nil, err
	}

	tournament, err := s.tournamentRepo.GetByID(tournamentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, rules.ErrTournamentNotFound
		}
		return nil, err
	}

	return tournament, nil
}

func (s *TournamentService) GetAll() ([]models.TournamentResponse, error) {
	return s.tournamentRepo.GetAll()
}

func (s *TournamentService) GetLeaderboard(id string) ([]models.LeaderboardEntry, error) {
	tournamentID, err := rules.ValidateUUID(id, "tournament")
	if err != nil {
		return nil, err
	}

	return s.tournamentRepo.GetLeaderboard(tournamentID)
}

func (s *TournamentService) AddTeam(tournamentID, teamID string) (*models.Team, error) {
	tID, err := rules.ValidateUUID(tournamentID, "tournament")
	if err != nil {
		return nil, err
	}

	tmID, err := rules.ValidateUUID(teamID, "team")
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

	if tournament.Status == "COMPLETED" {
		return nil, rules.ErrTournamentCompleted
	}

	team, err := s.teamRepo.GetByID(tmID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, rules.ErrTeamNotFound
		}
		return nil, err
	}

	exists, err := s.tournamentRepo.TeamExistsInTournament(tID, tmID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, rules.ErrTeamAlreadyInTournament
	}

	if err := s.tournamentRepo.AddTeam(tID, tmID); err != nil {
		return nil, err
	}

	return team, nil
}

func (s *TournamentService) GetTeams(id string) ([]models.Team, error) {
	tournamentID, err := rules.ValidateUUID(id, "tournament")
	if err != nil {
		return nil, err
	}

	return s.tournamentRepo.GetTeams(tournamentID)
}

func (s *TournamentService) RecalculateLeaderboard(id string) error {
	tournamentID, err := rules.ValidateUUID(id, "tournament")
	if err != nil {
		return err
	}

	_, err = s.tournamentRepo.GetByID(tournamentID)
	if err != nil {
		if err == sql.ErrNoRows {
			return rules.ErrTournamentNotFound
		}
		return err
	}

	return s.tournamentRepo.CalculateLeaderboard(tournamentID)
}
