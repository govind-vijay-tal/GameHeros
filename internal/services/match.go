package services

import (
	"database/sql"

	"gameheros/internal/models"
	"gameheros/internal/repo"
	"gameheros/internal/rules"

	"github.com/google/uuid"
)

type MatchService struct {
	matchRepo      *repo.MatchRepo
	tournamentRepo *repo.TournamentRepo
	teamRepo       *repo.TeamRepo
}

func NewMatchService(matchRepo *repo.MatchRepo, tournamentRepo *repo.TournamentRepo, teamRepo *repo.TeamRepo) *MatchService {
	return &MatchService{
		matchRepo:      matchRepo,
		tournamentRepo: tournamentRepo,
		teamRepo:       teamRepo,
	}
}

func (s *MatchService) Create(tournamentID string, req models.CreateMatchRequest) (*models.MatchResponse, error) {
	tID, err := rules.ValidateUUID(tournamentID, "tournament")
	if err != nil {
		return nil, err
	}

	teamAID, err := rules.ValidateUUID(req.TeamAID, "team")
	if err != nil {
		return nil, err
	}

	teamBID, err := rules.ValidateUUID(req.TeamBID, "team")
	if err != nil {
		return nil, err
	}

	if teamAID == teamBID {
		return nil, rules.ErrTeamPlayAgainstItself
	}

	startTime, err := rules.ParseTime(req.StartTime)
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
	_ = tournament

	teamCount, err := s.teamRepo.CountByIDs(teamAID, teamBID)
	if err != nil {
		return nil, err
	}
	if teamCount != 2 {
		return nil, rules.ErrTeamsNotFound
	}

	tournamentTeamCount, err := s.tournamentRepo.CountTeamsInTournament(tID, teamAID, teamBID)
	if err != nil {
		return nil, err
	}
	if tournamentTeamCount != 2 {
		return nil, rules.ErrTeamsNotInTournament
	}

	exists, err := s.matchRepo.ExistsSameDay(tID, teamAID, teamBID, startTime)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, rules.ErrDuplicateMatchSameDay
	}

	match := &models.Match{
		ID:           uuid.New(),
		TournamentID: tID,
		TeamAID:      teamAID,
		TeamBID:      teamBID,
		StartTime:    startTime,
		Status:       "SCHEDULED",
		ScoreSummary: models.JSONB{},
		Version:      1,
	}

	if err := s.matchRepo.Create(match); err != nil {
		return nil, err
	}

	return s.matchRepo.GetByID(match.ID)
}

func (s *MatchService) GetByID(id string) (*models.MatchResponse, error) {
	matchID, err := rules.ValidateUUID(id, "match")
	if err != nil {
		return nil, err
	}

	match, err := s.matchRepo.GetByID(matchID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, rules.ErrMatchNotFound
		}
		return nil, err
	}

	return match, nil
}

func (s *MatchService) GetAll() ([]models.MatchResponse, error) {
	return s.matchRepo.GetAll()
}

func (s *MatchService) GetEvents(id string) ([]models.MatchEvent, error) {
	matchID, err := rules.ValidateUUID(id, "match")
	if err != nil {
		return nil, err
	}

	return s.matchRepo.GetEvents(matchID)
}

func (s *MatchService) GetLiveScore(id string) (*models.MatchResponse, error) {
	return s.GetByID(id)
}
