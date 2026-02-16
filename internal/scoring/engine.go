package scoring

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
)

type MatchState interface {
	GetScore() string

	IsGameOver() bool

	ToJSON() ([]byte, error)

	GetSportType() string
}

type Event struct {
	Type       string                 `json:"type"`
	Payload    map[string]interface{} `json:"payload"`
	SequenceID int                    `json:"sequence_id,omitempty"`
}

type RuleEngine interface {
	Validate(currentState MatchState, event Event) error

	Apply(currentState MatchState, event Event) (MatchState, error)

	InitState(teamAID, teamBID uuid.UUID, config map[string]interface{}) MatchState

	LoadState(data []byte) (MatchState, error)

	GetSupportedEvents() []string
}

type EngineFactory struct {
	engines map[string]RuleEngine
	mu      sync.RWMutex
}

var factory = &EngineFactory{
	engines: make(map[string]RuleEngine),
}

func RegisterEngine(sportType string, engine RuleEngine) {
	factory.mu.Lock()
	defer factory.mu.Unlock()
	factory.engines[sportType] = engine
}

func GetEngine(sportType string) (RuleEngine, error) {
	factory.mu.RLock()
	defer factory.mu.RUnlock()

	engine, exists := factory.engines[sportType]
	if !exists {
		return nil, fmt.Errorf("no rule engine registered for sport: %s", sportType)
	}
	return engine, nil
}

func GetSupportedSports() []string {
	factory.mu.RLock()
	defer factory.mu.RUnlock()

	sports := make([]string, 0, len(factory.engines))
	for sport := range factory.engines {
		sports = append(sports, sport)
	}
	return sports
}

func StateToJSONB(state MatchState) (map[string]interface{}, error) {
	data, err := state.ToJSON()
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return result, nil
}
