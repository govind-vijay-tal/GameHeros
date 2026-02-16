package services

import (
	"database/sql"
	"encoding/json"
	"log"
	"strings"
	"time"

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
	playerRepo     *repo.PlayerRepo
	statsSvc       *MatchStatsService
}

func NewMatchService(matchRepo *repo.MatchRepo, tournamentRepo *repo.TournamentRepo, teamRepo *repo.TeamRepo, playerRepo *repo.PlayerRepo, statsSvc *MatchStatsService) *MatchService {
	return &MatchService{
		matchRepo:      matchRepo,
		tournamentRepo: tournamentRepo,
		teamRepo:       teamRepo,
		playerRepo:     playerRepo,
		statsSvc:       statsSvc,
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

	if tournament.Config != nil && len(tournament.Config) > 0 {
		if playersPerTeam, ok := tournament.Config["players_per_team"].(float64); ok {
			requiredPlayers := int(playersPerTeam)

			teamAPlayers, err := s.getTeamPlayerCount(tID, teamAID)
			if err != nil {
				return nil, err
			}
			if teamAPlayers < requiredPlayers {
				return nil, rules.ErrInsufficientPlayers
			}

			teamBPlayers, err := s.getTeamPlayerCount(tID, teamBID)
			if err != nil {
				return nil, err
			}
			if teamBPlayers < requiredPlayers {
				return nil, rules.ErrInsufficientPlayers
			}
		}
	}

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

	match, sportType, config, err := s.matchRepo.GetMatchWithTournament(matchID)
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

	configMap := make(map[string]interface{})
	if config != nil && len(config) > 0 {
		if configBytes, err := json.Marshal(config); err == nil {
			if err := json.Unmarshal(configBytes, &configMap); err != nil {
				log.Printf("[MatchService] Error unmarshaling config: %v", err)
			} else {
				log.Printf("[MatchService] Using config for match %s: %+v", matchID, configMap)
			}
		}
	} else {
		log.Printf("[MatchService] No config found for match %s, using defaults", matchID)
	}

	configMap["team_a_short_code"] = match.TeamAShortCode
	configMap["team_b_short_code"] = match.TeamBShortCode
	state, err := manager.StartMatch(matchID, sportType, match.TeamAID, match.TeamBID, configMap)
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

	if s.statsSvc != nil {
		stats, err := s.statsSvc.CalculateMatchStats(matchID, sportType, state)
		if err != nil {
			log.Printf("[MatchService] Error calculating initial stats: %v", err)
		} else {
			if err := s.statsSvc.SaveMatchStats(matchID, stats); err != nil {
				log.Printf("[MatchService] Error saving initial stats: %v", err)
			}
		}
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

		if match.ScoreSummary != nil {
			stateBytes, err := json.Marshal(match.ScoreSummary)
			if err == nil {
				if err := manager.LoadMatchState(matchID, "CRICKET", stateBytes); err != nil {
					log.Printf("[MatchService] Error loading match state: %v", err)
					return nil, nil, rules.ErrMatchNotLive
				}

			}
		} else {
			return nil, nil, rules.ErrMatchNotLive
		}
	}

	currentState, err := manager.GetLiveState(matchID)
	if err != nil {
		return nil, nil, err
	}

	var currentInnings int = 1
	if cricketState, ok := currentState.(*scoring.CricketState); ok {
		currentInnings = cricketState.Innings
	}

	eventDataWithInnings := make(map[string]interface{})
	for k, v := range eventData {
		eventDataWithInnings[k] = v
	}
	eventDataWithInnings["innings"] = currentInnings

	event := scoring.Event{
		Type:    eventType,
		Payload: eventDataWithInnings,
	}

	state, err := manager.RecordEvent(matchID, event)
	if err != nil {
		return nil, nil, err
	}

	matchEvent := &models.MatchEvent{
		MatchID:   matchID,
		EventType: eventType,
		EventData: eventDataWithInnings,
	}

	var events []models.MatchEvent
	var stats models.JSONB

	if err := s.matchRepo.SaveEvent(matchEvent); err != nil {
		log.Printf("[MatchService] Error persisting event: %v", err)
	} else {

		events, err = s.matchRepo.GetEvents(matchID)
		if err != nil {
			log.Printf("[MatchService] Error fetching events: %v", err)
		}
	}

	stateJSONB, err := scoring.StateToJSONB(state)
	if err != nil {
		log.Printf("[MatchService] Error converting state to JSONB: %v", err)
	} else {
		if err := s.matchRepo.UpdateScoreSummary(matchID, stateJSONB, 0); err != nil {
			log.Printf("[MatchService] Error persisting score summary: %v", err)
		}
	}

	if s.statsSvc != nil {
		_, sportType, _, err := s.matchRepo.GetMatchWithTournament(matchID)
		if err == nil {
			calculatedStats, err := s.statsSvc.CalculateMatchStats(matchID, sportType, state)
			if err != nil {
				log.Printf("[MatchService] Error calculating live stats: %v", err)
			} else {
				if err := s.statsSvc.SaveMatchStats(matchID, calculatedStats); err != nil {
					log.Printf("[MatchService] Error saving live stats: %v", err)
				} else {
					stats = calculatedStats
				}
			}
		}
	}

	if state.IsGameOver() {

		matchInfo, err := s.matchRepo.GetByID(matchID)
		if err != nil {
			log.Printf("[MatchService] Error getting match info for result formatting: %v", err)
		}

		if cricketState, ok := state.(*scoring.CricketState); ok && matchInfo != nil {
			result := cricketState.Result

			if matchInfo.TeamAShortCode != "" {
				result = strings.ReplaceAll(result, "Team A", matchInfo.TeamAShortCode)
			}
			if matchInfo.TeamBShortCode != "" {
				result = strings.ReplaceAll(result, "Team B", matchInfo.TeamBShortCode)
			}
			cricketState.Result = result
		}

		if err := s.matchRepo.UpdateStatus(matchID, "COMPLETED"); err != nil {
			log.Printf("[MatchService] Error updating match status to COMPLETED: %v", err)
		} else {

			manager := scoring.GetMatchManager()
			if _, err := manager.EndMatch(matchID); err != nil && err != scoring.ErrMatchNotFound {
				log.Printf("[MatchService] Error ending match in manager: %v", err)
			}

			hub := scoring.GetHub()
			result := ""
			if cricketState, ok := state.(*scoring.CricketState); ok {
				result = cricketState.Result
			}
			hub.BroadcastToMatch(matchID, scoring.MsgTypeMatchEnded, map[string]interface{}{
				"state":  state,
				"score":  state.GetScore(),
				"result": result,
			})
		}
	}

	hub := scoring.GetHub()
	hub.BroadcastToMatch(matchID, scoring.MsgTypeMatchUpdate, map[string]interface{}{
		"state":  state,
		"score":  state.GetScore(),
		"events": events,
		"stats":  stats,
	})

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

		if s.statsSvc != nil {
			_, sportType, _, err := s.matchRepo.GetMatchWithTournament(matchID)
			if err == nil {
				stats, err := s.statsSvc.CalculateMatchStats(matchID, sportType, state)
				if err != nil {
					log.Printf("[MatchService] Error calculating match stats: %v", err)
				} else {
					if err := s.statsSvc.SaveMatchStats(matchID, stats); err != nil {
						log.Printf("[MatchService] Error saving match stats: %v", err)
					}
				}
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

func (s *MatchService) Update(matchID string, req models.UpdateMatchRequest) (*models.MatchResponse, error) {
	mID, err := rules.ValidateUUID(matchID, "match")
	if err != nil {
		return nil, err
	}

	match, err := s.matchRepo.GetByID(mID)
	if err != nil {
		return nil, err
	}

	if match.Status != "SCHEDULED" {
		return nil, rules.ErrMatchNotScheduled
	}

	var teamAID, teamBID *uuid.UUID
	var startTime *time.Time

	if req.TeamAID != "" {
		tID, err := rules.ValidateUUID(req.TeamAID, "team")
		if err != nil {
			return nil, err
		}
		teamAID = &tID
	}

	if req.TeamBID != "" {
		tID, err := rules.ValidateUUID(req.TeamBID, "team")
		if err != nil {
			return nil, err
		}
		teamBID = &tID
	}

	if req.StartTime != "" {
		t, err := rules.ParseTime(req.StartTime)
		if err != nil {
			return nil, err
		}
		startTime = &t
	}

	if teamAID == nil {
		teamAID = &match.TeamAID
	}
	if teamBID == nil {
		teamBID = &match.TeamBID
	}
	if startTime == nil {
		startTime = &match.StartTime
	}

	if *teamAID == *teamBID {
		return nil, rules.ErrTeamPlayAgainstItself
	}

	tournamentTeamCount, err := s.tournamentRepo.CountTeamsInTournament(match.TournamentID, *teamAID, *teamBID)
	if err != nil {
		return nil, err
	}
	if tournamentTeamCount != 2 {
		return nil, rules.ErrTeamsNotInTournament
	}

	exists, err := s.matchRepo.ExistsSameDayExcluding(match.TournamentID, *teamAID, *teamBID, *startTime, mID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, rules.ErrDuplicateMatchSameDay
	}

	tournament, err := s.tournamentRepo.GetByID(match.TournamentID)
	if err != nil {
		return nil, err
	}

	if tournament.Config != nil && len(tournament.Config) > 0 {
		if playersPerTeam, ok := tournament.Config["players_per_team"].(float64); ok {
			requiredPlayers := int(playersPerTeam)

			teamAPlayers, err := s.getTeamPlayerCount(match.TournamentID, *teamAID)
			if err != nil {
				return nil, err
			}
			if teamAPlayers < requiredPlayers {
				return nil, rules.ErrInsufficientPlayers
			}

			teamBPlayers, err := s.getTeamPlayerCount(match.TournamentID, *teamBID)
			if err != nil {
				return nil, err
			}
			if teamBPlayers < requiredPlayers {
				return nil, rules.ErrInsufficientPlayers
			}
		}
	}

	if err := s.matchRepo.Update(mID, teamAID, teamBID, startTime); err != nil {
		return nil, err
	}

	return s.matchRepo.GetByID(mID)
}

func (s *MatchService) Delete(matchID string) error {
	mID, err := rules.ValidateUUID(matchID, "match")
	if err != nil {
		return err
	}

	match, err := s.matchRepo.GetByID(mID)
	if err != nil {
		return err
	}

	if match.Status != "SCHEDULED" {
		return rules.ErrMatchNotScheduled
	}

	return s.matchRepo.Delete(mID)
}

func (s *MatchService) GetMatchStats(matchID string) (*models.MatchStats, error) {
	mID, err := rules.ValidateUUID(matchID, "match")
	if err != nil {
		return nil, err
	}

	if s.statsSvc == nil {
		return nil, rules.ErrMatchNotFound
	}

	stats, err := s.statsSvc.GetMatchStats(mID)
	if err != nil {
		return nil, err
	}

	if stats == nil {
		match, err := s.matchRepo.GetByID(mID)
		if err != nil {
			return nil, err
		}

		if match.Status == "SCHEDULED" {
			return nil, rules.ErrMatchNotFound
		}

		manager := scoring.GetMatchManager()
		var state scoring.MatchState
		if match.Status == "LIVE" && manager.IsMatchLive(mID) {
			state, err = manager.GetLiveState(mID)
			if err != nil {
				return nil, err
			}
		} else {

			if match.ScoreSummary == nil {
				return nil, rules.ErrMatchNotFound
			}
			stateBytes, err := json.Marshal(match.ScoreSummary)
			if err != nil {
				return nil, err
			}
			_, sportType, _, err := s.matchRepo.GetMatchWithTournament(mID)
			if err != nil {
				return nil, err
			}
			engine, err := scoring.GetEngine(sportType)
			if err != nil {
				return nil, err
			}
			state, err = engine.LoadState(stateBytes)
			if err != nil {
				return nil, err
			}
		}

		_, sportType, _, err := s.matchRepo.GetMatchWithTournament(mID)
		if err != nil {
			return nil, err
		}
		statsData, err := s.statsSvc.CalculateMatchStats(mID, sportType, state)
		if err != nil {
			return nil, err
		}
		if err := s.statsSvc.SaveMatchStats(mID, statsData); err != nil {
			return nil, err
		}

		return s.statsSvc.GetMatchStats(mID)
	}

	return stats, nil
}
