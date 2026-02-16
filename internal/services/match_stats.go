package services

import (
	"encoding/json"
	"log"

	"gameheros/internal/models"
	"gameheros/internal/repo"
	"gameheros/internal/scoring"

	"github.com/google/uuid"
)

type MatchStatsService struct {
	statsRepo *repo.MatchStatsRepo
	eventRepo *repo.MatchRepo
}

func NewMatchStatsService(statsRepo *repo.MatchStatsRepo, eventRepo *repo.MatchRepo) *MatchStatsService {
	return &MatchStatsService{
		statsRepo: statsRepo,
		eventRepo: eventRepo,
	}
}

func (s *MatchStatsService) CalculateMatchStats(matchID uuid.UUID, sportType string, finalState scoring.MatchState) (models.JSONB, error) {

	events, err := s.eventRepo.GetEvents(matchID)
	if err != nil {
		return nil, err
	}

	switch sportType {
	case "CRICKET":
		return s.calculateCricketStats(events, finalState)
	default:

		return models.JSONB{}, nil
	}
}

func (s *MatchStatsService) calculateCricketStats(events []models.MatchEvent, finalState scoring.MatchState) (models.JSONB, error) {
	stats := models.JSONB{
		"team_a": models.JSONB{
			"runs":    0,
			"wickets": 0,
			"overs":   0.0,
			"fours":   0,
			"sixes":   0,
			"extras":  0,
		},
		"team_b": models.JSONB{
			"runs":    0,
			"wickets": 0,
			"overs":   0.0,
			"fours":   0,
			"sixes":   0,
			"extras":  0,
		},
		"player_stats": models.JSONB{},
	}

	stateJSON, err := finalState.ToJSON()
	if err != nil {
		log.Printf("[MatchStatsService] Error converting state to JSON: %v", err)
		return stats, nil
	}

	var stateMap map[string]interface{}
	if err := json.Unmarshal(stateJSON, &stateMap); err != nil {
		log.Printf("[MatchStatsService] Error unmarshaling state: %v", err)
		return stats, nil
	}

	teamAStats := stats["team_a"].(models.JSONB)
	teamBStats := stats["team_b"].(models.JSONB)

	if teamARuns, ok := stateMap["team_a_runs"].(float64); ok {
		teamAStats["runs"] = int(teamARuns)
	}
	if teamAWickets, ok := stateMap["team_a_wickets"].(float64); ok {
		teamAStats["wickets"] = int(teamAWickets)
	}
	if teamAOvers, ok := stateMap["team_a_overs"].(float64); ok {
		teamAStats["overs"] = teamAOvers
	}

	if teamBRuns, ok := stateMap["team_b_runs"].(float64); ok {
		teamBStats["runs"] = int(teamBRuns)
	}
	if teamBWickets, ok := stateMap["team_b_wickets"].(float64); ok {
		teamBStats["wickets"] = int(teamBWickets)
	}
	if teamBOvers, ok := stateMap["team_b_overs"].(float64); ok {
		teamBStats["overs"] = teamBOvers
	}

	stats["team_a"] = teamAStats
	stats["team_b"] = teamBStats

	if result, ok := stateMap["result"].(string); ok && result != "" {
		stats["result"] = result
	}

	teamAFours := 0
	teamASixes := 0
	teamAExtras := 0
	teamBFours := 0
	teamBSixes := 0
	teamBExtras := 0

	playerStats := make(map[string]models.JSONB)

	for _, event := range events {

		eventInnings := 1
		if innings, ok := event.EventData["innings"].(float64); ok {
			eventInnings = int(innings)
		} else if innings, ok := event.EventData["innings"].(int); ok {
			eventInnings = innings
		}
		switch event.EventType {
		case "BALL_BOWLED":
			if runs, ok := event.EventData["runs"].(float64); ok {
				runsInt := int(runs)
				if eventInnings == 1 {
					if runsInt == 4 {
						teamAFours++
					} else if runsInt == 6 {
						teamASixes++
					}
				} else if eventInnings == 2 {
					if runsInt == 4 {
						teamBFours++
					} else if runsInt == 6 {
						teamBSixes++
					}
				}

				if batterID, ok := event.EventData["batter_id"].(string); ok && batterID != "" {
					if _, exists := playerStats[batterID]; !exists {
						playerStats[batterID] = models.JSONB{
							"runs":          0,
							"wickets":       0,
							"fours":         0,
							"sixes":         0,
							"balls":         0,
							"runs_conceded": 0,
							"score":         0.0,
						}
					}
					pStats := playerStats[batterID]
					if r, ok := pStats["runs"].(int); ok {
						pStats["runs"] = r + runsInt
					}
					if b, ok := pStats["balls"].(int); ok {
						pStats["balls"] = b + 1
					}
					if runsInt == 4 {
						if f, ok := pStats["fours"].(int); ok {
							pStats["fours"] = f + 1
						}
					} else if runsInt == 6 {
						if s, ok := pStats["sixes"].(int); ok {
							pStats["sixes"] = s + 1
						}
					}
					playerStats[batterID] = pStats
				}

				if bowlerID, ok := event.EventData["bowler_id"].(string); ok && bowlerID != "" {
					if _, exists := playerStats[bowlerID]; !exists {
						playerStats[bowlerID] = models.JSONB{
							"runs":          0,
							"wickets":       0,
							"fours":         0,
							"sixes":         0,
							"balls":         0,
							"runs_conceded": 0,
							"score":         0.0,
						}
					}
					pStats := playerStats[bowlerID]
					if rc, ok := pStats["runs_conceded"].(int); ok {
						pStats["runs_conceded"] = rc + runsInt
					}
					playerStats[bowlerID] = pStats
				}
			}
		case "WICKET":

			if bowlerID, ok := event.EventData["bowler_id"].(string); ok && bowlerID != "" {
				if _, exists := playerStats[bowlerID]; !exists {
					playerStats[bowlerID] = models.JSONB{
						"runs":          0,
						"wickets":       0,
						"fours":         0,
						"sixes":         0,
						"balls":         0,
						"runs_conceded": 0,
						"score":         0.0,
					}
				}
				pStats := playerStats[bowlerID]
				if w, ok := pStats["wickets"].(int); ok {
					pStats["wickets"] = w + 1
				}
				playerStats[bowlerID] = pStats
			}
		case "WIDE", "NO_BALL":
			if eventInnings == 1 {
				teamAExtras++
			} else if eventInnings == 2 {
				teamBExtras++
			}

			if bowlerID, ok := event.EventData["bowler_id"].(string); ok && bowlerID != "" {
				if _, exists := playerStats[bowlerID]; !exists {
					playerStats[bowlerID] = models.JSONB{
						"runs":          0,
						"wickets":       0,
						"fours":         0,
						"sixes":         0,
						"balls":         0,
						"runs_conceded": 0,
						"score":         0.0,
					}
				}
				pStats := playerStats[bowlerID]
				if rc, ok := pStats["runs_conceded"].(int); ok {
					pStats["runs_conceded"] = rc + 1
				}
				playerStats[bowlerID] = pStats
			}
		case "INNINGS_END":

		}
	}

	teamAStats["fours"] = teamAFours
	teamAStats["sixes"] = teamASixes
	teamAStats["extras"] = teamAExtras

	teamBStats["fours"] = teamBFours
	teamBStats["sixes"] = teamBSixes
	teamBStats["extras"] = teamBExtras

	stats["team_a"] = teamAStats
	stats["team_b"] = teamBStats

	teamAStats["fours"] = teamAFours
	teamAStats["sixes"] = teamASixes
	teamAStats["extras"] = teamAExtras

	teamBStats["fours"] = teamBFours
	teamBStats["sixes"] = teamBSixes
	teamBStats["extras"] = teamBExtras

	stats["team_a"] = teamAStats
	stats["team_b"] = teamBStats

	var maxScore float64 = 0
	var motmPlayerID string = ""

	for playerID, pStats := range playerStats {
		runs := 0
		if r, ok := pStats["runs"].(int); ok {
			runs = r
		}
		wickets := 0
		if w, ok := pStats["wickets"].(int); ok {
			wickets = w
		}
		fours := 0
		if f, ok := pStats["fours"].(int); ok {
			fours = f
		}
		sixes := 0
		if s, ok := pStats["sixes"].(int); ok {
			sixes = s
		}
		runsConceded := 0
		if rc, ok := pStats["runs_conceded"].(int); ok {
			runsConceded = rc
		}

		score := float64(runs) + (float64(wickets) * 25) + (float64(fours) * 1) + (float64(sixes) * 2) - (float64(runsConceded) / 10)
		pStats["score"] = score
		playerStats[playerID] = pStats

		if score > maxScore {
			maxScore = score
			motmPlayerID = playerID
		}
	}

	stats["player_stats"] = playerStats
	if motmPlayerID != "" {
		stats["man_of_the_match"] = motmPlayerID
		stats["man_of_the_match_score"] = maxScore
	}

	return stats, nil
}

func (s *MatchStatsService) SaveMatchStats(matchID uuid.UUID, stats models.JSONB) error {
	return s.statsRepo.Upsert(matchID, stats)
}

func (s *MatchStatsService) GetMatchStats(matchID uuid.UUID) (*models.MatchStats, error) {
	return s.statsRepo.GetByMatchID(matchID)
}
