package services

import (
	"database/sql"

	"gameheros/internal/models"
	"gameheros/internal/repo"
	"gameheros/internal/rules"

	"github.com/google/uuid"
)

type TeamService struct {
	teamRepo *repo.TeamRepo
}

func NewTeamService(teamRepo *repo.TeamRepo) *TeamService {
	return &TeamService{
		teamRepo: teamRepo,
	}
}

func (s *TeamService) Create(req models.CreateTeamRequest) (*models.Team, error) {
	name := rules.NormalizeName(req.Name)
	shortCode := rules.NormalizeShortCode(req.ShortCode)

	if err := rules.ValidateName(name, 2); err != nil {
		return nil, err
	}

	if err := rules.ValidateShortCode(shortCode); err != nil {
		return nil, err
	}

	exists, err := s.teamRepo.ExistsByNameOrCode(name, shortCode)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, rules.ErrDuplicateTeam
	}

	team := &models.Team{
		ID:        uuid.New(),
		Name:      name,
		ShortCode: shortCode,
	}

	if req.LogoURL != "" {
		team.LogoURL = models.NullString{NullString: sql.NullString{String: req.LogoURL, Valid: true}}
	}

	if err := s.teamRepo.Create(team); err != nil {
		return nil, err
	}

	return team, nil
}

func (s *TeamService) GetByID(id string) (*models.TeamWithPlayers, error) {
	teamID, err := rules.ValidateUUID(id, "team")
	if err != nil {
		return nil, err
	}

	teamResp, err := s.teamRepo.GetByIDWithCount(teamID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, rules.ErrTeamNotFound
		}
		return nil, err
	}

	players, _ := s.teamRepo.GetPlayers(teamID)

	return &models.TeamWithPlayers{
		Team:    teamResp.Team,
		Players: players,
	}, nil
}

func (s *TeamService) GetAll() ([]models.TeamResponse, error) {
	return s.teamRepo.GetAll()
}
