package models

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type NullString struct {
	sql.NullString
}

func (ns NullString) MarshalJSON() ([]byte, error) {
	if ns.Valid {
		return json.Marshal(ns.String)
	}
	return json.Marshal(nil)
}

func (ns *NullString) UnmarshalJSON(data []byte) error {
	var s *string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	if s != nil {
		ns.Valid = true
		ns.String = *s
	} else {
		ns.Valid = false
	}
	return nil
}

type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return json.Unmarshal([]byte(value.(string)), j)
	}
	return json.Unmarshal(bytes, j)
}

type Tournament struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	SportType string    `json:"sport_type" db:"sport_type"`
	StartDate time.Time `json:"start_date" db:"start_date"`
	Status    string    `json:"status" db:"status"`
	Config    JSONB     `json:"config,omitempty" db:"config"`
}

type Team struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	Name      string     `json:"name" db:"name"`
	ShortCode string     `json:"short_code" db:"short_code"`
	LogoURL   NullString `json:"logo_url,omitempty" db:"logo_url"`
}

type Player struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	Name      string     `json:"name" db:"name"`
	SportType string     `json:"sport_type" db:"sport_type"`
	Role      NullString `json:"role,omitempty" db:"role"`
}

type CreatePlayerRequest struct {
	Name      string `json:"name" binding:"required,min=2,max=255"`
	SportType string `json:"sport_type" binding:"required,oneof=CRICKET FOOTBALL BADMINTON"`
	Role      string `json:"role,omitempty"`
}

type UpdatePlayerRequest struct {
	Name string `json:"name,omitempty" binding:"omitempty,min=2,max=255"`
	Role string `json:"role,omitempty"`
}

type AddPlayerToTeamRequest struct {
	PlayerID string `json:"player_id" binding:"required,uuid"`
}

type Match struct {
	ID           uuid.UUID `json:"id" db:"id"`
	TournamentID uuid.UUID `json:"tournament_id" db:"tournament_id"`
	TeamAID      uuid.UUID `json:"team_a_id" db:"team_a_id"`
	TeamBID      uuid.UUID `json:"team_b_id" db:"team_b_id"`
	StartTime    time.Time `json:"start_time" db:"start_time"`
	Status       string    `json:"status" db:"status"`
	ScoreSummary JSONB     `json:"score_summary" db:"score_summary"`
	Version      int       `json:"version" db:"version"`
}

type MatchEvent struct {
	ID        int64     `json:"id" db:"id"`
	MatchID   uuid.UUID `json:"match_id" db:"match_id"`
	EventType string    `json:"event_type" db:"event_type"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	EventData JSONB     `json:"event_data" db:"event_data"`
}

type CreateTournamentRequest struct {
	Name      string `json:"name" binding:"required,min=3,max=255"`
	SportType string `json:"sport_type" binding:"required,oneof=CRICKET FOOTBALL BADMINTON"`
	Config    JSONB  `json:"config,omitempty"`
}

type UpdateTournamentConfigRequest struct {
	Config JSONB `json:"config" binding:"required"`
}

type CreateTeamRequest struct {
	Name      string `json:"name" binding:"required,min=2,max=255"`
	ShortCode string `json:"short_code" binding:"required,min=2,max=10"`
	LogoURL   string `json:"logo_url,omitempty"`
}

type CreateMatchRequest struct {
	TeamAID   string `json:"team_a_id" binding:"required,uuid"`
	TeamBID   string `json:"team_b_id" binding:"required,uuid"`
	StartTime string `json:"start_time" binding:"required"`
}

type UpdateMatchRequest struct {
	TeamAID   string `json:"team_a_id,omitempty" binding:"omitempty,uuid"`
	TeamBID   string `json:"team_b_id,omitempty" binding:"omitempty,uuid"`
	StartTime string `json:"start_time,omitempty"`
}

type AddPlayerRequest struct {
	Name string `json:"name" binding:"required,min=2,max=255"`
	Role string `json:"role,omitempty" binding:"omitempty,oneof=BATTER BOWLER ALL_ROUNDER WICKET_KEEPER"`
}

type AddTeamToTournamentRequest struct {
	TeamID string `json:"team_id" binding:"required,uuid"`
}

type RecordEventRequest struct {
	EventType string                 `json:"event_type" binding:"required"`
	EventData map[string]interface{} `json:"event_data" binding:"required"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type TournamentResponse struct {
	Tournament
	TeamCount int `json:"team_count" db:"team_count"`
}

type MatchResponse struct {
	Match
	TeamAName      string `json:"team_a_name" db:"team_a_name"`
	TeamAShortCode string `json:"team_a_short_code" db:"team_a_short_code"`
	TeamBName      string `json:"team_b_name" db:"team_b_name"`
	TeamBShortCode string `json:"team_b_short_code" db:"team_b_short_code"`
	TournamentName string `json:"tournament_name" db:"tournament_name"`
}

type LeaderboardEntry struct {
	ID           uuid.UUID `json:"id" db:"id"`
	TournamentID uuid.UUID `json:"tournament_id" db:"tournament_id"`
	PlayerID     uuid.UUID `json:"player_id" db:"player_id"`
	PlayerName   string    `json:"player_name" db:"player_name"`
	TeamName     string    `json:"team_name" db:"team_name"`
	TeamCode     string    `json:"team_code" db:"team_code"`
	Stats        JSONB     `json:"stats" db:"stats"`
}

type PlayerProfile struct {
	Player
	TeamName string `json:"team_name" db:"team_name"`
	TeamCode string `json:"team_code" db:"team_code"`
	Stats    JSONB  `json:"stats,omitempty"`
}

type MatchStats struct {
	ID        uuid.UUID `json:"id" db:"id"`
	MatchID   uuid.UUID `json:"match_id" db:"match_id"`
	Stats     JSONB     `json:"stats" db:"stats"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}
