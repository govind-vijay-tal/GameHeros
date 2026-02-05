package scoring

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
)

const (
	EventBallBowled = "BALL_BOWLED"
	EventWicket     = "WICKET"
	EventWide       = "WIDE"
	EventNoBall     = "NO_BALL"
	EventOverEnd    = "OVER_END"
	EventInningsEnd = "INNINGS_END"
)

type CricketState struct {
	SportType     string    `json:"sport_type"`
	TeamAID       uuid.UUID `json:"team_a_id"`
	TeamBID       uuid.UUID `json:"team_b_id"`
	BattingTeamID uuid.UUID `json:"batting_team_id"`

	Innings int `json:"innings"`

	TeamARuns    int     `json:"team_a_runs"`
	TeamAWickets int     `json:"team_a_wickets"`
	TeamAOvers   float64 `json:"team_a_overs"`

	TeamBRuns    int     `json:"team_b_runs"`
	TeamBWickets int     `json:"team_b_wickets"`
	TeamBOvers   float64 `json:"team_b_overs"`

	CurrentOver  int `json:"current_over"`
	CurrentBall  int `json:"current_ball"`
	TotalOvers   int `json:"total_overs"`
	MaxWickets   int `json:"max_wickets"`
	ExtrasInOver int `json:"extras_in_over"`
	BallsInOver  int `json:"balls_in_over"`

	IsLive bool   `json:"is_live"`
	IsOver bool   `json:"is_over"`
	Result string `json:"result,omitempty"`
	Target int    `json:"target,omitempty"`
}

func (s *CricketState) GetScore() string {
	if s.Innings == 1 {
		return fmt.Sprintf("%d/%d (%.1f)", s.TeamARuns, s.TeamAWickets, s.TeamAOvers)
	}
	return fmt.Sprintf("%d/%d (%.1f) | Target: %d", s.TeamBRuns, s.TeamBWickets, s.TeamBOvers, s.Target)
}

func (s *CricketState) IsGameOver() bool {
	return s.IsOver
}

func (s *CricketState) ToJSON() ([]byte, error) {
	return json.Marshal(s)
}

func (s *CricketState) GetSportType() string {
	return "CRICKET"
}

type CricketRules struct{}

func NewCricketRules() *CricketRules {
	return &CricketRules{}
}

func (r *CricketRules) GetSupportedEvents() []string {
	return []string{EventBallBowled, EventWicket, EventWide, EventNoBall, EventInningsEnd}
}

func (r *CricketRules) InitState(teamAID, teamBID uuid.UUID) MatchState {
	return &CricketState{
		SportType:     "CRICKET",
		TeamAID:       teamAID,
		TeamBID:       teamBID,
		BattingTeamID: teamAID,
		Innings:       1,
		TotalOvers:    20,
		MaxWickets:    10,
		IsLive:        true,
	}
}

func (r *CricketRules) LoadState(data []byte) (MatchState, error) {
	var state CricketState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (r *CricketRules) Validate(currentState MatchState, event Event) error {
	state, ok := currentState.(*CricketState)
	if !ok {
		return errors.New("invalid state type for cricket")
	}

	if !state.IsLive {
		return errors.New("match is not live")
	}

	if state.IsOver {
		return errors.New("match is already over")
	}

	switch event.Type {
	case EventBallBowled:
		runs, ok := event.Payload["runs"]
		if !ok {
			return errors.New("runs required for BALL_BOWLED event")
		}
		runsInt, ok := toInt(runs)
		if !ok || runsInt < 0 || runsInt > 6 {
			return errors.New("runs must be between 0 and 6")
		}

	case EventWicket, EventWide, EventNoBall, EventInningsEnd:

	default:
		return fmt.Errorf("unsupported event type: %s", event.Type)
	}

	return nil
}

func (r *CricketRules) Apply(currentState MatchState, event Event) (MatchState, error) {
	state, ok := currentState.(*CricketState)
	if !ok {
		return nil, errors.New("invalid state type for cricket")
	}

	newState := *state

	switch event.Type {
	case EventBallBowled:
		runs, _ := toInt(event.Payload["runs"])
		r.applyBall(&newState, runs)

	case EventWicket:
		r.applyWicket(&newState)

	case EventWide:
		r.applyWide(&newState)

	case EventNoBall:
		r.applyNoBall(&newState)

	case EventInningsEnd:
		r.endInnings(&newState)
	}

	r.checkMatchConditions(&newState)

	return &newState, nil
}

func (r *CricketRules) applyBall(state *CricketState, runs int) {

	if state.Innings == 1 {
		state.TeamARuns += runs
	} else {
		state.TeamBRuns += runs
	}

	state.BallsInOver++
	state.CurrentBall++

	r.updateOvers(state)
}

func (r *CricketRules) applyWicket(state *CricketState) {
	if state.Innings == 1 {
		state.TeamAWickets++
	} else {
		state.TeamBWickets++
	}

	state.BallsInOver++
	state.CurrentBall++
	r.updateOvers(state)
}

func (r *CricketRules) applyWide(state *CricketState) {

	if state.Innings == 1 {
		state.TeamARuns++
	} else {
		state.TeamBRuns++
	}
	state.ExtrasInOver++

}

func (r *CricketRules) applyNoBall(state *CricketState) {

	if state.Innings == 1 {
		state.TeamARuns++
	} else {
		state.TeamBRuns++
	}
	state.ExtrasInOver++

}

func (r *CricketRules) updateOvers(state *CricketState) {

	if state.BallsInOver >= 6 {
		state.CurrentOver++
		state.CurrentBall = 0
		state.BallsInOver = 0
		state.ExtrasInOver = 0
	}

	if state.Innings == 1 {
		state.TeamAOvers = float64(state.CurrentOver) + float64(state.BallsInOver)/10.0
	} else {
		state.TeamBOvers = float64(state.CurrentOver) + float64(state.BallsInOver)/10.0
	}
}

func (r *CricketRules) checkMatchConditions(state *CricketState) {
	currentWickets := state.TeamAWickets
	currentOvers := state.TeamAOvers
	if state.Innings == 2 {
		currentWickets = state.TeamBWickets
		currentOvers = state.TeamBOvers
	}

	oversComplete := int(currentOvers) >= state.TotalOvers && state.BallsInOver == 0
	allOut := currentWickets >= state.MaxWickets

	if state.Innings == 1 && (oversComplete || allOut) {
		r.endInnings(state)
	} else if state.Innings == 2 {

		if state.TeamBRuns > state.Target-1 {
			state.IsOver = true
			state.IsLive = false
			wicketsRemaining := state.MaxWickets - state.TeamBWickets
			state.Result = fmt.Sprintf("Team B won by %d wickets", wicketsRemaining)
		} else if oversComplete || allOut {

			state.IsOver = true
			state.IsLive = false
			if state.TeamARuns > state.TeamBRuns {
				runsDiff := state.TeamARuns - state.TeamBRuns
				state.Result = fmt.Sprintf("Team A won by %d runs", runsDiff)
			} else if state.TeamARuns == state.TeamBRuns {
				state.Result = "Match tied"
			}
		}
	}
}

func (r *CricketRules) endInnings(state *CricketState) {
	if state.Innings == 1 {
		state.Innings = 2
		state.Target = state.TeamARuns + 1
		state.BattingTeamID = state.TeamBID
		state.CurrentOver = 0
		state.CurrentBall = 0
		state.BallsInOver = 0
		state.ExtrasInOver = 0
	} else {

		state.IsOver = true
		state.IsLive = false
		if state.TeamARuns > state.TeamBRuns {
			runsDiff := state.TeamARuns - state.TeamBRuns
			state.Result = fmt.Sprintf("Team A won by %d runs", runsDiff)
		} else if state.TeamBRuns > state.TeamARuns {
			wicketsRemaining := state.MaxWickets - state.TeamBWickets
			state.Result = fmt.Sprintf("Team B won by %d wickets", wicketsRemaining)
		} else {
			state.Result = "Match tied"
		}
	}
}

func toInt(v interface{}) (int, bool) {
	switch val := v.(type) {
	case int:
		return val, true
	case float64:
		return int(val), true
	case int64:
		return int(val), true
	default:
		return 0, false
	}
}

func init() {
	RegisterEngine("CRICKET", NewCricketRules())
}
