package scoring

import (
	"encoding/json"
	"errors"
	"sync"

	"github.com/google/uuid"
)

var (
	ErrMatchNotLive   = errors.New("match is not live")
	ErrMatchNotFound  = errors.New("match not found in live matches")
	ErrInvalidPayload = errors.New("invalid event payload")
)

type LiveMatch struct {
	MatchID   uuid.UUID
	SportType string
	State     MatchState
	Engine    RuleEngine
	LastSeqID int
	mu        sync.RWMutex
}

type MatchManager struct {
	liveMatches map[uuid.UUID]*LiveMatch
	mu          sync.RWMutex
	hub         *Hub
}

var manager *MatchManager

func GetMatchManager() *MatchManager {
	if manager == nil {
		manager = &MatchManager{
			liveMatches: make(map[uuid.UUID]*LiveMatch),
			hub:         GetHub(),
		}
	}
	return manager
}

func (m *MatchManager) StartMatch(matchID uuid.UUID, sportType string, teamAID, teamBID uuid.UUID, config map[string]interface{}) (MatchState, error) {
	engine, err := GetEngine(sportType)
	if err != nil {
		return nil, err
	}

	state := engine.InitState(teamAID, teamBID, config)

	liveMatch := &LiveMatch{
		MatchID:   matchID,
		SportType: sportType,
		State:     state,
		Engine:    engine,
		LastSeqID: 0,
	}

	m.mu.Lock()
	m.liveMatches[matchID] = liveMatch
	m.mu.Unlock()

	m.hub.BroadcastToMatch(matchID, MsgTypeMatchStarted, state)

	return state, nil
}

func (m *MatchManager) RecordEvent(matchID uuid.UUID, event Event) (MatchState, error) {
	m.mu.RLock()
	liveMatch, exists := m.liveMatches[matchID]
	m.mu.RUnlock()

	if !exists {
		return nil, ErrMatchNotFound
	}

	liveMatch.mu.Lock()
	defer liveMatch.mu.Unlock()

	if err := liveMatch.Engine.Validate(liveMatch.State, event); err != nil {
		return nil, err
	}

	newState, err := liveMatch.Engine.Apply(liveMatch.State, event)
	if err != nil {
		return nil, err
	}

	liveMatch.State = newState
	liveMatch.LastSeqID++

	return newState, nil
}

func (m *MatchManager) EndMatch(matchID uuid.UUID) (MatchState, error) {
	m.mu.Lock()
	liveMatch, exists := m.liveMatches[matchID]
	if exists {
		delete(m.liveMatches, matchID)
	}
	m.mu.Unlock()

	if !exists {
		return nil, ErrMatchNotFound
	}

	liveMatch.mu.Lock()
	state := liveMatch.State
	liveMatch.mu.Unlock()

	m.hub.BroadcastToMatch(matchID, MsgTypeMatchEnded, map[string]interface{}{
		"state":   state,
		"score":   state.GetScore(),
		"is_over": true,
	})

	return state, nil
}

func (m *MatchManager) GetLiveState(matchID uuid.UUID) (MatchState, error) {
	m.mu.RLock()
	liveMatch, exists := m.liveMatches[matchID]
	m.mu.RUnlock()

	if !exists {
		return nil, ErrMatchNotFound
	}

	liveMatch.mu.RLock()
	state := liveMatch.State
	liveMatch.mu.RUnlock()

	return state, nil
}

func (m *MatchManager) IsMatchLive(matchID uuid.UUID) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, exists := m.liveMatches[matchID]
	return exists
}

func (m *MatchManager) GetLiveMatches() []uuid.UUID {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids := make([]uuid.UUID, 0, len(m.liveMatches))
	for id := range m.liveMatches {
		ids = append(ids, id)
	}
	return ids
}

func (m *MatchManager) GetViewerCount(matchID uuid.UUID) int {
	return m.hub.GetViewerCount(matchID)
}

func (m *MatchManager) GetStateJSON(matchID uuid.UUID) ([]byte, error) {
	state, err := m.GetLiveState(matchID)
	if err != nil {
		return nil, err
	}
	return json.Marshal(state)
}

func (m *MatchManager) LoadMatchState(matchID uuid.UUID, sportType string, stateData []byte) error {
	engine, err := GetEngine(sportType)
	if err != nil {
		return err
	}

	state, err := engine.LoadState(stateData)
	if err != nil {
		return err
	}

	liveMatch := &LiveMatch{
		MatchID:   matchID,
		SportType: sportType,
		State:     state,
		Engine:    engine,
	}

	m.mu.Lock()
	m.liveMatches[matchID] = liveMatch
	m.mu.Unlock()

	return nil
}
