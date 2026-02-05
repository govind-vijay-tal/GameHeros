package services

import (
	"database/sql"
	"log"

	"gameheros/internal/models"
	"gameheros/internal/repo"
	"gameheros/internal/rules"
	"gameheros/internal/scoring"

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

func (s *MatchService) StartMatch(id string) (*models.MatchResponse, scoring.MatchState, error) {
	matchID, err := rules.ValidateUUID(id, "match")
	if err != nil {
		return nil, nil, err
	}

	match, sportType, err := s.matchRepo.GetMatchWithTournament(matchID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil, rules.ErrMatchNotFound
		}
		return nil, nil, err
	}

	if match.Status == "LIVE" {
		return nil, nil, rules.ErrMatchAlreadyLive
	}

	if match.Status == "COMPLETED" {
		return nil, nil, rules.ErrMatchAlreadyCompleted
	}

	if err := s.matchRepo.UpdateStatus(matchID, "LIVE"); err != nil {
		return nil, nil, err
	}

	manager := scoring.GetMatchManager()
	state, err := manager.StartMatch(matchID, sportType, match.TeamAID, match.TeamBID)
	if err != nil {
		return nil, nil, err
	}

	stateJSONB, err := scoring.StateToJSONB(state)
	if err != nil {
		return nil, nil, err
	}
	if err := s.matchRepo.UpdateScoreSummary(matchID, stateJSONB, 1); err != nil {
		log.Printf("[MatchService] Error persisting initial state: %v", err)
	}

	match.Status = "LIVE"
	match.ScoreSummary = stateJSONB

	return match, state, nil
}

func (s *MatchService) RecordEvent(id string, eventType string, eventData map[string]interface{}) (*models.MatchResponse, scoring.MatchState, error) {
	matchID, err := rules.ValidateUUID(id, "match")
	if err != nil {
		return nil, nil, err
	}

	manager := scoring.GetMatchManager()
	if !manager.IsMatchLive(matchID) {

		match, err := s.matchRepo.GetByIDSimple(matchID)
		if err != nil {
			if err == sql.ErrNoRows {
				return nil, nil, rules.ErrMatchNotFound
			}
			return nil, nil, err
		}
		if match.Status != "LIVE" {
			return nil, nil, rules.ErrMatchNotLive
		}
		return nil, nil, rules.ErrMatchNotLive
	}

	event := scoring.Event{
		Type:    eventType,
		Payload: eventData,
	}

	state, err := manager.RecordEvent(matchID, event)
	if err != nil {
		return nil, nil, err
	}

	matchEvent := &models.MatchEvent{
		MatchID:   matchID,
		EventType: eventType,
		EventData: eventData,
	}
	if err := s.matchRepo.SaveEvent(matchEvent); err != nil {
		log.Printf("[MatchService] Error persisting event: %v", err)
	}

	stateJSONB, err := scoring.StateToJSONB(state)
	if err != nil {
		log.Printf("[MatchService] Error converting state to JSONB: %v", err)
	} else {
		if err := s.matchRepo.UpdateScoreSummary(matchID, stateJSONB, 0); err != nil {
			log.Printf("[MatchService] Error persisting score summary: %v", err)
		}
	}

	match, err := s.matchRepo.GetByID(matchID)
	if err != nil {
		return nil, state, nil
	}

	return match, state, nil
}

func (s *MatchService) EndMatch(id string) (*models.MatchResponse, scoring.MatchState, error) {
	matchID, err := rules.ValidateUUID(id, "match")
	if err != nil {
		return nil, nil, err
	}

	manager := scoring.GetMatchManager()

	state, err := manager.EndMatch(matchID)
	if err != nil && err != scoring.ErrMatchNotFound {
		return nil, nil, err
	}

	if err := s.matchRepo.UpdateStatus(matchID, "COMPLETED"); err != nil {
		return nil, nil, err
	}

	if state != nil {
		stateJSONB, err := scoring.StateToJSONB(state)
		if err != nil {
			log.Printf("[MatchService] Error converting final state to JSONB: %v", err)
		} else {
			if err := s.matchRepo.UpdateScoreSummary(matchID, stateJSONB, 0); err != nil {
				log.Printf("[MatchService] Error persisting final score summary: %v", err)
			}
		}
	}

	match, err := s.matchRepo.GetByID(matchID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil, rules.ErrMatchNotFound
		}
		return nil, nil, err
	}

	return match, state, nil
}
